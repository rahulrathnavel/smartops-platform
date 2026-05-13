import React, { useEffect, useState } from 'react';
import { socket } from '../socket';
import { AlertTriangle, CheckCircle, Clock, GitPullRequest, Cpu, ExternalLink } from 'lucide-react';

const statusConfig = {
  detected:        { color: 'rose',    icon: AlertTriangle, label: 'Detected',       pulse: true  },
  diagnosing:      { color: 'amber',   icon: Cpu,           label: 'Diagnosing',     pulse: true  },
  fix_proposed:    { color: 'orange',  icon: Clock,         label: 'Fix Proposed',   pulse: false },
  awaiting_approval: { color: 'yellow', icon: Clock,        label: 'Awaiting Approval', pulse: true },
  resolved:        { color: 'emerald', icon: CheckCircle,   label: 'Resolved',       pulse: false },
};

const Incidents = () => {
  const [incidents, setIncidents] = useState([]);

  useEffect(() => {
    socket.on('incident:detected', (data) => {
      setIncidents(prev => [{
        ...data, status: 'detected', timestamp: Date.now(),
        diagnosis: null, fix: null, prUrl: null, rcaOutput: null
      }, ...prev]);
    });

    socket.on('incident:diagnosed', (data) => {
      setIncidents(prev => prev.map(inc =>
        inc.id === data.id ? {
          ...inc, status: 'diagnosing',
          diagnosis: data.diagnosis,
          rcaOutput: data.rcaOutput,
          fix: data.proposedFix
        } : inc
      ));
    });

    socket.on('incident:fix_proposed', (data) => {
      setIncidents(prev => prev.map(inc =>
        inc.id === data.id ? { ...inc, status: 'fix_proposed' } : inc
      ));
    });

    socket.on('incident:resolved', (data) => {
      setIncidents(prev => prev.map(inc =>
        inc.id === data.id ? { ...inc, status: 'resolved', prUrl: data.prUrl } : inc
      ));
    });

    return () => {
      socket.off('incident:detected');
      socket.off('incident:diagnosed');
      socket.off('incident:fix_proposed');
      socket.off('incident:resolved');
    };
  }, []);

  const formatTime = (ts) => new Date(ts).toLocaleTimeString();

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-bold flex items-center gap-3">
          <AlertTriangle className="text-rose-500 w-8 h-8" />
          Incident Management
        </h1>
        <div className="text-sm text-slate-400">
          {incidents.filter(i => i.status !== 'resolved').length} active incidents
        </div>
      </div>

      {incidents.length === 0 ? (
        <div className="bg-slate-800/50 rounded-xl border border-slate-700 p-16 text-center">
          <CheckCircle className="w-16 h-16 text-emerald-500 mx-auto mb-4 opacity-50" />
          <p className="text-xl text-slate-400">All systems operational</p>
          <p className="text-sm text-slate-500 mt-2">Incidents will appear here when the SmartOps Agent detects errors</p>
        </div>
      ) : (
        <div className="space-y-4">
          {incidents.map((inc, idx) => {
            const cfg = statusConfig[inc.status] || statusConfig.detected;
            const Icon = cfg.icon;

            return (
              <div key={inc.id || idx}
                className={`bg-slate-800/80 rounded-xl border transition-all duration-500 ${
                  cfg.pulse ? `border-${cfg.color}-500/50 shadow-lg shadow-${cfg.color}-500/10` : 'border-slate-700'
                }`}>

                {/* Header */}
                <div className="px-6 py-4 flex items-center justify-between border-b border-slate-700/50">
                  <div className="flex items-center gap-4">
                    <div className={`p-2 rounded-lg bg-${cfg.color}-500/20`}>
                      <Icon className={`w-5 h-5 text-${cfg.color}-400`} />
                    </div>
                    <div>
                      <span className="font-mono text-sm text-slate-400">{inc.id}</span>
                      <h3 className="font-semibold text-white">{inc.service}</h3>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider
                      bg-${cfg.color}-500/20 text-${cfg.color}-400 border border-${cfg.color}-500/30
                      ${cfg.pulse ? 'animate-pulse' : ''}`}>
                      {cfg.label}
                    </span>
                    <span className="text-xs text-slate-500">{formatTime(inc.timestamp)}</span>
                  </div>
                </div>

                {/* Body */}
                <div className="px-6 py-4 space-y-3">
                  {/* Error */}
                  <div>
                    <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Error</span>
                    <p className="text-sm text-rose-300 font-mono mt-1 bg-slate-900/50 p-2 rounded">{inc.errorLog || inc.error || 'Analyzing...'}</p>
                  </div>

                  {/* RCA Model Output */}
                  {inc.rcaOutput && (
                    <div className="bg-slate-900/60 rounded-lg p-4 border border-slate-700/50">
                      <div className="flex items-center gap-2 mb-2">
                        <Cpu className="w-4 h-4 text-cyan-400" />
                        <span className="text-xs font-bold text-cyan-400 uppercase tracking-wider">RCA Model Analysis</span>
                      </div>
                      <div className="grid grid-cols-3 gap-4 text-sm">
                        <div>
                          <span className="text-slate-500">Root Cause</span>
                          <p className="text-white font-semibold">{inc.rcaOutput.rootCauseNode}</p>
                        </div>
                        <div>
                          <span className="text-slate-500">Confidence</span>
                          <p className="text-emerald-400 font-bold">{(inc.rcaOutput.confidence * 100).toFixed(1)}%</p>
                        </div>
                        <div>
                          <span className="text-slate-500">Model</span>
                          <p className="text-slate-300 text-xs">{inc.rcaOutput.model}</p>
                        </div>
                      </div>
                      {inc.rcaOutput.propagationPath && (
                        <div className="mt-2 text-xs text-slate-400">
                          Propagation: {inc.rcaOutput.propagationPath.join(' → ')}
                        </div>
                      )}
                    </div>
                  )}

                  {/* LLM Diagnosis */}
                  {inc.diagnosis && (
                    <div>
                      <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">LLM Diagnosis</span>
                      <p className="text-sm text-slate-300 mt-1">{inc.diagnosis}</p>
                    </div>
                  )}

                  {/* PR Link */}
                  {inc.prUrl && (
                    <div className="flex items-center gap-2 pt-2">
                      <GitPullRequest className="w-4 h-4 text-emerald-400" />
                      <a href={inc.prUrl} target="_blank" rel="noopener noreferrer"
                        className="text-sm text-emerald-400 hover:text-emerald-300 underline flex items-center gap-1">
                        View Pull Request <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default Incidents;
