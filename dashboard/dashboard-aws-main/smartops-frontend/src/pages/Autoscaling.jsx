import React, { useEffect, useState } from 'react';
import { socket } from '../socket';
import MetricChart from '../components/MetricChart';
import { TrendingUp } from 'lucide-react';

const Autoscaling = () => {
  const [cluster, setCluster] = useState({ hpas: [] });
  const [scalingEvents, setScalingEvents] = useState([]);
  const [replicaHistory, setReplicaHistory] = useState([]);

  useEffect(() => {
    socket.on('cluster:update', (data) => {
      setCluster(data);
      if (data.hpas && data.hpas.length > 0) {
        const hpa = data.hpas[0];
        setReplicaHistory(prev => {
          const now = new Date().toLocaleTimeString();
          const newPoint = {
            time: now,
            current: hpa.currentReplicas,
            desired: hpa.desiredReplicas
          };
          return [...prev, newPoint].slice(-60);
        });
      }
    });

    socket.on('scaling:event', (payload) => {
      setScalingEvents(prev => [payload, ...prev].slice(0, 20));
    });

    return () => {
      socket.off('cluster:update');
      socket.off('scaling:event');
    };
  }, []);

  const TableHeader = ({ children }) => (
    <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider border-b border-slate-700 bg-slate-800/50">
      {children}
    </th>
  );

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8">
      <h1 className="text-3xl font-bold flex items-center gap-3">
        <TrendingUp className="text-blue-500 w-8 h-8" />
        Autoscaling (HPA)
      </h1>

      <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden shadow-lg">
        <div className="p-4 border-b border-slate-700 flex items-center gap-2 bg-slate-800/50">
          <h2 className="font-semibold text-slate-200">HPA Status</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr>
                <TableHeader>Name</TableHeader>
                <TableHeader>Current / Desired Replicas</TableHeader>
                <TableHeader>Min / Max Replicas</TableHeader>
                <TableHeader>CPU % (Current / Target)</TableHeader>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700">
              {(cluster.hpas || []).map((hpa, i) => (
                <tr key={i} className="hover:bg-slate-700/50">
                  <td className="px-4 py-4 text-slate-300 font-mono text-sm">{hpa.name}</td>
                  <td className="px-4 py-4">
                    <span className="text-lg font-bold text-white">{hpa.currentReplicas}</span>
                    <span className="text-slate-400 mx-2">/</span>
                    <span className="text-lg font-bold text-blue-400">{hpa.desiredReplicas}</span>
                  </td>
                  <td className="px-4 py-4 text-slate-400">{hpa.minReplicas} / {hpa.maxReplicas}</td>
                  <td className="px-4 py-4">
                    <div className="flex items-center gap-2">
                      <div className="w-32 h-2 bg-slate-700 rounded-full overflow-hidden">
                        <div 
                          className={`h-full ${hpa.currentCPUPercent > hpa.targetCPUPercent ? 'bg-rose-500' : 'bg-emerald-500'}`} 
                          style={{ width: `${Math.min(100, (hpa.currentCPUPercent / Math.max(1, hpa.targetCPUPercent)) * 100)}%` }}
                        ></div>
                      </div>
                      <span className="text-slate-300">{hpa.currentCPUPercent}% / {hpa.targetCPUPercent}%</span>
                    </div>
                  </td>
                </tr>
              ))}
              {(!cluster.hpas || cluster.hpas.length === 0) && (
                <tr>
                  <td colSpan="4" className="px-4 py-8 text-center text-slate-500">No HPAs configured</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <MetricChart 
          title="Replica Count Over Time" 
          data={replicaHistory} 
          dataKeys={['current', 'desired']} 
        />

        <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden shadow-lg flex flex-col h-80">
          <div className="p-4 border-b border-slate-700 bg-slate-800/50 shrink-0">
            <h3 className="font-semibold text-slate-200">Scaling Events</h3>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {scalingEvents.length === 0 ? (
              <div className="text-slate-500 text-center py-4 italic">Waiting for scaling events...</div>
            ) : (
              scalingEvents.map((event, i) => (
                <div key={i} className="bg-slate-900/50 p-3 rounded border border-slate-700/50">
                  <div className="flex justify-between items-center mb-2">
                    <span className={`text-xs font-bold px-2 py-1 rounded uppercase tracking-wider ${event.type === 'scale-up' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400'}`}>
                      {event.type}
                    </span>
                    <span className="text-xs text-slate-500">{new Date(event.timestamp).toLocaleTimeString()}</span>
                  </div>
                  <div className="text-sm text-slate-300 mb-1">{event.reason}</div>
                  <div className="text-xs text-slate-400">
                    Replicas: <span className="font-mono text-white">{event.fromReplicas}</span> → <span className="font-mono text-white">{event.toReplicas}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Autoscaling;
