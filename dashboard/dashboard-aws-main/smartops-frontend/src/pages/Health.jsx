import React, { useEffect, useState } from 'react';
import { socket } from '../socket';
import { ShieldCheck, Server, Database, Network, Cloud, Activity } from 'lucide-react';
import StatusBadge from '../components/StatusBadge';

const Health = () => {
  const [health, setHealth] = useState({
    kubernetes: false,
    prometheus: false,
    kafka: false,
    cloudwatch: false,
    websocket: false
  });
  const [lastUpdated, setLastUpdated] = useState(null);

  useEffect(() => {
    // Initial WS connection state
    setHealth(prev => ({ ...prev, websocket: socket.connected }));

    socket.on('connect', () => setHealth(prev => ({ ...prev, websocket: true })));
    socket.on('disconnect', () => setHealth(prev => ({ ...prev, websocket: false })));

    socket.on('health:status', (status) => {
      setHealth(prev => ({ ...prev, ...status, websocket: socket.connected }));
      setLastUpdated(new Date());
    });

    return () => {
      socket.off('connect');
      socket.off('disconnect');
      socket.off('health:status');
    };
  }, []);

  const ServiceCard = ({ title, status, icon: Icon, errorMsg }) => (
    <div className="bg-slate-800 p-6 rounded-xl border border-slate-700 shadow-lg flex flex-col items-center justify-center text-center gap-4 relative overflow-hidden group">
      <div className={`absolute top-0 w-full h-1 ${status ? 'bg-emerald-500' : 'bg-rose-500'}`}></div>
      <div className={`p-4 rounded-full ${status ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'}`}>
        <Icon className="w-8 h-8" />
      </div>
      <div>
        <h3 className="font-bold text-slate-200 text-lg mb-2">{title}</h3>
        <StatusBadge 
          status={status ? 'CONNECTED' : 'DISCONNECTED'} 
          text={status ? 'CONNECTED' : 'DISCONNECTED'}
        />
      </div>
      {!status && errorMsg && (
        <div className="text-xs text-rose-400 mt-2 px-2 py-1 bg-rose-500/10 rounded border border-rose-500/20">
          {errorMsg}
        </div>
      )}
      <div className="text-xs text-slate-500 mt-2">
        Last checked: {lastUpdated ? lastUpdated.toLocaleTimeString() : 'Waiting...'}
      </div>
    </div>
  );

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8">
      <div className="flex justify-between items-end mb-8">
        <h1 className="text-3xl font-bold flex items-center gap-3">
          <ShieldCheck className="text-blue-500 w-8 h-8" />
          Connection Health
        </h1>
        {lastUpdated && (
          <div className="text-sm text-slate-400 flex items-center gap-2">
            <Activity className="w-4 h-4 text-emerald-400 animate-pulse" />
            Live tracking active
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6">
        <ServiceCard 
          title="WebSocket" 
          status={health.websocket} 
          icon={Activity}
          errorMsg="Connection to SmartOps backend failed"
        />
        <ServiceCard 
          title="Kubernetes API" 
          status={health.kubernetes} 
          icon={Server}
          errorMsg="Cannot reach EKS cluster API"
        />
        <ServiceCard 
          title="Prometheus" 
          status={health.prometheus} 
          icon={Database}
          errorMsg="Prometheus query endpoint unreachable"
        />
        <ServiceCard 
          title="Kafka Broker" 
          status={health.kafka} 
          icon={Network}
          errorMsg="Cannot connect to Kafka brokers"
        />
        <ServiceCard 
          title="CloudWatch Logs" 
          status={health.cloudwatch} 
          icon={Cloud}
          errorMsg="AWS credentials invalid or missing permissions"
        />
      </div>
    </div>
  );
};

export default Health;
