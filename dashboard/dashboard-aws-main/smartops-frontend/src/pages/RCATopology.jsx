import React, { useEffect, useState, useRef, useCallback } from 'react';
import { socket } from '../socket';
import { Cpu, Activity, Shield } from 'lucide-react';

// ---------------------------------------------------------------------------
// Service topology definition — nodes and edges
// ---------------------------------------------------------------------------
const SERVICES = [
  { id: 'frontend',        label: 'Frontend',        x: 400, y: 60,  type: 'frontend' },
  { id: 'api-gateway',     label: 'API Gateway',     x: 400, y: 160, type: 'gateway'  },
  { id: 'user-service',    label: 'User Service',    x: 150, y: 280, type: 'service'  },
  { id: 'catalog-service', label: 'Catalog Service', x: 320, y: 280, type: 'service'  },
  { id: 'cart-service',    label: 'Cart Service',    x: 490, y: 280, type: 'service'  },
  { id: 'payment-service', label: 'Payment Service', x: 620, y: 280, type: 'service'  },
  { id: 'order-service',   label: 'Order Service',   x: 750, y: 280, type: 'service'  },
  { id: 'redis',           label: 'Redis',           x: 490, y: 400, type: 'infra'    },
  { id: 'rabbitmq',        label: 'RabbitMQ',        x: 680, y: 400, type: 'infra'    },
  { id: 'cosmosdb',        label: 'Azure Cosmos DB', x: 250, y: 400, type: 'database' },
  { id: 'dynamodb',        label: 'AWS DynamoDB',    x: 620, y: 480, type: 'database' },
];

const EDGES = [
  { from: 'frontend', to: 'api-gateway' },
  { from: 'api-gateway', to: 'user-service' },
  { from: 'api-gateway', to: 'catalog-service' },
  { from: 'api-gateway', to: 'cart-service' },
  { from: 'api-gateway', to: 'payment-service' },
  { from: 'api-gateway', to: 'order-service' },
  { from: 'user-service', to: 'cosmosdb' },
  { from: 'catalog-service', to: 'cosmosdb' },
  { from: 'cart-service', to: 'redis' },
  { from: 'order-service', to: 'rabbitmq' },
  { from: 'order-service', to: 'cosmosdb' },
  { from: 'payment-service', to: 'rabbitmq' },
  { from: 'payment-service', to: 'dynamodb' },
  { from: 'cart-service', to: 'rabbitmq' },
];

const typeColors = {
  frontend: { normal: '#3b82f6', bg: '#1e3a5f' },
  gateway:  { normal: '#8b5cf6', bg: '#3b1f6e' },
  service:  { normal: '#10b981', bg: '#064e3b' },
  infra:    { normal: '#f59e0b', bg: '#78350f' },
  database: { normal: '#06b6d4', bg: '#164e63' },
};

const RCATopology = () => {
  const [rcaAlert, setRcaAlert] = useState(null);
  const [affectedNodes, setAffectedNodes] = useState(new Set());
  const canvasRef = useRef(null);
  const animFrameRef = useRef(null);
  const pulseRef = useRef(0);

  useEffect(() => {
    socket.on('rca:update', (data) => {
      setRcaAlert(data);
      const affected = new Set();
      if (data.rootCauseNode) affected.add(data.rootCauseNode);
      if (data.propagationPath) data.propagationPath.forEach(n => affected.add(n));
      setAffectedNodes(affected);
    });

    socket.on('rca:clear', () => {
      setRcaAlert(null);
      setAffectedNodes(new Set());
    });

    return () => {
      socket.off('rca:update');
      socket.off('rca:clear');
    };
  }, []);

  const drawGraph = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const w = canvas.width;
    const h = canvas.height;

    ctx.clearRect(0, 0, w, h);
    pulseRef.current += 0.03;
    const pulse = Math.sin(pulseRef.current) * 0.5 + 0.5;

    // Draw edges
    EDGES.forEach(({ from, to }) => {
      const fromNode = SERVICES.find(s => s.id === from);
      const toNode = SERVICES.find(s => s.id === to);
      if (!fromNode || !toNode) return;

      const isAffectedEdge = affectedNodes.has(from) && affectedNodes.has(to);
      ctx.beginPath();
      ctx.moveTo(fromNode.x, fromNode.y);
      ctx.lineTo(toNode.x, toNode.y);
      ctx.strokeStyle = isAffectedEdge ? `rgba(239, 68, 68, ${0.4 + pulse * 0.4})` : 'rgba(148, 163, 184, 0.15)';
      ctx.lineWidth = isAffectedEdge ? 2.5 : 1;
      ctx.stroke();
    });

    // Draw nodes
    SERVICES.forEach((svc) => {
      const isAffected = affectedNodes.has(svc.id);
      const isRootCause = rcaAlert?.rootCauseNode === svc.id;
      const colors = typeColors[svc.type] || typeColors.service;
      const radius = 28;

      // Glow for affected nodes
      if (isAffected) {
        const glowRadius = radius + 8 + pulse * 6;
        const gradient = ctx.createRadialGradient(svc.x, svc.y, radius, svc.x, svc.y, glowRadius);
        gradient.addColorStop(0, isRootCause ? 'rgba(239, 68, 68, 0.6)' : 'rgba(251, 191, 36, 0.4)');
        gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.beginPath();
        ctx.arc(svc.x, svc.y, glowRadius, 0, Math.PI * 2);
        ctx.fillStyle = gradient;
        ctx.fill();
      }

      // Node circle
      ctx.beginPath();
      ctx.arc(svc.x, svc.y, radius, 0, Math.PI * 2);
      ctx.fillStyle = isRootCause ? '#ef4444' : isAffected ? '#f59e0b' : colors.bg;
      ctx.fill();
      ctx.strokeStyle = isRootCause ? '#fca5a5' : isAffected ? '#fcd34d' : colors.normal;
      ctx.lineWidth = isRootCause ? 3 : 2;
      ctx.stroke();

      // Healthy heartbeat for non-affected
      if (!isAffected) {
        const heartbeat = Math.sin(pulseRef.current * 2 + SERVICES.indexOf(svc)) * 0.3 + 0.7;
        ctx.beginPath();
        ctx.arc(svc.x, svc.y, radius + 2, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(${hexToRgb(colors.normal)}, ${heartbeat * 0.3})`;
        ctx.lineWidth = 1;
        ctx.stroke();
      }

      // Label
      ctx.fillStyle = '#e2e8f0';
      ctx.font = '11px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(svc.label, svc.x, svc.y + radius + 18);

      // Status icon
      ctx.font = '14px sans-serif';
      ctx.fillText(isRootCause ? '🔴' : isAffected ? '🟡' : '🟢', svc.x, svc.y + 5);
    });

    animFrameRef.current = requestAnimationFrame(drawGraph);
  }, [affectedNodes, rcaAlert]);

  useEffect(() => {
    animFrameRef.current = requestAnimationFrame(drawGraph);
    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [drawGraph]);

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold flex items-center gap-3">
          <Activity className="text-cyan-500 w-8 h-8" />
          Service Topology — RCA Model
        </h1>
        <div className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold border ${
          rcaAlert
            ? 'bg-rose-500/10 text-rose-400 border-rose-500/30 animate-pulse'
            : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
        }`}>
          <Shield className="w-4 h-4" />
          {rcaAlert ? 'INCIDENT ACTIVE' : 'ALL SYSTEMS HEALTHY'}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Topology Canvas */}
        <div className="lg:col-span-2 bg-slate-800/50 rounded-xl border border-slate-700 p-4">
          <canvas
            ref={canvasRef}
            width={880}
            height={540}
            className="w-full rounded-lg"
            style={{ background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)' }}
          />
        </div>

        {/* RCA Panel */}
        <div className="space-y-4">
          {rcaAlert ? (
            <div className="bg-slate-800/80 rounded-xl border border-rose-500/30 shadow-lg shadow-rose-500/10 p-6">
              <div className="flex items-center gap-2 mb-4">
                <Cpu className="w-5 h-5 text-rose-400" />
                <h3 className="font-bold text-rose-400 uppercase tracking-wider text-sm">RCA Model Diagnosis</h3>
              </div>

              <div className="space-y-4">
                <div>
                  <span className="text-xs text-slate-500 uppercase">Root Cause Node</span>
                  <p className="text-2xl font-bold text-white">{rcaAlert.rootCauseNode}</p>
                </div>

                <div>
                  <span className="text-xs text-slate-500 uppercase">Confidence Score</span>
                  <div className="flex items-center gap-3 mt-1">
                    <div className="flex-1 h-3 bg-slate-700 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-rose-500 to-amber-500 rounded-full transition-all duration-1000"
                        style={{ width: `${(rcaAlert.confidence * 100)}%` }}
                      />
                    </div>
                    <span className="text-lg font-bold text-amber-400">
                      {(rcaAlert.confidence * 100).toFixed(1)}%
                    </span>
                  </div>
                </div>

                <div>
                  <span className="text-xs text-slate-500 uppercase">Model</span>
                  <p className="text-sm text-slate-300">{rcaAlert.model}</p>
                </div>

                {rcaAlert.propagationPath && (
                  <div>
                    <span className="text-xs text-slate-500 uppercase">Propagation Path</span>
                    <div className="flex items-center gap-1 mt-1 flex-wrap">
                      {rcaAlert.propagationPath.map((node, i) => (
                        <React.Fragment key={node}>
                          <span className={`px-2 py-1 rounded text-xs font-mono ${
                            i === 0 ? 'bg-rose-500/20 text-rose-300' : 'bg-slate-700 text-slate-300'
                          }`}>{node}</span>
                          {i < rcaAlert.propagationPath.length - 1 && (
                            <span className="text-slate-600">→</span>
                          )}
                        </React.Fragment>
                      ))}
                    </div>
                  </div>
                )}

                {rcaAlert.evidenceMetrics && (
                  <div>
                    <span className="text-xs text-slate-500 uppercase">Evidence Metrics</span>
                    <div className="mt-1 space-y-1">
                      {Object.entries(rcaAlert.evidenceMetrics).map(([k, v]) => (
                        <div key={k} className="flex justify-between text-xs">
                          <span className="text-slate-400">{k}</span>
                          <span className="text-slate-200 font-mono">{v}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="text-xs text-slate-500 pt-2 border-t border-slate-700">
                  Analysis completed in {rcaAlert.analysisTime || '1.2s'}
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-slate-800/50 rounded-xl border border-emerald-500/20 p-6 text-center">
              <Shield className="w-12 h-12 text-emerald-500 mx-auto mb-3 opacity-50" />
              <p className="text-emerald-400 font-semibold">No Active Anomalies</p>
              <p className="text-xs text-slate-500 mt-1">RCA Model is monitoring all service nodes</p>
            </div>
          )}

          {/* Legend */}
          <div className="bg-slate-800/50 rounded-xl border border-slate-700 p-4">
            <h4 className="text-xs font-bold text-slate-400 uppercase mb-3">Legend</h4>
            <div className="space-y-2 text-xs">
              {[
                { emoji: '🟢', label: 'Healthy', desc: 'Service operating normally' },
                { emoji: '🔴', label: 'Root Cause', desc: 'Identified by RCA model' },
                { emoji: '🟡', label: 'Affected', desc: 'In propagation path' },
              ].map(({ emoji, label, desc }) => (
                <div key={label} className="flex items-center gap-2">
                  <span>{emoji}</span>
                  <span className="text-slate-300 font-semibold w-20">{label}</span>
                  <span className="text-slate-500">{desc}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

function hexToRgb(hex) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `${r}, ${g}, ${b}`;
}

export default RCATopology;
