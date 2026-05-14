import React, { useEffect, useState, useRef } from 'react';
import { socket } from '../socket';
import { CheckCircle, AlertTriangle, Cpu, Wrench, Clock, XCircle } from 'lucide-react';

// Agent REST endpoint — used to restore incident state on page refresh
const AGENT = 'http://abe89923884ea4896bdda38a738650f7-afd67114d324f5df.elb.ap-south-1.amazonaws.com';

// ---------------------------------------------------------------------------
// Step definitions — each incident shows these steps as a vertical timeline
// ---------------------------------------------------------------------------
const STEP_DEFS = [
  { key: 'detected',          label: 'Error Detected',      icon: AlertTriangle, color: '#dc2626' },
  { key: 'rca',               label: 'RCA Model Scanning',  icon: Cpu,           color: '#7c3aed' },
  { key: 'diagnosing',        label: 'LLM Diagnosing',      icon: Cpu,           color: '#2563eb' },
  { key: 'fix_proposed',      label: 'Fix Generated',       icon: Wrench,        color: '#d97706' },
  { key: 'awaiting_approval', label: 'Awaiting Approval',   icon: Clock,         color: '#d97706' },
  { key: 'resolved',          label: 'Resolved',            icon: CheckCircle,   color: '#16a34a' },
  { key: 'rejected',          label: 'Rejected',            icon: XCircle,       color: '#dc2626' },
];

const STATUS_STEP_MAP = {
  detected:          0,
  rca:               1,
  diagnosing:        2,
  fix_proposed:      3,
  awaiting_approval: 4,
  resolved:          5,
  rejected:          6,
};

// ---------------------------------------------------------------------------
// Rebuild step log from a restored incident (for refresh persistence)
// ---------------------------------------------------------------------------
function buildStepsFromIncident(inc) {
  const steps = [];
  const st = (inc.status || 'detected').toLowerCase();

  steps.push({
    key:  'detected',
    text: inc.errorLog || 'Error pattern found in pod logs',
    done: true,
  });

  if (st !== 'detected') {
    steps.push({
      key:  'rca',
      text: `RCA graph model identified ${inc.service} as root-cause node`,
      done: true,
    });
  }
  if (inc.diagnosis && st !== 'detected' && st !== 'rca') {
    steps.push({
      key:  'diagnosing',
      text: inc.diagnosis,
      done: true,
    });
  }
  if (['fix_proposed','awaiting_approval','resolved','rejected'].includes(st)) {
    steps.push({
      key:  'fix_proposed',
      text: inc.proposedFix || 'AI-generated code fix is ready for review',
      done: true,
    });
  }
  if (['awaiting_approval','resolved','rejected'].includes(st)) {
    steps.push({
      key:  'awaiting_approval',
      text: 'Alert sent to Slack and WhatsApp — reply 1 to approve, 2 to reject',
      done: true,
    });
  }
  if (st === 'resolved') {
    steps.push({
      key:  'resolved',
      text: 'Service rolled back to stable image. Shop is healthy.',
      done: true,
    });
  }
  if (st === 'rejected') {
    steps.push({
      key:  'rejected',
      text: 'Fix rejected by SRE. Manual investigation required.',
      done: true,
    });
  }
  return steps;
}

// ---------------------------------------------------------------------------
// A single step row in the timeline
// ---------------------------------------------------------------------------
function StepRow({ stepKey, label, Icon, color, text, active, done }) {
  return (
    <div className="flex gap-3 fadein" style={{ animationDelay: '0.05s' }}>
      {/* Icon + connector line */}
      <div className="flex flex-col items-center">
        <div
          className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 border-2"
          style={{
            background: done ? color + '18' : active ? color + '12' : '#f1f5f9',
            borderColor: done || active ? color : '#e2e8f0',
          }}
        >
          <Icon className="w-4 h-4" style={{ color: done || active ? color : '#94a3b8' }} />
        </div>
        <div className="flex-1 w-0.5 mt-1" style={{ background: done ? color + '40' : '#e2e8f0', minHeight: '16px' }} />
      </div>

      {/* Content */}
      <div className="pb-4 flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span
            className="text-xs font-bold uppercase tracking-wider"
            style={{ color: done || active ? color : '#94a3b8' }}
          >
            {label}
          </span>
          {active && (
            <span className="inline-block w-1.5 h-1.5 rounded-full pulse-dot" style={{ background: color }} />
          )}
        </div>
        {text && (
          <p className="text-sm leading-relaxed" style={{ color: '#334155' }}>{text}</p>
        )}
        {active && !text && (
          <div className="flex items-center gap-2">
            <div className="h-1.5 flex-1 rounded-full overflow-hidden" style={{ background: '#e2e8f0' }}>
              <div
                className="h-1.5 rounded-full"
                style={{
                  width: '60%',
                  background: color,
                  animation: 'progress 2s ease-in-out infinite alternate',
                }}
              />
            </div>
            <span className="text-xs" style={{ color: '#94a3b8' }}>processing...</span>
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Single incident card with live timeline
// ---------------------------------------------------------------------------
function IncidentCard({ inc }) {
  const statusColor = {
    detected:          '#dc2626',
    rca:               '#7c3aed',
    diagnosing:        '#2563eb',
    fix_proposed:      '#d97706',
    awaiting_approval: '#d97706',
    resolved:          '#16a34a',
    rejected:          '#dc2626',
  };

  const statusLabel = {
    detected:          'Detected',
    rca:               'RCA Scanning',
    diagnosing:        'LLM Diagnosing',
    fix_proposed:      'Fix Ready',
    awaiting_approval: 'Awaiting Approval',
    resolved:          'Resolved',
    rejected:          'Rejected',
  };

  const currentStepIdx = STATUS_STEP_MAP[inc.status] ?? 0;
  const color = statusColor[inc.status] || '#2563eb';

  return (
    <div className="bg-white rounded-xl border fadein" style={{ borderColor: inc.status === 'resolved' ? '#e2e8f0' : color + '40' }}>
      {/* Header */}
      <div className="px-5 py-4 border-b flex items-center justify-between" style={{ borderColor: '#f1f5f9' }}>
        <div className="flex items-center gap-3">
          <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{
            background: color,
            boxShadow: inc.status !== 'resolved' && inc.status !== 'rejected' ? `0 0 8px ${color}80` : 'none',
          }} />
          <div>
            <span className="text-xs font-bold font-mono" style={{ color: '#2563eb' }}>{inc.id}</span>
            <p className="text-sm font-semibold mt-0.5" style={{ color: '#0f172a' }}>
              {inc.service} — {inc.severity || 'HIGH'} severity
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span
            className="text-xs px-2.5 py-1 rounded-full font-semibold"
            style={{ background: color + '15', color }}
          >
            {statusLabel[inc.status] || inc.status}
          </span>
          <span className="text-xs" style={{ color: '#94a3b8' }}>
            {inc.startedAt ? new Date(inc.startedAt).toLocaleTimeString() : ''}
          </span>
        </div>
      </div>

      {/* Timeline */}
      <div className="px-5 pt-5 pb-2">
        {inc.steps.map((step, i) => {
          const def  = STEP_DEFS.find(d => d.key === step.key) || STEP_DEFS[0];
          const isLast = i === inc.steps.length - 1;
          const active = isLast && inc.status !== 'resolved' && inc.status !== 'rejected';
          return (
            <StepRow
              key={`${step.key}-${i}`}
              stepKey={step.key}
              label={def.label}
              Icon={def.icon}
              color={def.color}
              text={step.text}
              done={!active}
              active={active}
            />
          );
        })}

        {/* Show "processing" placeholder for next step if still active */}
        {inc.status !== 'resolved' && inc.status !== 'rejected' && inc.status !== 'awaiting_approval' && (
          <StepRow
            stepKey="next"
            label={STEP_DEFS[currentStepIdx + 1]?.label || 'Processing'}
            Icon={STEP_DEFS[currentStepIdx + 1]?.icon || Clock}
            color={STEP_DEFS[currentStepIdx + 1]?.color || '#94a3b8'}
            text={null}
            done={false}
            active={true}
          />
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Incidents page
// ---------------------------------------------------------------------------
export default function Incidents() {
  const [incidents, setIncidents] = useState([]);

  // On mount: load existing incidents from agent REST API (refresh-safe)
  useEffect(() => {
    fetch(`${AGENT}/incidents`, { signal: AbortSignal.timeout(6000) })
      .then(r => r.json())
      .then(d => {
        const restored = (d.incidents || []).map(inc => ({
          id:        inc.id,
          service:   inc.service || 'unknown',
          status:    (inc.status || 'detected').toLowerCase(),
          errorLog:  inc.errorLog,
          diagnosis: inc.diagnosis,
          proposedFix: inc.proposedFix,
          severity:  inc.severity,
          startedAt: inc.createdAt ? new Date(inc.createdAt).getTime() : Date.now(),
          steps:     buildStepsFromIncident(inc),
        }));
        setIncidents(restored);
      })
      .catch(() => {}); // agent might not be reachable yet
  }, []);

  // Real-time WebSocket updates
  useEffect(() => {
    socket.on('incident:detected', (data) => {
      setIncidents(prev => {
        if (prev.find(i => i.id === data.id)) return prev;
        return [{
          id:        data.id,
          service:   data.service,
          status:    'detected',
          severity:  data.severity || 'HIGH',
          errorLog:  data.error || data.errorLog,
          startedAt: Date.now(),
          steps: [{ key: 'detected', text: data.error || 'Error pattern found in pod logs' }],
        }, ...prev];
      });
    });

    socket.on('incident:diagnosed', (data) => {
      setIncidents(prev => prev.map(i => {
        if (i.id !== data.id) return i;
        return {
          ...i,
          status:    'fix_proposed',
          diagnosis: data.diagnosis,
          rcaOutput: data.rcaOutput,
          steps: [
            ...i.steps,
            { key: 'rca', text: `RCA: ${data.rcaOutput?.rootCauseNode || i.service} flagged as root cause — ${((data.rcaOutput?.confidence || 0.9) * 100).toFixed(0)}% confidence` },
            { key: 'diagnosing', text: data.diagnosis },
          ],
        };
      }));
    });

    socket.on('incident:fix_proposed', (data) => {
      setIncidents(prev => prev.map(i => {
        if (i.id !== data.id) return i;
        const alreadyHasFix = i.steps.find(s => s.key === 'fix_proposed');
        return {
          ...i,
          status: 'awaiting_approval',
          steps: alreadyHasFix ? i.steps : [
            ...i.steps,
            { key: 'fix_proposed',      text: i.proposedFix || 'AI-generated code fix ready for review' },
            { key: 'awaiting_approval', text: 'Alert sent to Slack and WhatsApp — reply 1 to approve, 2 to reject' },
          ],
        };
      }));
    });

    socket.on('incident:resolved', (data) => {
      setIncidents(prev => prev.map(i => {
        if (i.id !== data.id) return i;
        const alreadyResolved = i.steps.find(s => s.key === 'resolved');
        return {
          ...i,
          status:     'resolved',
          resolvedAt: Date.now(),
          steps: alreadyResolved ? i.steps : [
            ...i.steps,
            { key: 'resolved', text: 'Service rolled back to stable image. Shop is healthy.' },
          ],
        };
      }));
    });

    return () => {
      socket.off('incident:detected');
      socket.off('incident:diagnosed');
      socket.off('incident:fix_proposed');
      socket.off('incident:resolved');
    };
  }, []);

  const active   = incidents.filter(i => i.status !== 'resolved' && i.status !== 'rejected').length;
  const resolved = incidents.filter(i => i.status === 'resolved').length;

  return (
    <div className="p-7 max-w-4xl mx-auto">
      <style>{`
        @keyframes progress {
          from { width: 20%; }
          to   { width: 80%; }
        }
      `}</style>

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold" style={{ color: '#0f172a' }}>Incidents</h1>
          <p className="text-sm mt-0.5" style={{ color: '#64748b' }}>
            {active} active &mdash; {resolved} resolved &mdash; Live LLM process tracking
          </p>
        </div>
      </div>

      {incidents.length === 0 ? (
        <div className="bg-white rounded-xl border py-16 text-center" style={{ borderColor: '#e2e8f0' }}>
          <CheckCircle className="w-10 h-10 mx-auto mb-3 text-green-500 opacity-50" />
          <p className="font-semibold" style={{ color: '#64748b' }}>No incidents detected</p>
          <p className="text-sm mt-1" style={{ color: '#94a3b8' }}>
            Inject a bug and the LLM process will appear here step by step
          </p>
        </div>
      ) : (
        <div className="space-y-5">
          {incidents.map(inc => (
            <IncidentCard key={inc.id} inc={inc} />
          ))}
        </div>
      )}
    </div>
  );
}
