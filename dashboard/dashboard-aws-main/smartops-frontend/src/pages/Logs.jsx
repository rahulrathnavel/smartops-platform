import React, { useEffect, useState } from 'react';
import { socket } from '../socket';
import LogTerminal from '../components/LogTerminal';
import { Terminal } from 'lucide-react';

const Logs = () => {
  const [logs, setLogs] = useState([]);
  const [isPaused, setIsPaused] = useState(false);
  const [filter, setFilter] = useState('');

  useEffect(() => {
    socket.on('logs:update', (newLogs) => {
      if (!isPaused) {
        setLogs(prev => {
          // Sort new logs by timestamp and append, then keep last 500
          const combined = [...prev, ...newLogs];
          // Simple deduplication based on exact match (since CW can return overlapping windows)
          const unique = Array.from(new Map(combined.map(item => [item.timestamp + item.message, item])).values());
          unique.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
          return unique.slice(-500);
        });
      }
    });

    return () => socket.off('logs:update');
  }, [isPaused]);

  return (
    <div className="p-8 max-w-7xl mx-auto h-[calc(100vh-2rem)] flex flex-col">
      <h1 className="text-3xl font-bold flex items-center gap-3 mb-6 shrink-0">
        <Terminal className="text-blue-500 w-8 h-8" />
        Live Logs Stream
      </h1>
      <div className="flex-1 min-h-0">
        <LogTerminal 
          logs={logs} 
          isPaused={isPaused} 
          togglePause={() => setIsPaused(!isPaused)} 
          filter={filter}
          setFilter={setFilter}
        />
      </div>
    </div>
  );
};

export default Logs;
