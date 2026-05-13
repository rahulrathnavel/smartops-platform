import React, { useEffect, useState } from 'react';
import { socket } from '../socket';
import { MessageSquare, Network } from 'lucide-react';

const Kafka = () => {
  const [events, setEvents] = useState([]);
  const [stats, setStats] = useState({
    'login-events': { count: 0, last: null },
    'traffic-events': { count: 0, last: null },
    'scaling-stream': { count: 0, last: null }
  });
  const [selectedEvent, setSelectedEvent] = useState(null);

  useEffect(() => {
    const handleEvent = (topic) => (payload) => {
      const now = new Date();
      setEvents(prev => [{ topic, payload, receivedAt: now }, ...prev].slice(0, 50));
      setStats(prev => ({
        ...prev,
        [topic]: { count: prev[topic].count + 1, last: now }
      }));
    };

    socket.on('login:event', handleEvent('login-events'));
    socket.on('traffic:update', handleEvent('traffic-events'));
    socket.on('scaling:event', handleEvent('scaling-stream'));

    return () => {
      socket.off('login:event');
      socket.off('traffic:update');
      socket.off('scaling:event');
    };
  }, []);

  const TopicCard = ({ topic, data }) => (
    <div className="bg-slate-800 p-6 rounded-xl border border-slate-700 shadow-lg">
      <div className="flex justify-between items-center mb-4">
        <h3 className="font-semibold text-slate-200">{topic}</h3>
        <MessageSquare className="w-5 h-5 text-blue-400" />
      </div>
      <div className="text-3xl font-bold text-white mb-2">{data.count}</div>
      <div className="text-xs text-slate-400">
        Last: {data.last ? data.last.toLocaleTimeString() : 'Never'}
      </div>
    </div>
  );

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8 h-[calc(100vh-2rem)] flex flex-col">
      <h1 className="text-3xl font-bold flex items-center gap-3 shrink-0">
        <Network className="text-blue-500 w-8 h-8" />
        Kafka Streams
      </h1>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 shrink-0">
        <TopicCard topic="login-events" data={stats['login-events']} />
        <TopicCard topic="traffic-events" data={stats['traffic-events']} />
        <TopicCard topic="scaling-stream" data={stats['scaling-stream']} />
      </div>

      <div className="flex-1 min-h-0 flex gap-6">
        {/* Stream Feed */}
        <div className="w-1/2 bg-slate-800 rounded-xl border border-slate-700 shadow-lg flex flex-col">
          <div className="p-4 border-b border-slate-700 bg-slate-800/50 shrink-0">
            <h3 className="font-semibold text-slate-200">Live Event Stream</h3>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-2">
            {events.length === 0 ? (
              <div className="text-slate-500 text-center py-4">Waiting for events...</div>
            ) : (
              events.map((evt, i) => (
                <div 
                  key={i} 
                  onClick={() => setSelectedEvent(evt)}
                  className={`p-3 rounded-lg border cursor-pointer transition-colors ${selectedEvent === evt ? 'bg-blue-500/20 border-blue-500/50' : 'bg-slate-900/50 border-slate-700/50 hover:bg-slate-800'}`}
                >
                  <div className="flex justify-between mb-1">
                    <span className="text-xs font-bold text-blue-400">{evt.topic}</span>
                    <span className="text-xs text-slate-500">{evt.receivedAt.toLocaleTimeString()}</span>
                  </div>
                  <div className="text-sm text-slate-300 truncate">
                    {JSON.stringify(evt.payload)}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Payload Viewer */}
        <div className="w-1/2 bg-[#0c1015] rounded-xl border border-slate-700 shadow-lg flex flex-col">
          <div className="p-4 border-b border-slate-700 bg-slate-800/80 shrink-0">
            <h3 className="font-semibold text-slate-200">Event Payload Viewer</h3>
          </div>
          <div className="flex-1 overflow-auto p-6">
            {selectedEvent ? (
              <pre className="text-emerald-400 font-mono text-sm whitespace-pre-wrap">
                {JSON.stringify(selectedEvent.payload, null, 2)}
              </pre>
            ) : (
              <div className="text-slate-600 flex items-center justify-center h-full italic">
                Select an event to view payload
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Kafka;
