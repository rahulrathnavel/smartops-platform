import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, NavLink, Navigate } from 'react-router-dom';
import { Activity, Box, BarChart3, Terminal, Network, TrendingUp, ShieldCheck, AlertTriangle, Cpu } from 'lucide-react';
import { socket } from './socket';

import Overview from './pages/Overview';
import Kubernetes from './pages/Kubernetes';
import Metrics from './pages/Metrics';
import Logs from './pages/Logs';
import Autoscaling from './pages/Autoscaling';
import Health from './pages/Health';
import Incidents from './pages/Incidents';
import RCATopology from './pages/RCATopology';

const SidebarLink = ({ to, icon: Icon, children, badge }) => (
  <NavLink 
    to={to} 
    className={({ isActive }) => 
      `flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
        isActive 
          ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30' 
          : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
      }`
    }
  >
    <Icon className="w-5 h-5" />
    <span className="font-medium tracking-wide flex-1">{children}</span>
    {badge > 0 && (
      <span className="bg-rose-500 text-white text-xs font-bold px-2 py-0.5 rounded-full animate-pulse">
        {badge}
      </span>
    )}
  </NavLink>
);

function App() {
  const [isConnected, setIsConnected] = useState(socket.connected);
  const [activeIncidents, setActiveIncidents] = useState(0);

  useEffect(() => {
    function onConnect() { setIsConnected(true); }
    function onDisconnect() { setIsConnected(false); }

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);

    // Track active incident count for badge
    socket.on('incident:detected', () => setActiveIncidents(prev => prev + 1));
    socket.on('incident:resolved', () => setActiveIncidents(prev => Math.max(0, prev - 1)));

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('incident:detected');
      socket.off('incident:resolved');
    };
  }, []);

  return (
    <BrowserRouter>
      <div className="flex h-screen bg-[#0f172a] text-slate-50 overflow-hidden">
        
        {/* Sidebar */}
        <div className="w-64 bg-slate-900 border-r border-slate-800 flex flex-col shrink-0">
          <div className="p-6 border-b border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-blue-500 flex items-center justify-center">
                <Activity className="text-white w-5 h-5" />
              </div>
              <h1 className="text-xl font-bold tracking-wider text-white">SmartOps</h1>
            </div>
          </div>
          
          <div className="flex-1 overflow-y-auto py-6 px-4 space-y-1">
            <div className="px-2 mb-2">
              <span className="text-[10px] font-bold text-slate-600 uppercase tracking-widest">Monitoring</span>
            </div>
            <SidebarLink to="/overview" icon={Activity}>Overview</SidebarLink>
            <SidebarLink to="/kubernetes" icon={Box}>Kubernetes</SidebarLink>
            <SidebarLink to="/metrics" icon={BarChart3}>Metrics</SidebarLink>
            <SidebarLink to="/logs" icon={Terminal}>Logs Stream</SidebarLink>
            <SidebarLink to="/autoscaling" icon={TrendingUp}>Autoscaling</SidebarLink>

            <div className="px-2 mt-4 mb-2">
              <span className="text-[10px] font-bold text-slate-600 uppercase tracking-widest">Self-Healing</span>
            </div>
            <SidebarLink to="/incidents" icon={AlertTriangle} badge={activeIncidents}>Incidents</SidebarLink>
            <SidebarLink to="/rca-topology" icon={Cpu}>RCA Topology</SidebarLink>

            <div className="px-2 mt-4 mb-2">
              <span className="text-[10px] font-bold text-slate-600 uppercase tracking-widest">System</span>
            </div>
            <SidebarLink to="/health" icon={ShieldCheck}>Health</SidebarLink>
          </div>
          
          <div className="p-4 border-t border-slate-800 bg-slate-900/50">
            <div className="flex items-center justify-between px-2">
              <span className="text-sm font-medium text-slate-400">WebSocket</span>
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  {isConnected ? 'Live' : 'Offline'}
                </span>
                <span className={`w-2.5 h-2.5 rounded-full ${isConnected ? 'bg-emerald-500 shadow-[0_0_8px_#10b981]' : 'bg-rose-500'}`}></span>
              </div>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 overflow-y-auto bg-gradient-to-br from-slate-900 to-[#0f172a]">
          <Routes>
            <Route path="/" element={<Navigate to="/overview" replace />} />
            <Route path="/overview" element={<Overview />} />
            <Route path="/kubernetes" element={<Kubernetes />} />
            <Route path="/metrics" element={<Metrics />} />
            <Route path="/logs" element={<Logs />} />
            <Route path="/autoscaling" element={<Autoscaling />} />
            <Route path="/incidents" element={<Incidents />} />
            <Route path="/rca-topology" element={<RCATopology />} />
            <Route path="/health" element={<Health />} />
          </Routes>
        </div>

      </div>
    </BrowserRouter>
  );
}

export default App;
