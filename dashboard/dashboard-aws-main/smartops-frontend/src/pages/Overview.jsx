import React, { useEffect, useState } from 'react';
import { socket } from '../socket';
import LiveCard from '../components/LiveCard';
import { Activity, Users, AlertTriangle, Zap, Server, Shield, TrendingUp, Wifi } from 'lucide-react';

const Overview = () => {
  const [cluster, setCluster] = useState({ pods: [], nodes: [], hpas: [] });
  const [metrics, setMetrics] = useState({});
  const [traffic, setTraffic] = useState({ activeUsers: 0, rps: 0, topEndpoints: [] });
  const [loginFeed, setLoginFeed] = useState([]);
  const [wsConnected, setWsConnected] = useState(socket.connected);

  useEffect(() => {
    socket.on('connect', () => setWsConnected(true));
    socket.on('disconnect', () => setWsConnected(false));
    socket.on('cluster:update', setCluster);
    socket.on('metrics:update', setMetrics);
    socket.on('traffic:update', (data) => {
      setTraffic(data);
    });
    socket.on('login:event', (payload) => {
      setLoginFeed(prev => [payload, ...prev].slice(0, 10));
    });

    return () => {
      socket.off('connect');
      socket.off('disconnect');
      socket.off('cluster:update');
      socket.off('metrics:update');
      socket.off('traffic:update');
      socket.off('login:event');
    };
  }, []);

  const totalPods = cluster.pods?.length || 0;
  const runningPods = cluster.pods?.filter(p => p.status === 'Running').length || 0;
  const isHealthy = totalPods > 0 && runningPods === totalPods;

  const hpa = cluster.hpas?.[0];
  const replicasStr = hpa ? `${hpa.currentReplicas} / ${hpa.desiredReplicas}` : 'N/A';

  const rps = (metrics.rps || traffic.rps || 0).toFixed(2);
  const activeUsers = metrics.activeConnections || traffic.activeUsers || 0;
  const errorRate = (metrics.errorRate || 0).toFixed(4);
  const p95ms = ((metrics.p95Latency || 0) * 1000).toFixed(0);
  const loginRate = ((metrics.loginRate || 0) * 60).toFixed(2); // per minute

  const topEndpoints = traffic.topEndpoints || [];

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-bold flex items-center gap-3">
          <Activity className="text-blue-500 w-8 h-8" />
          SmartOps Overview
        </h1>
        <div className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold border ${wsConnected ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' : 'bg-rose-500/10 text-rose-400 border-rose-500/30'}`}>
          <Wifi className="w-4 h-4" />
          {wsConnected ? 'LIVE — Connected to EKS' : 'WebSocket Offline'}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
        <LiveCard title="Cluster Status"   value={isHealthy ? 'Healthy' : totalPods === 0 ? 'Connecting...' : 'Degraded'} icon={Shield} trend={isHealthy ? 'up' : 'down'} />
        <LiveCard title="Running Pods"     value={`${runningPods} / ${totalPods}`} icon={Server} />
        <LiveCard title="Requests / sec"   value={rps} unit="req/s" icon={Activity} trend="up" />
        <LiveCard title="Active Sessions"  value={activeUsers} icon={Users} trend="up" />
        <LiveCard title="Login Rate"       value={loginRate} unit="logins/min" icon={TrendingUp} />
        <LiveCard title="P95 Latency"      value={p95ms} unit="ms" icon={Zap} />
        <LiveCard title="Error Rate"       value={errorRate} unit="err/s" icon={AlertTriangle} trend={(metrics.errorRate || 0) > 0.01 ? 'down' : 'up'} />
        <LiveCard title="HPA Replicas"     value={replicasStr} icon={Activity} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Endpoints */}
        <div className="bg-slate-800 rounded-xl border border-slate-700 shadow-lg overflow-hidden">
          <div className="p-4 border-b border-slate-700 bg-slate-800/60">
            <h3 className="font-semibold text-slate-200">Top Endpoints (last 5s)</h3>
          </div>
          <div className="p-4 space-y-3">
            {topEndpoints.length === 0 ? (
              <p className="text-slate-500 text-center py-4 italic">Waiting for traffic data...</p>
            ) : topEndpoints.map((ep, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="w-full">
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-slate-300 font-mono">{ep.path}</span>
                    <span className="text-slate-400">{(ep.count || 0).toFixed(2)} req/s</span>
                  </div>
                  <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-blue-500 rounded-full transition-all duration-500"
                      style={{ width: `${Math.min(100, ((ep.count || 0) / Math.max(...topEndpoints.map(e => e.count || 0.001))) * 100)}%` }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Live Login Events */}
        <div className="bg-slate-800 rounded-xl border border-slate-700 shadow-lg overflow-hidden">
          <div className="p-4 border-b border-slate-700 bg-slate-800/60">
            <h3 className="font-semibold text-slate-200">Live Login Events (Kafka)</h3>
          </div>
          <div className="p-4 max-h-60 overflow-y-auto space-y-3">
            {loginFeed.length === 0 ? (
              <p className="text-slate-500 text-center py-4 italic">
                Waiting for login events via Kafka stream...
                <br/>
                <span className="text-xs mt-1 block">Login counts tracked via Prometheus while Kafka is warming up.</span>
              </p>
            ) : loginFeed.map((event, i) => (
              <div key={i} className="flex justify-between items-center bg-slate-900/50 p-3 rounded-lg border border-slate-700/50">
                <div className="flex gap-4">
                  <span className="text-blue-400 font-mono text-sm">{event.registrationNo}</span>
                  <span className="text-slate-400 text-sm">{event.department}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-slate-500">{new Date(event.timestamp).toLocaleTimeString()}</span>
                  <span className={`px-2 py-0.5 rounded text-xs font-bold ${event.status === 'SUCCESS' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'}`}>
                    {event.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Overview;
