import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, NavLink, Navigate } from 'react-router-dom';
import { Activity, Box, AlertTriangle, Network, History, Wifi, WifiOff } from 'lucide-react';
import { socket } from './socket';

import Overview        from './pages/Overview';
import Kubernetes      from './pages/Kubernetes';
import Incidents       from './pages/Incidents';
import RCATopology     from './pages/RCATopology';
import IncidentHistory from './pages/IncidentHistory';

const NAV = [
  { section: 'Monitoring',    items: [
    { to: '/overview',   icon: Activity,       label: 'Overview'        },
    { to: '/kubernetes', icon: Box,            label: 'Kubernetes'      },
  ]},
  { section: 'Self-Healing', items: [
    { to: '/incidents',    icon: AlertTriangle, label: 'Incidents', badge: true },
    { to: '/rca-topology', icon: Network,       label: 'RCA Topology'   },
    { to: '/history',      icon: History,       label: 'Incident History'},
  ]},
];

function SidebarLink({ to, icon: Icon, label, badge, count }) {
  return (
    <NavLink to={to} className={({ isActive }) =>
      `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 ${
        isActive
          ? 'bg-blue-50 text-blue-700 border border-blue-200'
          : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
      }`
    }>
      <Icon className="w-4 h-4 flex-shrink-0" />
      <span className="flex-1">{label}</span>
      {badge && count > 0 && (
        <span className="bg-red-500 text-white text-xs font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center pulse-dot">
          {count}
        </span>
      )}
    </NavLink>
  );
}

export default function App() {
  const [connected, setConnected]       = useState(socket.connected);
  const [activeCount, setActiveCount]   = useState(0);

  useEffect(() => {
    socket.on('connect',    () => setConnected(true));
    socket.on('disconnect', () => setConnected(false));
    socket.on('incident:detected',  () => setActiveCount(n => n + 1));
    socket.on('incident:resolved',  () => setActiveCount(n => Math.max(0, n - 1)));
    return () => {
      socket.off('connect');
      socket.off('disconnect');
      socket.off('incident:detected');
      socket.off('incident:resolved');
    };
  }, []);

  return (
    <BrowserRouter>
      <div className="flex h-screen overflow-hidden" style={{ background: 'var(--bg)' }}>

        {/* Sidebar */}
        <aside className="w-56 bg-white border-r flex flex-col flex-shrink-0" style={{ borderColor: 'var(--border)' }}>
          {/* Logo */}
          <div className="px-5 py-4 border-b flex items-center gap-3" style={{ borderColor: 'var(--border)' }}>
            <div className="w-7 h-7 rounded-md bg-blue-600 flex items-center justify-center">
              <Activity className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold text-base" style={{ color: 'var(--text-main)' }}>SmartOps</span>
          </div>

          {/* Navigation */}
          <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-5">
            {NAV.map(({ section, items }) => (
              <div key={section}>
                <p className="px-3 mb-1.5 text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>
                  {section}
                </p>
                <div className="space-y-0.5">
                  {items.map(({ to, icon, label, badge }) => (
                    <SidebarLink key={to} to={to} icon={icon} label={label} badge={badge} count={activeCount} />
                  ))}
                </div>
              </div>
            ))}
          </nav>

          {/* Connection status */}
          <div className="px-4 py-3 border-t flex items-center gap-2" style={{ borderColor: 'var(--border)' }}>
            {connected
              ? <Wifi className="w-3.5 h-3.5 text-green-500" />
              : <WifiOff className="w-3.5 h-3.5 text-red-400" />
            }
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
              {connected ? 'Live — EKS Connected' : 'Disconnected'}
            </span>
            <span className={`ml-auto w-2 h-2 rounded-full ${connected ? 'bg-green-500 pulse-dot' : 'bg-red-400'}`} />
          </div>
        </aside>

        {/* Main content */}
        <main className="flex-1 overflow-y-auto">
          <Routes>
            <Route path="/"             element={<Navigate to="/overview" replace />} />
            <Route path="/overview"     element={<Overview />} />
            <Route path="/kubernetes"   element={<Kubernetes />} />
            <Route path="/incidents"    element={<Incidents />} />
            <Route path="/rca-topology" element={<RCATopology />} />
            <Route path="/history"      element={<IncidentHistory />} />
          </Routes>
        </main>

      </div>
    </BrowserRouter>
  );
}
