import React, { useEffect, useState } from 'react';
import { socket } from '../socket';
import MetricChart from '../components/MetricChart';
import { BarChart3 } from 'lucide-react';

const MAX_POINTS = 60; // 3 min at 3s intervals

function appendPoint(history, newPoint) {
  return [...history, newPoint].slice(-MAX_POINTS);
}

const Metrics = () => {
  const [rpsHistory,     setRpsHistory]     = useState([]);
  const [latencyHistory, setLatencyHistory] = useState([]);
  const [errorHistory,   setErrorHistory]   = useState([]);
  const [loginHistory,   setLoginHistory]   = useState([]);
  const [nodeCpuHistory, setNodeCpuHistory] = useState([]);
  const [nodeMemHistory, setNodeMemHistory] = useState([]);

  useEffect(() => {
    socket.on('metrics:update', (data) => {
      const now = new Date().toLocaleTimeString();

      setRpsHistory(prev => appendPoint(prev, {
        time: now,
        'req/s': parseFloat((data.rps || 0).toFixed(3))
      }));

      setLatencyHistory(prev => appendPoint(prev, {
        time: now,
        'P95 ms': parseFloat(((data.p95Latency || 0) * 1000).toFixed(1))
      }));

      setErrorHistory(prev => appendPoint(prev, {
        time: now,
        'errors/s': parseFloat((data.errorRate || 0).toFixed(4))
      }));

      setLoginHistory(prev => appendPoint(prev, {
        time: now,
        'logins/s': parseFloat((data.loginRate || 0).toFixed(4))
      }));

      // Per-node CPU %
      if (data.nodeCpu && data.nodeCpu.length > 0) {
        setNodeCpuHistory(prev => {
          const point = { time: now };
          data.nodeCpu.forEach(n => {
            const label = (n.pod || 'node').replace(/:\d+$/, '').split('.')[0];
            point[label] = parseFloat((n.value * 100).toFixed(1));
          });
          return appendPoint(prev, point);
        });
      }

      // Per-node Memory %
      if (data.nodeMemory && data.nodeMemory.length > 0) {
        setNodeMemHistory(prev => {
          const point = { time: now };
          data.nodeMemory.forEach(n => {
            const label = (n.pod || 'node').replace(/:\d+$/, '').split('.')[0];
            point[label] = parseFloat((n.value * 100).toFixed(1));
          });
          return appendPoint(prev, point);
        });
      }
    });

    return () => socket.off('metrics:update');
  }, []);

  const getKeys = (arr, exclude = ['time']) =>
    arr.length === 0 ? ['value'] : Object.keys(arr[arr.length - 1]).filter(k => !exclude.includes(k));

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8">
      <h1 className="text-3xl font-bold flex items-center gap-3">
        <BarChart3 className="text-blue-500 w-8 h-8" />
        Metrics Explorer
        <span className="text-sm text-slate-400 font-normal ml-2">— Live from Prometheus → EKS Cluster</span>
      </h1>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <MetricChart
          title="Requests per Second (aurcc-backend)"
          data={rpsHistory}
          dataKeys={getKeys(rpsHistory)}
          color="#3b82f6"
        />
        <MetricChart
          title="P95 Response Latency (ms)"
          data={latencyHistory}
          dataKeys={getKeys(latencyHistory)}
          color="#f59e0b"
        />
        <MetricChart
          title="Login Rate (logins/sec)"
          data={loginHistory}
          dataKeys={getKeys(loginHistory)}
          color="#10b981"
        />
        <MetricChart
          title="Error Rate (errors/sec)"
          data={errorHistory}
          dataKeys={getKeys(errorHistory)}
          color="#ef4444"
        />
        <MetricChart
          title="Node CPU Usage %"
          data={nodeCpuHistory}
          dataKeys={getKeys(nodeCpuHistory)}
        />
        <MetricChart
          title="Node Memory Usage %"
          data={nodeMemHistory}
          dataKeys={getKeys(nodeMemHistory)}
        />
      </div>
    </div>
  );
};

export default Metrics;
