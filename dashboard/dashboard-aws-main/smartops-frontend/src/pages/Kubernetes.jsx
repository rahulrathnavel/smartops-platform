import React, { useEffect, useState } from 'react';
import { socket } from '../socket';
import { Server, Box, Layers, Globe, Activity } from 'lucide-react';
import StatusBadge from '../components/StatusBadge';

const Kubernetes = () => {
  const [cluster, setCluster] = useState({
    pods: [], nodes: [], deployments: [], services: [], events: []
  });

  useEffect(() => {
    socket.on('cluster:update', setCluster);
    return () => socket.off('cluster:update');
  }, []);

  const TableHeader = ({ children }) => (
    <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider border-b border-slate-700 bg-slate-800/50">
      {children}
    </th>
  );

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8">
      <h1 className="text-3xl font-bold flex items-center gap-3">
        <Box className="text-blue-500 w-8 h-8" />
        Kubernetes State
      </h1>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Pods Table */}
        <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden shadow-lg">
          <div className="p-4 border-b border-slate-700 flex items-center gap-2">
            <Server className="w-5 h-5 text-indigo-400" />
            <h2 className="font-semibold text-slate-200">Pods</h2>
          </div>
          <div className="overflow-x-auto max-h-96">
            <table className="w-full text-sm">
              <thead>
                <tr>
                  <TableHeader>Name</TableHeader>
                  <TableHeader>Status</TableHeader>
                  <TableHeader>Restarts</TableHeader>
                  <TableHeader>Node</TableHeader>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700">
                {(cluster.pods || []).map((pod, i) => (
                  <tr key={i} className="hover:bg-slate-700/50">
                    <td className="px-4 py-3 text-slate-300 font-mono text-xs">{pod.name}</td>
                    <td className="px-4 py-3"><StatusBadge status={pod.status} /></td>
                    <td className="px-4 py-3 text-slate-400">{pod.restarts}</td>
                    <td className="px-4 py-3 text-slate-500 text-xs">{pod.node}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Nodes Table */}
        <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden shadow-lg">
          <div className="p-4 border-b border-slate-700 flex items-center gap-2">
            <Layers className="w-5 h-5 text-emerald-400" />
            <h2 className="font-semibold text-slate-200">Nodes</h2>
          </div>
          <div className="overflow-x-auto max-h-96">
            <table className="w-full text-sm">
              <thead>
                <tr>
                  <TableHeader>Name</TableHeader>
                  <TableHeader>Status</TableHeader>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700">
                {(cluster.nodes || []).map((node, i) => (
                  <tr key={i} className="hover:bg-slate-700/50">
                    <td className="px-4 py-3 text-slate-300 font-mono text-xs">{node.name}</td>
                    <td className="px-4 py-3"><StatusBadge status={node.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Deployments & Services */}
        <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden shadow-lg lg:col-span-2 grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-slate-700">
          <div>
            <div className="p-4 border-b border-slate-700 flex items-center gap-2">
              <Box className="w-5 h-5 text-purple-400" />
              <h2 className="font-semibold text-slate-200">Deployments</h2>
            </div>
            <div className="overflow-x-auto max-h-64">
              <table className="w-full text-sm">
                <thead>
                  <tr>
                    <TableHeader>Name</TableHeader>
                    <TableHeader>Replicas (Ready / Total)</TableHeader>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700">
                  {(cluster.deployments || []).map((dep, i) => (
                    <tr key={i} className="hover:bg-slate-700/50">
                      <td className="px-4 py-3 text-slate-300 font-mono text-xs">{dep.name}</td>
                      <td className="px-4 py-3 text-slate-400">{dep.readyReplicas} / {dep.replicas}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <div>
            <div className="p-4 border-b border-slate-700 flex items-center gap-2">
              <Globe className="w-5 h-5 text-cyan-400" />
              <h2 className="font-semibold text-slate-200">Services</h2>
            </div>
            <div className="overflow-x-auto max-h-64">
              <table className="w-full text-sm">
                <thead>
                  <tr>
                    <TableHeader>Name</TableHeader>
                    <TableHeader>Type</TableHeader>
                    <TableHeader>Cluster IP</TableHeader>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700">
                  {(cluster.services || []).map((svc, i) => (
                    <tr key={i} className="hover:bg-slate-700/50">
                      <td className="px-4 py-3 text-slate-300 font-mono text-xs">{svc.name}</td>
                      <td className="px-4 py-3 text-slate-400">{svc.type}</td>
                      <td className="px-4 py-3 text-slate-500 font-mono text-xs">{svc.clusterIP}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Events */}
        <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden shadow-lg lg:col-span-2">
          <div className="p-4 border-b border-slate-700 flex items-center gap-2">
            <Activity className="w-5 h-5 text-rose-400" />
            <h2 className="font-semibold text-slate-200">Recent Events</h2>
          </div>
          <div className="p-4 max-h-64 overflow-y-auto space-y-3">
            {(cluster.events || []).slice().reverse().map((event, i) => (
              <div key={i} className="bg-slate-900/50 p-3 rounded border border-slate-700/50 flex flex-col gap-1">
                <div className="flex justify-between items-center">
                  <span className={`text-xs font-bold px-2 py-0.5 rounded ${event.reason.includes('Failed') || event.reason.includes('Err') ? 'bg-rose-500/20 text-rose-400' : 'bg-slate-700 text-slate-300'}`}>
                    {event.reason}
                  </span>
                  <span className="text-xs text-slate-500">{new Date(event.timestamp).toLocaleString()}</span>
                </div>
                <div className="text-sm text-slate-300">{event.message}</div>
                <div className="text-xs text-slate-500 font-mono">Object: {event.involvedObject}</div>
              </div>
            ))}
            {(!cluster.events || cluster.events.length === 0) && (
              <div className="text-slate-500 text-center py-4">No recent events</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Kubernetes;
