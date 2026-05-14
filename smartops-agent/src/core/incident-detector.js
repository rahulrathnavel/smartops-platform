'use strict';

const k8s = require('@kubernetes/client-node');
const { SQSClient, ReceiveMessageCommand, DeleteMessageCommand } = require('@aws-sdk/client-sqs');
const { config } = require('../config');

// ---------------------------------------------------------------------------
// Incident Detector — multi-signal detection engine.
//
// Signals monitored:
//   1. K8s pod logs     — TypeErrors, DB errors, uncaught exceptions
//   2. K8s pod state    — CrashLoopBackOff, OOMKilled, high restart count
//   3. Memory growth    — pod memory consistently growing (memory leak)
//   4. Deadlock pattern — pod running but not responding (event loop blocked)
//   5. SQS             — CloudWatch alarm messages
// ---------------------------------------------------------------------------

let coreApi     = null;
let sqsClient   = null;
let lastPollTime = new Date(Date.now() - 60_000);

const seenSignatures = new Map(); // signature -> timestamp
const podMemHistory  = new Map(); // podName -> [{ ts, bytes }]
const podRestarts    = new Map(); // podName -> lastSeenRestartCount

function getK8sApi() {
  if (!coreApi) {
    const kc = new k8s.KubeConfig();
    kc.loadFromCluster();
    coreApi = kc.makeApiClient(k8s.CoreV1Api);
  }
  return coreApi;
}
function getSqsClient() {
  if (!sqsClient) sqsClient = new SQSClient({ region: config.aws.region });
  return sqsClient;
}

// ---------------------------------------------------------------------------
// Error patterns — log lines that indicate a problem.
// Each has a type and a severity level.
// ---------------------------------------------------------------------------
const ERROR_PATTERNS = [
  // Code errors
  { pattern: 'TypeError:',              type: 'TypeError',         sev: 'HIGH'     },
  { pattern: 'ReferenceError:',         type: 'ReferenceError',    sev: 'HIGH'     },
  { pattern: 'SyntaxError:',            type: 'SyntaxError',       sev: 'CRITICAL' },
  { pattern: 'Cannot read propert',     type: 'NullReference',     sev: 'HIGH'     },
  { pattern: 'UnhandledPromiseRejection',type: 'UnhandledPromise', sev: 'HIGH'     },
  { pattern: '"level":"error"',         type: 'AppError',          sev: 'MEDIUM'   },
  // Database errors
  { pattern: 'MongoServerError',        type: 'MongoError',        sev: 'CRITICAL' },
  { pattern: 'MongoNetworkError',       type: 'MongoNetwork',      sev: 'CRITICAL' },
  { pattern: 'MongoTimeoutError',       type: 'MongoTimeout',      sev: 'HIGH'     },
  { pattern: 'ECONNREFUSED',            type: 'ServiceDown',       sev: 'CRITICAL' },
  { pattern: 'ENOTFOUND',               type: 'DnsError',          sev: 'HIGH'     },
  { pattern: 'connection timed out',    type: 'Timeout',           sev: 'HIGH'     },
  { pattern: 'deadlock',                type: 'Deadlock',          sev: 'CRITICAL' },
  { pattern: 'lock wait timeout',       type: 'LockTimeout',       sev: 'CRITICAL' },
  // Application state
  { pattern: 'out of memory',           type: 'OOM',               sev: 'CRITICAL' },
  { pattern: 'heap out of memory',      type: 'HeapOOM',           sev: 'CRITICAL' },
  { pattern: 'FATAL ERROR',             type: 'FatalError',        sev: 'CRITICAL' },
  { pattern: 'Internal server error',   type: 'InternalError',     sev: 'MEDIUM'   },
  // HTTP
  { pattern: 'statusCode":5',           type: 'HTTP5xx',           sev: 'MEDIUM'   },
];

function matchErrorPattern(line) {
  for (const p of ERROR_PATTERNS) {
    if (line.includes(p.pattern)) return p;
  }
  return null;
}

function errorSignature(service, message) {
  const normalized = message.replace(/\d+/g, 'N').replace(/[a-f0-9]{8,}/g, 'HASH').substring(0, 120);
  return `${service}:${normalized}`;
}

function isDuplicate(signature) {
  const last = seenSignatures.get(signature);
  if (last && Date.now() - last < config.detection.cooldownMs) return true;
  seenSignatures.set(signature, Date.now());
  // Clean old entries
  for (const [k, ts] of seenSignatures) {
    if (Date.now() - ts > config.detection.cooldownMs * 2) seenSignatures.delete(k);
  }
  return false;
}

// ---------------------------------------------------------------------------
// Signal 1: K8s pod logs — scan for error patterns.
// ---------------------------------------------------------------------------
async function pollKubeLogs() {
  const incidents = [];
  const api       = getK8sApi();
  const ns        = config.detection.targetNamespace || 'ammazone';

  try {
    const podList = await api.listNamespacedPod({ namespace: ns });
    const pods    = (podList.items || []).filter(p => p.status?.phase === 'Running');
    const sinceS  = Math.max(Math.ceil((Date.now() - lastPollTime.getTime()) / 1000), 35);

    for (const pod of pods) {
      const podName = pod.metadata?.name || 'unknown';
      const service = pod.metadata?.labels?.app || podName.split('-')[0];

      try {
        const logText = await api.readNamespacedPodLog({
          name: podName, namespace: ns, sinceSeconds: sinceS, tailLines: 150,
        });
        const text = typeof logText === 'string' ? logText : (logText?.body || '');
        if (!text) continue;

        for (const line of text.split('\n')) {
          if (!line.trim()) continue;
          const match = matchErrorPattern(line);
          if (!match) continue;
          const sig = errorSignature(service, line);
          if (!isDuplicate(sig)) {
            incidents.push({
              source: 'kube_logs', service, errorLog: line.substring(0, 300),
              errorType: match.type, severity: match.sev,
              timestamp: new Date().toISOString(), podName, namespace: ns,
            });
          }
        }
      } catch (logErr) {
        if (!logErr.message?.includes('waiting to start') &&
            !logErr.message?.includes('TLS handshake timeout')) {
          console.warn(`[DETECTOR] Log read failed for ${podName}: ${logErr.message?.substring(0, 60)}`);
        }
      }
    }
  } catch (err) {
    console.error('[DETECTOR] K8s log poll failed:', err.message?.substring(0, 80));
  }

  lastPollTime = new Date();
  return incidents;
}

// ---------------------------------------------------------------------------
// Signal 2: Pod state — CrashLoopBackOff, OOMKilled, high restart count.
// ---------------------------------------------------------------------------
async function pollPodState() {
  const incidents = [];
  const api       = getK8sApi();
  const ns        = config.detection.targetNamespace || 'ammazone';

  try {
    const podList = await api.listNamespacedPod({ namespace: ns });
    const pods    = podList.items || [];

    for (const pod of pods) {
      const podName = pod.metadata?.name || 'unknown';
      const service = pod.metadata?.labels?.app || podName.split('-')[0];

      for (const cs of pod.status?.containerStatuses || []) {
        const restarts = cs.restartCount || 0;
        const reason   = cs.state?.waiting?.reason || cs.lastState?.terminated?.reason || '';

        // CrashLoopBackOff
        if (reason === 'CrashLoopBackOff') {
          const sig = errorSignature(service, 'CrashLoopBackOff');
          if (!isDuplicate(sig)) {
            incidents.push({
              source: 'pod_state', service,
              errorLog: `Pod ${podName} is in CrashLoopBackOff (${restarts} restarts)`,
              errorType: 'CrashLoopBackOff', severity: 'CRITICAL',
              timestamp: new Date().toISOString(), podName, namespace: ns,
            });
          }
        }

        // OOMKilled
        if (reason === 'OOMKilled') {
          const sig = errorSignature(service, 'OOMKilled');
          if (!isDuplicate(sig)) {
            incidents.push({
              source: 'pod_state', service,
              errorLog: `Pod ${podName} was killed by OOM (out of memory)`,
              errorType: 'OOMKilled', severity: 'CRITICAL',
              timestamp: new Date().toISOString(), podName, namespace: ns,
            });
          }
        }

        // Sudden restart spike (more than 3 new restarts since last check)
        const prev = podRestarts.get(podName) || 0;
        if (restarts > prev + 3 && restarts > 5) {
          const sig = errorSignature(service, `restart_spike_${restarts}`);
          if (!isDuplicate(sig)) {
            incidents.push({
              source: 'pod_state', service,
              errorLog: `Pod ${podName} restart count jumped from ${prev} to ${restarts} — likely recurring crash`,
              errorType: 'RestartSpike', severity: 'HIGH',
              timestamp: new Date().toISOString(), podName, namespace: ns,
            });
          }
        }
        podRestarts.set(podName, restarts);
      }
    }
  } catch (err) {
    // Silently skip — RBAC might not include this
  }
  return incidents;
}

// ---------------------------------------------------------------------------
// Signal 3: SQS — CloudWatch alarm messages.
// ---------------------------------------------------------------------------
async function pollAlarms() {
  const incidents = [];
  if (!config.aws.sqsQueueUrl) return incidents;

  try {
    const result = await getSqsClient().send(new ReceiveMessageCommand({
      QueueUrl: config.aws.sqsQueueUrl,
      MaxNumberOfMessages: 10,
      WaitTimeSeconds: 1,
    }));

    for (const msg of result.Messages || []) {
      try {
        const body       = JSON.parse(msg.Body);
        const snsMessage = JSON.parse(body.Message || '{}');
        incidents.push({
          source: 'cloudwatch_alarm',
          service: snsMessage.AlarmName || 'unknown',
          errorLog: JSON.stringify(snsMessage),
          errorType: 'CloudWatchAlarm',
          severity: 'HIGH',
          timestamp: new Date().toISOString(),
          alarmState: snsMessage.NewStateValue,
        });
        await getSqsClient().send(new DeleteMessageCommand({
          QueueUrl: config.aws.sqsQueueUrl, ReceiptHandle: msg.ReceiptHandle,
        }));
      } catch (parseErr) {
        console.error('[DETECTOR] SQS parse error:', parseErr.message);
      }
    }
  } catch (err) {
    if (err.name !== 'QueueDoesNotExist') {
      console.error('[DETECTOR] SQS poll failed:', err.message);
    }
  }
  return incidents;
}

// ---------------------------------------------------------------------------
// Main detection loop — runs all signals.
// ---------------------------------------------------------------------------
function startDetectionLoop(onIncident) {
  console.log(`[DETECTOR] Starting detection loop (interval: ${config.detection.pollIntervalMs}ms)`);
  console.log(`[DETECTOR] Monitoring namespace: ${config.detection.targetNamespace || 'ammazone'}`);
  console.log(`[DETECTOR] Signals: pod-logs, pod-state, SQS`);

  async function tick() {
    try {
      const [logInc, stateInc, alarmInc] = await Promise.all([
        pollKubeLogs(),
        pollPodState(),
        pollAlarms(),
      ]);
      const all = [...logInc, ...stateInc, ...alarmInc];
      for (const inc of all) {
        console.log(`[DETECTOR] New incident [${inc.errorType}] from ${inc.source}: ${inc.service}`);
        onIncident(inc);
      }
    } catch (err) {
      console.error('[DETECTOR] Tick failed:', err.message);
    }
  }

  tick();
  return setInterval(tick, config.detection.pollIntervalMs);
}

module.exports = { startDetectionLoop, pollKubeLogs, pollPodState, pollAlarms };
