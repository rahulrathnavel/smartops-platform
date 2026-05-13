import React, { useEffect, useState, useRef, useCallback } from 'react';
import { socket } from '../socket';
import { CheckCircle } from 'lucide-react';

// ---------------------------------------------------------------------------
// Service topology — nodes and edges
// ---------------------------------------------------------------------------
const SERVICES = [
  { id: 'frontend',        label: 'Frontend',        x: 420, y: 55,  type: 'frontend'  },
  { id: 'api-gateway',     label: 'API Gateway',     x: 420, y: 150, type: 'gateway'   },
  { id: 'user-service',    label: 'User Service',    x: 140, y: 270, type: 'service'   },
  { id: 'catalog-service', label: 'Catalog Service', x: 300, y: 270, type: 'service'   },
  { id: 'cart-service',    label: 'Cart Service',    x: 460, y: 270, type: 'service'   },
  { id: 'payment-service', label: 'Payment Service', x: 600, y: 270, type: 'service'   },
  { id: 'order-service',   label: 'Order Service',   x: 740, y: 270, type: 'service'   },
  { id: 'redis',           label: 'Redis',           x: 460, y: 390, type: 'infra'     },
  { id: 'rabbitmq',        label: 'RabbitMQ',        x: 660, y: 390, type: 'infra'     },
  { id: 'mongodb',         label: 'MongoDB',         x: 230, y: 390, type: 'database'  },
  { id: 'dynamodb',        label: 'DynamoDB',        x: 600, y: 470, type: 'database'  },
];

const EDGES = [
  ['frontend','api-gateway'],
  ['api-gateway','user-service'],['api-gateway','catalog-service'],
  ['api-gateway','cart-service'],['api-gateway','payment-service'],['api-gateway','order-service'],
  ['user-service','mongodb'],['catalog-service','mongodb'],
  ['cart-service','redis'],
  ['order-service','rabbitmq'],['order-service','mongodb'],
  ['payment-service','rabbitmq'],['payment-service','dynamodb'],
  ['cart-service','rabbitmq'],
];

// Node type color palette (professional blue/slate)
const TYPE_COLOR = {
  frontend: '#2563eb',
  gateway:  '#7c3aed',
  service:  '#0284c7',
  infra:    '#d97706',
  database: '#0891b2',
};

// ---------------------------------------------------------------------------
// Incident process steps
// ---------------------------------------------------------------------------
const PROCESS_STEPS = [
  { key: 'rca',      label: 'RCA Analysis',        desc: 'SpatioTemporal-GNN scanning service call graph...' },
  { key: 'llm',      label: 'LLM Diagnosis',       desc: 'Identifying root cause and affected code...' },
  { key: 'fix',      label: 'Fix Generation',       desc: 'Generating targeted code fix...' },
  { key: 'approval', label: 'Awaiting Approval',    desc: 'Sent to developer via Slack and WhatsApp...' },
  { key: 'done',     label: 'Resolved',             desc: 'Service rolled back and fix applied.' },
];

const STATUS_STEP = {
  detected:          0,
  diagnosing:        1,
  fix_proposed:      2,
  awaiting_approval: 3,
  resolved:          4,
};

export default function RCATopology() {
  const [rcaAlert,       setRcaAlert]       = useState(null);
  const [affectedNodes,  setAffectedNodes]  = useState(new Set());
  const [currentIncident,setCurrentIncident]= useState(null);
  const canvasRef  = useRef(null);
  const animRef    = useRef(null);
  const phaseRef   = useRef(0);

  useEffect(() => {
    socket.on('rca:update', (data) => {
      setRcaAlert(data);
      const aff = new Set();
      if (data.rootCauseNode)   aff.add(data.rootCauseNode);
      if (data.propagationPath) data.propagationPath.forEach(n => aff.add(n));
      setAffectedNodes(aff);
    });
    socket.on('rca:clear', () => { setRcaAlert(null); setAffectedNodes(new Set()); });

    socket.on('incident:detected',  (d) => setCurrentIncident({ ...d, status: 'detected' }));
    socket.on('incident:diagnosed', (d) => setCurrentIncident(prev =>
      prev?.id === d.id ? { ...prev, status: 'diagnosing', diagnosis: d.diagnosis, rcaOutput: d.rcaOutput } : prev
    ));
    socket.on('incident:fix_proposed', (d) => setCurrentIncident(prev =>
      prev?.id === d.id ? { ...prev, status: 'fix_proposed' } : prev
    ));
    socket.on('incident:resolved', (d) => setCurrentIncident(prev =>
      prev?.id === d.id ? { ...prev, status: 'resolved' } : prev
    ));

    return () => {
      socket.off('rca:update'); socket.off('rca:clear');
      socket.off('incident:detected'); socket.off('incident:diagnosed');
      socket.off('incident:fix_proposed'); socket.off('incident:resolved');
    };
  }, []);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const W = canvas.width, H = canvas.height;
    ctx.clearRect(0, 0, W, H);
    phaseRef.current += 0.025;
    const pulse = Math.sin(phaseRef.current) * 0.5 + 0.5;

    // Background
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(0, 0, W, H);

    // Edges
    EDGES.forEach(([from, to]) => {
      const a = SERVICES.find(s => s.id === from);
      const b = SERVICES.find(s => s.id === to);
      if (!a || !b) return;
      const affected = affectedNodes.has(from) && affectedNodes.has(to);
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.strokeStyle = affected
        ? `rgba(220,38,38,${0.35 + pulse * 0.45})`
        : 'rgba(148,163,184,0.3)';
      ctx.lineWidth = affected ? 2 : 1;
      ctx.stroke();
    });

    // Nodes
    SERVICES.forEach((svc) => {
      const aff  = affectedNodes.has(svc.id);
      const root = rcaAlert?.rootCauseNode === svc.id;
      const col  = TYPE_COLOR[svc.type] || '#0284c7';
      const R    = 26;

      // Glow ring for affected nodes
      if (aff) {
        const gr = ctx.createRadialGradient(svc.x, svc.y, R, svc.x, svc.y, R + 14 + pulse * 8);
        gr.addColorStop(0, root ? 'rgba(220,38,38,0.5)' : 'rgba(217,119,6,0.35)');
        gr.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.beginPath();
        ctx.arc(svc.x, svc.y, R + 14 + pulse * 8, 0, Math.PI * 2);
        ctx.fillStyle = gr;
        ctx.fill();
      }

      // Node fill
      ctx.beginPath();
      ctx.arc(svc.x, svc.y, R, 0, Math.PI * 2);
      ctx.fillStyle = root ? '#dc2626' : aff ? '#d97706' : '#ffffff';
      ctx.fill();
      ctx.strokeStyle = root ? '#fca5a5' : aff ? '#fcd34d' : col;
      ctx.lineWidth = root ? 3 : 2;
      ctx.stroke();

      // Status indicator dot (top-right of node)
      const dotX = svc.x + R * 0.7;
      const dotY = svc.y - R * 0.7;
      ctx.beginPath();
      ctx.arc(dotX, dotY, 5, 0, Math.PI * 2);
      ctx.fillStyle = root ? '#dc2626' : aff ? '#d97706' : '#16a34a';
      ctx.fill();

      // Label
      ctx.fillStyle = root || aff ? '#0f172a' : '#475569';
      ctx.font = `${root ? 'bold ' : ''}10px Inter, system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText(svc.label, svc.x, svc.y + R + 14);
    });

    animRef.current = requestAnimationFrame(draw);
  }, [affectedNodes, rcaAlert]);

  useEffect(() => {
    animRef.current = requestAnimationFrame(draw);
    return () => { if (animRef.current) cancelAnimationFrame(animRef.current); };
  }, [draw]);

  const stepIdx = currentIncident ? (STATUS_STEP[currentIncident.status] ?? 0) : -1;

  return (
    <div className="p-7 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-xl font-bold" style={{ color: 'var(--text-main)' }}>RCA Topology</h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--text-sub)' }}>
            Live service dependency graph with root-cause highlighting
          </p>
        </div>
        <span className={`px-3 py-1.5 rounded-full text-xs font-semibold border ${
          rcaAlert
            ? 'bg-red-50 text-red-700 border-red-200 pulse-dot'
            : 'bg-green-50 text-green-700 border-green-200'
        }`}>
          {rcaAlert ? 'Incident Active' : 'All Systems Healthy'}
        </span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 mb-5">
        {/* Canvas */}
        <div className="lg:col-span-2 bg-white rounded-xl border overflow-hidden" style={{ borderColor: 'var(--border)' }}>
          <canvas
            ref={canvasRef}
            width={880}
            height={520}
            className="w-full"
          />
        </div>

        {/* RCA Panel */}
        <div className="space-y-4">
          {rcaAlert ? (
            <div className="bg-white rounded-xl border p-5" style={{ borderColor: '#fca5a5' }}>
              <div className="flex items-center gap-2 mb-4">
                <div className="w-2 h-2 rounded-full bg-red-500 pulse-dot" />
                <span className="text-xs font-bold uppercase tracking-wider text-red-600">RCA Model Output</span>
              </div>
              <div className="space-y-4">
                <div>
                  <p className="text-[10px] uppercase font-semibold mb-0.5" style={{ color: 'var(--text-muted)' }}>Root Cause</p>
                  <p className="text-lg font-bold" style={{ color: 'var(--text-main)' }}>{rcaAlert.rootCauseNode}</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase font-semibold mb-1.5" style={{ color: 'var(--text-muted)' }}>Confidence</p>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-2 rounded-full" style={{ background: 'var(--border)' }}>
                      <div className="h-2 rounded-full bg-red-500 transition-all duration-700"
                        style={{ width: `${(rcaAlert.confidence * 100).toFixed(0)}%` }} />
                    </div>
                    <span className="text-base font-bold text-red-600">
                      {(rcaAlert.confidence * 100).toFixed(1)}%
                    </span>
                  </div>
                </div>
                {rcaAlert.propagationPath && (
                  <div>
                    <p className="text-[10px] uppercase font-semibold mb-1.5" style={{ color: 'var(--text-muted)' }}>Propagation Path</p>
                    <div className="flex flex-wrap gap-1">
                      {rcaAlert.propagationPath.map((n, i) => (
                        <React.Fragment key={n}>
                          <span className={`text-xs px-2 py-0.5 rounded font-mono ${i === 0 ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-600'}`}>
                            {n}
                          </span>
                          {i < rcaAlert.propagationPath.length - 1 && (
                            <span className="text-slate-300 self-center">→</span>
                          )}
                        </React.Fragment>
                      ))}
                    </div>
                  </div>
                )}
                <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                  {rcaAlert.model} — {rcaAlert.analysisTime || '1.2s'}
                </p>
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-xl border p-5 text-center" style={{ borderColor: 'var(--border)' }}>
              <CheckCircle className="w-8 h-8 mx-auto mb-2 text-green-500 opacity-60" />
              <p className="text-sm font-semibold" style={{ color: 'var(--text-sub)' }}>No Anomalies</p>
              <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>Monitoring all service nodes</p>
            </div>
          )}

          {/* Legend */}
          <div className="bg-white rounded-xl border p-4" style={{ borderColor: 'var(--border)' }}>
            <p className="text-[10px] font-bold uppercase tracking-wider mb-3" style={{ color: 'var(--text-muted)' }}>Legend</p>
            {[
              { color: 'bg-green-500',  label: 'Healthy',    desc: 'Operating normally' },
              { color: 'bg-red-500',    label: 'Root Cause', desc: 'Identified by RCA' },
              { color: 'bg-amber-500',  label: 'Affected',   desc: 'In propagation path' },
            ].map(({ color, label, desc }) => (
              <div key={label} className="flex items-center gap-2 mb-1.5">
                <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${color}`} />
                <span className="text-xs font-semibold w-20" style={{ color: 'var(--text-main)' }}>{label}</span>
                <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{desc}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Current Incident Process Timeline */}
      {currentIncident && (
        <div className="bg-white rounded-xl border p-5" style={{ borderColor: 'var(--border)' }}>
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider mb-0.5" style={{ color: 'var(--text-muted)' }}>
                Current Incident
              </p>
              <p className="font-semibold" style={{ color: 'var(--text-main)' }}>
                {currentIncident.id} — {currentIncident.service}
              </p>
            </div>
            <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
              currentIncident.status === 'resolved' ? 'bg-green-50 text-green-700' : 'bg-blue-50 text-blue-700'
            }`}>{currentIncident.status?.replace('_', ' ').toUpperCase()}</span>
          </div>

          <div className="flex items-start gap-0">
            {PROCESS_STEPS.map((step, i) => {
              const done   = i < stepIdx;
              const active = i === stepIdx;
              return (
                <React.Fragment key={step.key}>
                  <div className="flex flex-col items-center min-w-0" style={{ flex: 1 }}>
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold border-2 mb-2 transition-all ${
                      done   ? 'bg-blue-600 border-blue-600 text-white' :
                      active ? 'bg-white border-blue-600 text-blue-600 pulse-dot' :
                               'bg-white border-slate-200 text-slate-300'
                    }`}>
                      {done ? <CheckCircle className="w-4 h-4" /> : i + 1}
                    </div>
                    <p className={`text-[10px] font-bold text-center mb-0.5 ${active ? 'text-blue-600' : done ? 'text-slate-500' : 'text-slate-300'}`}>
                      {step.label}
                    </p>
                    {active && (
                      <p className="text-[9px] text-center leading-tight" style={{ color: 'var(--text-muted)' }}>
                        {currentIncident.diagnosis && i === 1
                          ? currentIncident.diagnosis.substring(0, 80) + '...'
                          : step.desc}
                      </p>
                    )}
                  </div>
                  {i < PROCESS_STEPS.length - 1 && (
                    <div className={`h-0.5 mt-4 mx-1 ${i < stepIdx ? 'bg-blue-600' : 'bg-slate-200'}`} style={{ flex: 1 }} />
                  )}
                </React.Fragment>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
