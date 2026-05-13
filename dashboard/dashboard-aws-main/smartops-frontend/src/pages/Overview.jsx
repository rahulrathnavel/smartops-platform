import React, { useEffect, useState } from 'react';
import { socket } from '../socket';
import { Server, Activity, AlertTriangle, CheckCircle, Clock } from 'lucide-react';

function StatCard({ label, value, sub, color = '#2563eb', icon: Icon }) {
  return (
    <div className="bg-white rounded-xl border p-5 fadein" style={{ borderColor: 'var(--border)' }}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: 'var(--text-muted)' }}>{label}</p>
          <p className="text-3xl font-bold" style={{ color: 'var(--text-main)' }}>{value}</p>
          {sub && <p className="text-xs mt-1" style={{ color: 'var(--text-sub)' }}>{sub}</p>}
        </div>
        {Icon && (
          <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: color + '15' }}>
            <Icon className="w-5 h-5" style={{ color }} />
          </div>
        )}
      </div>
    </div>
  );
}

function PodRow({ pod }) {
  const running = pod.status === 'Running';
  return (
    <div className="flex items-center justify-between py-2.5 border-b last:border-0" style={{ borderColor: 'var(--border)' }}>
      <div className="flex items-center gap-3">
        <span className={`w-2 h-2 rounded-full flex-shrink-0 ${running ? 'bg-green-500' : 'bg-amber-500'}`} />
        <span className="text-sm font-mono" style={{ color: 'var(--text-main)' }}>{pod.name}</span>
      </div>
      <div className="flex items-center gap-4 text-xs" style={{ color: 'var(--text-muted)' }}>
        <span>{pod.namespace}</span>
        <span className={`px-2 py-0.5 rounded font-semibold ${running ? 'bg-green-50 text-green-700' : 'bg-amber-50 text-amber-700'}`}>
          {pod.status}
        </span>
      </div>
    </div>
  );
}

export default function Overview() {
  const [cluster, setCluster]     = useState({ pods: [], nodes: [] });
  const [incidents, setIncidents] = useState([]);
  const [lastUpdate, setLastUpdate] = useState(null);

  useEffect(() => {
    socket.on('cluster:update', (data) => {
      setCluster(data);
      setLastUpdate(new Date());
    });
    socket.on('incident:detected', (data) => setIncidents(prev => [data, ...prev]));
    socket.on('incident:resolved', (data) => setIncidents(prev =>
      prev.map(i => i.id === data.id ? { ...i, status: 'resolved' } : i)
    ));
    return () => {
      socket.off('cluster:update');
      socket.off('incident:detected');
      socket.off('incident:resolved');
    };
  }, []);

  const pods        = cluster.pods || [];
  const nodes       = cluster.nodes || [];
  const running     = pods.filter(p => p.status === 'Running').length;
  const total       = pods.length;
  const healthy     = total > 0 && running === total;
  const activeInc   = incidents.filter(i => i.status !== 'resolved').length;
  const readyNodes  = nodes.filter(n => n.status === 'Ready').length;

  return (
    <div className="p-7 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold" style={{ color: 'var(--text-main)' }}>Overview</h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--text-sub)' }}>
            Real-time EKS cluster state
            {lastUpdate && ` — updated ${lastUpdate.toLocaleTimeString()}`}
          </p>
        </div>
        <span className={`px-3 py-1.5 rounded-full text-xs font-semibold border ${
          healthy ? 'bg-green-50 text-green-700 border-green-200' : 'bg-amber-50 text-amber-700 border-amber-200'
        }`}>
          {healthy ? 'All Systems Operational' : total === 0 ? 'Connecting...' : 'Degraded'}
        </span>
      </div>

      {/* KPI grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-7">
        <StatCard label="Running Pods" value={`${running} / ${total}`}
          sub={total === 0 ? 'Waiting for data...' : `${total - running} not running`}
          color="#2563eb" icon={Server} />
        <StatCard label="Ready Nodes" value={`${readyNodes} / ${nodes.length}`}
          sub="EKS worker nodes"
          color="#16a34a" icon={Activity} />
        <StatCard label="Active Incidents" value={activeInc}
          sub={activeInc === 0 ? 'No active issues' : 'Awaiting resolution'}
          color={activeInc > 0 ? '#dc2626' : '#16a34a'} icon={AlertTriangle} />
        <StatCard label="Total Detected" value={incidents.length}
          sub="Since agent started"
          color="#7c3aed" icon={Clock} />
      </div>

      {/* Two-column: pods + recent incidents */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

        {/* Pod list */}
        <div className="bg-white rounded-xl border" style={{ borderColor: 'var(--border)' }}>
          <div className="px-5 py-3.5 border-b flex items-center justify-between" style={{ borderColor: 'var(--border)' }}>
            <span className="text-sm font-semibold" style={{ color: 'var(--text-main)' }}>Pod Status</span>
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{total} pods</span>
          </div>
          <div className="px-5 py-2 max-h-72 overflow-y-auto">
            {pods.length === 0 ? (
              <p className="text-sm py-6 text-center" style={{ color: 'var(--text-muted)' }}>
                Waiting for cluster data...
              </p>
            ) : pods.slice(0, 20).map((p, i) => <PodRow key={i} pod={p} />)}
          </div>
        </div>

        {/* Recent incidents */}
        <div className="bg-white rounded-xl border" style={{ borderColor: 'var(--border)' }}>
          <div className="px-5 py-3.5 border-b flex items-center justify-between" style={{ borderColor: 'var(--border)' }}>
            <span className="text-sm font-semibold" style={{ color: 'var(--text-main)' }}>Recent Incidents</span>
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{incidents.length} total</span>
          </div>
          <div className="px-5 py-2 max-h-72 overflow-y-auto">
            {incidents.length === 0 ? (
              <div className="py-8 text-center">
                <CheckCircle className="w-8 h-8 mx-auto mb-2 text-green-500 opacity-60" />
                <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No incidents detected</p>
              </div>
            ) : incidents.slice(0, 10).map((inc, i) => (
              <div key={i} className="py-2.5 border-b last:border-0 fadein" style={{ borderColor: 'var(--border)' }}>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono font-semibold" style={{ color: 'var(--brand)' }}>{inc.id}</span>
                  <span className={`text-xs px-2 py-0.5 rounded font-semibold ${
                    inc.status === 'resolved'
                      ? 'bg-green-50 text-green-700'
                      : 'bg-red-50 text-red-700'
                  }`}>{inc.status || 'active'}</span>
                </div>
                <p className="text-xs mt-0.5" style={{ color: 'var(--text-sub)' }}>
                  {inc.service} — {inc.timestamp ? new Date(inc.timestamp).toLocaleTimeString() : ''}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
