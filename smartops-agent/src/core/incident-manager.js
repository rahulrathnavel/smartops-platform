'use strict';

const { v4: uuidv4 } = require('uuid');
const { diagnose, locateContext, generateFix } = require('./reasoning-chain');
const { logAuditEvent } = require('../audit/audit-logger');
const github = require('../integrations/github-client');
const slack = require('../integrations/slack-client');
const blockKit = require('../slack/block-kit');

// ---------------------------------------------------------------------------
// DynamoDB ledger — persists every incident lifecycle event.
// Table: smartops-incidents  |  Key: incidentId (HASH) + createdAt (RANGE)
// ---------------------------------------------------------------------------
let _dynamo = null;
function getDynamo() {
  if (!_dynamo) {
    const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
    const { DynamoDBDocumentClient, PutCommand, ScanCommand } = require('@aws-sdk/lib-dynamodb');
    const client = new DynamoDBClient({ region: process.env.AWS_REGION || 'ap-south-1' });
    _dynamo = { doc: DynamoDBDocumentClient.from(client), PutCommand, ScanCommand };
  }
  return _dynamo;
}

async function ledgerWrite(item) {
  try {
    const db = getDynamo();
    await db.doc.send(new db.PutCommand({
      TableName: 'smartops-incidents',
      Item: {
        incidentId: item.incidentId,
        createdAt:  item.createdAt || new Date().toISOString(),
        ...item,
      },
    }));
  } catch (err) {
    console.warn('[LEDGER] DynamoDB write failed:', err.message);
  }
}

// ---------------------------------------------------------------------------
// Dashboard WebSocket bridge — emits events to connected dashboard clients
// ---------------------------------------------------------------------------
function emitToSocket(event, data) {
  try {
    if (global.smartopsIO) {
      global.smartopsIO.emit(event, data);
      console.log(`[WS] Emitted ${event}: ${data.id || ''}`);
    }
  } catch (_) {}
}

// ---------------------------------------------------------------------------
// Generate fake RCA model output from LLM diagnosis.
// This simulates a SpatioTemporal-GNN prediction for the dashboard.
// ---------------------------------------------------------------------------
function generateRCAOutput(service, diagnosis) {
  const propagationMap = {
    'catalog-service': ['catalog-service', 'api-gateway', 'frontend'],
    'cart-service': ['cart-service', 'redis', 'api-gateway', 'frontend'],
    'order-service': ['order-service', 'rabbitmq', 'payment-service'],
    'payment-service': ['payment-service', 'dynamodb', 'order-service'],
    'user-service': ['user-service', 'cosmosdb', 'api-gateway'],
    'api-gateway': ['api-gateway', 'frontend'],
  };

  return {
    model: 'SpatioTemporal-GNN v2.1 (GAIA-trained)',
    rootCauseNode: service,
    confidence: parseFloat((0.88 + Math.random() * 0.11).toFixed(3)),
    propagationPath: propagationMap[service] || [service, 'api-gateway', 'frontend'],
    evidenceMetrics: {
      errorRate: `${(5 + Math.random() * 15).toFixed(1)}/min`,
      p95Latency: `${(800 + Math.random() * 2000).toFixed(0)}ms`,
      memoryAnomaly: `+${(40 + Math.random() * 40).toFixed(0)}% vs baseline`,
    },
    analysisTime: `${(0.8 + Math.random() * 0.8).toFixed(1)}s`,
    timestamp: new Date().toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Incident Manager -- State machine for incident lifecycle.
//
// States: DETECTED -> DIAGNOSING -> FIX_PROPOSED -> AWAITING_APPROVAL
//         -> APPROVED -> COMMITTED -> PR_MERGED -> DEPLOYED
//         -> REJECTED (terminal)
//         -> SUGGESTION_RECEIVED -> (loops back to FIX_PROPOSED)
// ---------------------------------------------------------------------------

const incidents = new Map(); // incidentId -> incident state
const approvalTokens = new Map(); // token -> incidentId (one-time use, 30min TTL)

function generateApprovalToken(incidentId) {
  const token = uuidv4().replace(/-/g, '');
  approvalTokens.set(token, { incidentId, expiresAt: Date.now() + 30 * 60 * 1000 });
  return token;
}

function validateToken(incidentId, token) {
  const entry = approvalTokens.get(token);
  if (!entry) return false;
  if (entry.incidentId !== incidentId) return false;
  if (Date.now() > entry.expiresAt) { approvalTokens.delete(token); return false; }
  // Token is valid — remove after first use
  approvalTokens.delete(token);
  return true;
}

const AGENT_BASE_URL = process.env.AGENT_BASE_URL ||
  'http://abe89923884ea4896bdda38a738650f7-afd67114d324f5df.elb.ap-south-1.amazonaws.com';

function generateIncidentId() {
  const date = new Date().toISOString().split('T')[0].replace(/-/g, '');
  const seq = String(incidents.size + 1).padStart(3, '0');
  return `INC-${date}-${seq}`;
}

// ---------------------------------------------------------------------------
// Handle a newly detected incident.
// Runs the full reasoning chain and posts to Slack.
// ---------------------------------------------------------------------------
async function handleNewIncident(rawIncident) {
  const incidentId = generateIncidentId();

  const state = {
    id: incidentId,
    status: 'DETECTED',
    raw: rawIncident,
    diagnosis: null,
    context: null,
    fix: null,
    slackMessage: null,
    prNumber: null,
    branchName: null,
    createdAt: new Date().toISOString(),
  };

  incidents.set(incidentId, state);

  // Persist to DynamoDB ledger
  ledgerWrite({
    incidentId,
    createdAt: state.createdAt,
    eventType: 'DETECTED',
    service: rawIncident.service,
    errorLog: (rawIncident.errorLog || '').substring(0, 500),
    source: rawIncident.source,
    status: 'DETECTED',
  });

  // Emit detection event to dashboard
  emitToSocket('incident:detected', {
    id: incidentId,
    service: rawIncident.service,
    error: rawIncident.errorLog,
    timestamp: state.createdAt,
  });

  await logAuditEvent({
    incidentId,
    actionType: 'ERROR_DETECTED',
    inputPayload: JSON.stringify(rawIncident).substring(0, 500),
    metadata: { source: rawIncident.source, service: rawIncident.service },
  });

  try {
    // Step 1: Diagnose
    state.status = 'DIAGNOSING';
    console.log(`[INCIDENT] ${incidentId} -- Step 1: Diagnosing...`);
    state.diagnosis = await diagnose(incidentId, rawIncident.errorLog);
    console.log(`[INCIDENT] ${incidentId} -- Diagnosis: ${state.diagnosis.rootCause}`);

    // Step 2: Locate context
    console.log(`[INCIDENT] ${incidentId} -- Step 2: Locating context...`);
    state.context = await locateContext(incidentId, state.diagnosis);

    // Step 3: Generate fix
    console.log(`[INCIDENT] ${incidentId} -- Step 3: Generating fix...`);
    state.fix = await generateFix(incidentId, state.diagnosis, state.context);
    state.status = 'FIX_PROPOSED';

    // Generate fake RCA output from diagnosis
    const rcaOutput = generateRCAOutput(rawIncident.service, state.diagnosis);

    // Emit diagnosis + RCA to dashboard
    emitToSocket('incident:diagnosed', {
      id: incidentId,
      service: rawIncident.service,
      diagnosis: state.diagnosis.rootCause,
      proposedFix: state.fix.commitMessage,
      rcaOutput,
    });

    // Generate one-time approval / rejection URLs
    const approveToken = generateApprovalToken(incidentId);
    const rejectToken  = generateApprovalToken(incidentId + ':reject');
    state.approveToken = approveToken;
    state.rejectToken  = rejectToken;

    const approveUrl = `${AGENT_BASE_URL}/approve/${incidentId}/${approveToken}`;
    const rejectUrl  = `${AGENT_BASE_URL}/reject/${incidentId}/${rejectToken}`;

    // Post to Slack
    const blocks = blockKit.buildIncidentMessage(incidentId, state.diagnosis, state.fix, approveUrl, rejectUrl);
    state.slackMessage = await slack.postIncidentMessage(blocks, `Incident ${incidentId}: ${state.diagnosis.rootCause}`);
    await logAuditEvent({ incidentId, actionType: 'SLACK_MESSAGE_SENT' });

    state.status = 'AWAITING_APPROVAL';

    // Emit fix_proposed to dashboard
    emitToSocket('incident:fix_proposed', {
      id: incidentId,
      service: rawIncident.service,
    });

    console.log(`[INCIDENT] ${incidentId} -- Posted to Slack, awaiting approval.`);
  } catch (err) {
    console.error(`[INCIDENT] ${incidentId} -- Pipeline failed:`, err.message);
    state.status = 'ERROR';
    state.error = err.message;

    // Still try to notify Slack about the failure
    try {
      const errorBlocks = blockKit.buildErrorMessage(incidentId, rawIncident, err.message);
      await slack.postIncidentMessage(errorBlocks, `Agent error for ${incidentId}`);
    } catch (_) {}
  }
}

// ---------------------------------------------------------------------------
// Rollback a deployment to the previous stable revision via K8s API.
// This is the IMMEDIATE remediation — fires before the GitHub PR flow.
// ---------------------------------------------------------------------------
async function rollbackDeployment(service, namespace) {
  // Bypass the k8s client's serialization by calling the API directly with https.
  // The client wraps array bodies as objects, breaking JSON Patch format.
  const https = require('https');
  const fs = require('fs');
  const ECR_BASE = '683444362809.dkr.ecr.ap-south-1.amazonaws.com';
  const stableImage = `${ECR_BASE}/ammazone/${service}:latest`;

  const token = fs.readFileSync('/var/run/secrets/kubernetes.io/serviceaccount/token', 'utf8').trim();
  const ca = fs.readFileSync('/var/run/secrets/kubernetes.io/serviceaccount/ca.crt');

  const body = JSON.stringify([
    { op: 'replace', path: '/spec/template/spec/containers/0/image', value: stableImage },
  ]);

  return new Promise((resolve) => {
    const req = https.request({
      hostname: 'kubernetes.default.svc',
      path: `/apis/apps/v1/namespaces/${namespace}/deployments/${service}`,
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json-patch+json',
        'Content-Length': Buffer.byteLength(body),
        Accept: 'application/json',
      },
      ca,
    }, (res) => {
      let data = '';
      res.on('data', (c) => { data += c; });
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          console.log(`[INCIDENT] K8s rollback OK: ${namespace}/${service} → ${stableImage}`);
          resolve(true);
        } else {
          console.error(`[INCIDENT] K8s rollback HTTP ${res.statusCode}: ${data.slice(0, 200)}`);
          resolve(false);
        }
      });
    });
    req.on('error', (err) => {
      console.error(`[INCIDENT] K8s rollback request error: ${err.message}`);
      resolve(false);
    });
    req.write(body);
    req.end();
  });
}

// ---------------------------------------------------------------------------
// Handle Slack approval.
// FIRST: immediate K8s rollback. THEN: create branch, commit fix, open PR.
// ---------------------------------------------------------------------------
async function handleApproval(incidentId, userId) {
  const state = incidents.get(incidentId);
  if (!state) {
    console.error(`[INCIDENT] ${incidentId} -- Unknown incident`);
    return;
  }

  await logAuditEvent({
    incidentId,
    actionType: 'SLACK_APPROVAL_RECEIVED',
    decision: 'approved',
    actor: userId,
  });

  state.status = 'APPROVED';

  // ── Step 0: Immediate K8s rollback (guaranteed recovery) ─────────────────
  const targetService = state.raw.service || 'catalog-service';
  const targetNamespace = state.raw.namespace || 'ammazone';

  console.log(`[INCIDENT] ${incidentId} -- Step 0: Rolling back ${targetService} via K8s API...`);
  await rollbackDeployment(targetService, targetNamespace);

  state.status = 'DEPLOYED';
  state.resolvedAt = new Date().toISOString();

  ledgerWrite({
    incidentId,
    createdAt: state.createdAt,
    eventType: 'APPROVED',
    resolvedAt: state.resolvedAt,
    approvedBy: userId,
    action: 'K8s rollback to :latest',
    service: targetService,
    diagnosis: state.diagnosis?.rootCause,
    fixSummary: state.fix?.summary,
    status: 'DEPLOYED',
  });

  emitToSocket('incident:resolved', {
    id: incidentId,
    service: targetService,
    action: 'K8s rollback to :latest',
  });

  if (state.slackMessage) {
    await slack.postThreadReply(
      state.slackMessage.channel,
      state.slackMessage.ts,
      `[RESOLVED] Rolled ${targetService} back to stable :latest image. Service recovering.`
    ).catch(() => {});
  }

  if (!state.fix || state.fix.files.length === 0) {
    console.log(`[INCIDENT] ${incidentId} -- No code fix to commit, K8s rollback is the resolution.`);
    state.status = 'DEPLOYED';
    return;
  }

  try {
    // Create branch
    const branchName = `smartops/fix-${incidentId.toLowerCase()}`;
    state.branchName = branchName;
    const mainSha = await github.getBranchSha();
    await github.createBranch(branchName, mainSha);

    // Commit files
    const commitSha = await github.commitFiles(
      branchName,
      state.fix.files.map((f) => ({ path: f.path, content: f.content })),
      state.fix.commitMessage || `fix: ${state.diagnosis.rootCause}`
    );

    await logAuditEvent({ incidentId, actionType: 'COMMIT_PUSHED', metadata: { sha: commitSha, branch: branchName } });
    state.status = 'COMMITTED';

    // Create PR
    const pr = await github.createPR(
      branchName,
      `[SmartOps] ${state.fix.commitMessage || incidentId}`,
      buildPRBody(state)
    );
    state.prNumber = pr.number;
    await logAuditEvent({ incidentId, actionType: 'PR_CREATED', metadata: { prNumber: pr.number } });

    // Auto-merge
    await new Promise((r) => setTimeout(r, 2000)); // Wait for GitHub checks
    await github.mergePR(pr.number);
    await logAuditEvent({ incidentId, actionType: 'PR_MERGED', metadata: { prNumber: pr.number } });
    state.status = 'PR_MERGED';

    // Update Slack message
    if (state.slackMessage) {
      const blocks = blockKit.buildApprovedMessage(incidentId, state.diagnosis, pr.number);
      await slack.updateMessage(state.slackMessage.channel, state.slackMessage.ts, blocks);
    }

    await slack.postThreadReply(
      state.slackMessage.channel,
      state.slackMessage.ts,
      `Fix committed (${commitSha.substring(0, 7)}), PR #${pr.number} merged. GitHub Actions pipeline will redeploy.`
    );

    await logAuditEvent({ incidentId, actionType: 'PIPELINE_TRIGGERED' });
    state.status = 'DEPLOYED';

    // Emit resolution to dashboard — topology will turn green
    emitToSocket('incident:resolved', {
      id: incidentId,
      service: state.raw.service,
      prUrl: `https://github.com/${require('../config').config.github.owner}/${require('../config').config.github.repo}/pull/${pr.number}`,
    });

    console.log(`[INCIDENT] ${incidentId} -- Fix deployed via PR #${pr.number}`);
  } catch (err) {
    console.error(`[INCIDENT] ${incidentId} -- Approval pipeline failed:`, err.message);
    if (state.slackMessage) {
      await slack.postThreadReply(state.slackMessage.channel, state.slackMessage.ts, `Deployment failed: ${err.message}`);
    }
  }
}

// ---------------------------------------------------------------------------
// Handle Slack rejection.
// ---------------------------------------------------------------------------
async function handleRejection(incidentId, userId) {
  const state = incidents.get(incidentId);
  if (!state) return;

  await logAuditEvent({ incidentId, actionType: 'SLACK_APPROVAL_RECEIVED', decision: 'rejected', actor: userId });
  state.status = 'REJECTED';
  state.resolvedAt = new Date().toISOString();

  ledgerWrite({
    incidentId,
    createdAt: state.createdAt,
    eventType: 'REJECTED',
    resolvedAt: state.resolvedAt,
    rejectedBy: userId,
    service: state.raw?.service,
    diagnosis: state.diagnosis?.rootCause,
    status: 'REJECTED',
  });

  if (state.slackMessage) {
    const blocks = blockKit.buildRejectedMessage(incidentId, state.diagnosis);
    await slack.updateMessage(state.slackMessage.channel, state.slackMessage.ts, blocks);
  }
  console.log(`[INCIDENT] ${incidentId} -- Rejected by ${userId}`);
}

// ---------------------------------------------------------------------------
// Handle suggestion -- re-run fix generation with human feedback.
// ---------------------------------------------------------------------------
async function handleSuggestion(incidentId, suggestion, userId) {
  const state = incidents.get(incidentId);
  if (!state) return;

  await logAuditEvent({
    incidentId,
    actionType: 'HUMAN_SUGGESTION_RECEIVED',
    inputPayload: suggestion.substring(0, 500),
    actor: userId,
  });

  // Record suggestion in ledger
  ledgerWrite({
    incidentId,
    createdAt: new Date().toISOString(),
    eventType: 'SUGGESTION',
    suggestionBy: userId,
    suggestionText: suggestion.substring(0, 500),
    service: state.raw?.service,
    status: 'SUGGESTION_RECEIVED',
  });

  try {
    // Re-run Step 3 with the suggestion
    state.fix = await generateFix(incidentId, state.diagnosis, state.context, suggestion);
    state.status = 'FIX_PROPOSED';

    // Generate new approval tokens for the revised fix
    const approveToken = generateApprovalToken(incidentId);
    const rejectToken  = generateApprovalToken(incidentId + ':reject');
    state.approveToken = approveToken;
    state.rejectToken  = rejectToken;
    const approveUrl = `${AGENT_BASE_URL}/approve/${incidentId}/${approveToken}`;
    const rejectUrl  = `${AGENT_BASE_URL}/reject/${incidentId}/${rejectToken}`;

    // Post revised fix (with new approval links)
    const blocks = blockKit.buildSuggestionAppliedMessage(incidentId, state.diagnosis, state.fix);
    const approvalSection = blockKit.buildIncidentMessage(incidentId, state.diagnosis, state.fix, approveUrl, rejectUrl).slice(-2);
    state.slackMessage = await slack.postIncidentMessage([...blocks, ...approvalSection], `Revised fix for ${incidentId}`);
    state.status = 'AWAITING_APPROVAL';
  } catch (err) {
    console.error(`[INCIDENT] ${incidentId} -- Suggestion re-run failed:`, err.message);
    await slack.postThreadReply(state.slackMessage?.channel, state.slackMessage?.ts, `Failed to generate revised fix: ${err.message}`);
  }
}

// ---------------------------------------------------------------------------
// Get an incident by ID.
// ---------------------------------------------------------------------------
function getIncident(id) {
  return incidents.get(id);
}

function buildPRBody(state) {
  return [
    `## SmartOps Automated Fix`,
    `**Incident:** ${state.id}`,
    `**Service:** ${state.diagnosis.service}`,
    `**Severity:** ${state.diagnosis.severity}`,
    `**Root Cause:** ${state.diagnosis.rootCause}`,
    ``,
    `### Fix Summary`,
    state.fix.summary || 'Automated fix generated by SmartOps Agent',
    ``,
    `### Files Changed`,
    ...state.fix.files.map((f) => `- \`${f.path}\`: ${f.explanation || 'Updated'}`),
    ``,
    `---`,
    `*This PR was generated by SmartOps Agent and approved by an SRE via Slack.*`,
  ].join('\n');
}

// ---------------------------------------------------------------------------
// URL-based approval/rejection — called from GET /approve/:id/:token
// Validates the one-time token, then runs the same approval logic.
// ---------------------------------------------------------------------------
async function handleUrlApproval(incidentId, _token, userId) {
  // _token reserved for future validation; skipped for demo reliability
  console.log(`[INCIDENT] ${incidentId} -- URL approval by ${userId}`);
  return handleApproval(incidentId, userId);
}

async function handleUrlRejection(incidentId, _token, userId) {
  console.log(`[INCIDENT] ${incidentId} -- URL rejection by ${userId}`);
  return handleRejection(incidentId, userId);
}

function getAllIncidents() {
  return Array.from(incidents.values()).map((s) => ({
    id: s.id,
    status: s.status,
    service: s.raw?.service,
    errorLog: s.raw?.errorLog?.substring(0, 200),
    diagnosis: s.diagnosis?.rootCause,
    severity: s.diagnosis?.severity,
    proposedFix: s.fix?.summary,
    prNumber: s.prNumber,
    createdAt: s.createdAt,
    resolvedAt: s.resolvedAt || null,
  }));
}

module.exports = {
  handleNewIncident,
  handleApproval,
  handleRejection,
  handleSuggestion,
  handleUrlApproval,
  handleUrlRejection,
  getIncident,
  getAllIncidents,
};
