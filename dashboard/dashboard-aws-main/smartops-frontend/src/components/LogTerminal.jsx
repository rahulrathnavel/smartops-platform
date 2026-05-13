import React, { useEffect, useRef } from 'react';
import { Pause, Play } from 'lucide-react';

const LogTerminal = ({ logs, isPaused, togglePause, filter, setFilter }) => {
  const scrollRef = useRef(null);

  useEffect(() => {
    if (!isPaused && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs, isPaused]);

  const getLogColor = (severity) => {
    switch (severity) {
      case 'ERROR': return 'text-rose-400';
      case 'WARN': return 'text-amber-400';
      case 'INFO': return 'text-emerald-400';
      case 'DEBUG': return 'text-slate-500';
      default: return 'text-slate-300';
    }
  };

  const filteredLogs = logs.filter(log => {
    if (!filter) return true;
    return log.message.toLowerCase().includes(filter.toLowerCase()) || 
           log.severity.toLowerCase() === filter.toLowerCase();
  });

  return (
    <div className="bg-[#0c1015] rounded-xl border border-slate-700 flex flex-col h-full overflow-hidden shadow-2xl font-mono text-sm">
      {/* Header */}
      <div className="bg-slate-800/80 border-b border-slate-700 p-3 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="flex gap-2">
            <div className="w-3 h-3 rounded-full bg-rose-500"></div>
            <div className="w-3 h-3 rounded-full bg-amber-500"></div>
            <div className="w-3 h-3 rounded-full bg-emerald-500"></div>
          </div>
          <span className="text-slate-400 text-xs font-semibold tracking-wider">CLOUDWATCH LOGS</span>
        </div>
        
        <div className="flex items-center gap-3">
          <input 
            type="text" 
            placeholder="Filter logs..." 
            className="bg-slate-900 border border-slate-700 rounded px-3 py-1 text-xs text-slate-300 focus:outline-none focus:border-blue-500 w-48"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          />
          <button 
            onClick={togglePause}
            className={`p-1.5 rounded flex items-center justify-center transition-colors ${isPaused ? 'bg-amber-500/20 text-amber-400 hover:bg-amber-500/30' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'}`}
            title={isPaused ? "Resume scrolling" : "Pause scrolling"}
          >
            {isPaused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Terminal Content */}
      <div 
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-4 space-y-1"
      >
        {filteredLogs.length === 0 ? (
          <div className="text-slate-600 italic">No logs matched your filter.</div>
        ) : (
          filteredLogs.map((log, i) => (
            <div key={i} className="flex gap-3 hover:bg-white/5 px-2 py-0.5 rounded transition-colors break-all">
              <span className="text-slate-500 shrink-0 select-none">
                {new Date(log.timestamp).toISOString().substring(11, 23)}
              </span>
              <span className={`font-semibold shrink-0 w-14 ${getLogColor(log.severity)}`}>
                [{log.severity}]
              </span>
              <span className="text-slate-300">
                {log.message}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default LogTerminal;
