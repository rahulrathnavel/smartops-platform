'use strict';

// ---------------------------------------------------------------------------
// Agent Bridge — connects to SmartOps Agent via WebSocket to receive
// incident events and relay them to the dashboard frontend.
// ---------------------------------------------------------------------------

const { io: SocketIOClient } = require('socket.io-client');

const AGENT_URL = process.env.AGENT_WS_URL || 'http://smartops-agent.smartops-system.svc.cluster.local:3000';

let agentSocket = null;

function connect(dashboardIO, onConnect) {
  agentSocket = SocketIOClient(AGENT_URL, {
    reconnection: true,
    reconnectionDelay: 3000,
    reconnectionAttempts: Infinity,
    timeout: 10000,
  });

  agentSocket.on('connect', () => {
    console.log('[AGENT BRIDGE] Connected to SmartOps Agent');
    if (onConnect) onConnect();
  });

  agentSocket.on('disconnect', () => {
    console.log('[AGENT BRIDGE] Disconnected from SmartOps Agent');
  });

  agentSocket.on('connect_error', (err) => {
    console.warn('[AGENT BRIDGE] Connection error:', err.message);
  });

  // ---------------------------------------------------------------------------
  // Relay incident events from agent to all dashboard clients
  // ---------------------------------------------------------------------------

  agentSocket.on('incident:detected', (data) => {
    console.log('[AGENT BRIDGE] Incident detected:', data.id, data.service);
    dashboardIO.emit('incident:detected', data);
  });

  agentSocket.on('incident:diagnosed', (data) => {
    console.log('[AGENT BRIDGE] Incident diagnosed:', data.id);
    dashboardIO.emit('incident:diagnosed', data);
    // Also emit the RCA data for the topology graph
    if (data.rcaOutput) {
      dashboardIO.emit('rca:update', data.rcaOutput);
    }
  });

  agentSocket.on('incident:fix_proposed', (data) => {
    console.log('[AGENT BRIDGE] Fix proposed:', data.id);
    dashboardIO.emit('incident:fix_proposed', data);
  });

  agentSocket.on('incident:resolved', (data) => {
    console.log('[AGENT BRIDGE] Incident resolved:', data.id);
    dashboardIO.emit('incident:resolved', data);
    // Clear the RCA alert on topology
    dashboardIO.emit('rca:clear', { id: data.id, service: data.service });
  });
}

module.exports = { connect };
