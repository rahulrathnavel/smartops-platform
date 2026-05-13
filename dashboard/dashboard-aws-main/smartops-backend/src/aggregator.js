'use strict';

// ---------------------------------------------------------------------------
// Aggregator — collects telemetry from multiple sources and pushes to frontend
// Sources: Kubernetes API, Prometheus, SmartOps Agent (WebSocket bridge)
// ---------------------------------------------------------------------------

require('dotenv').config();
const { getIO } = require('./websocket');
const kubernetesCollector = require('./collectors/kubernetes');
const prometheusCollector = require('./collectors/prometheus');
const agentBridge = require('./collectors/agent-bridge');

const healthStatus = {
  kubernetes: false,
  prometheus: false,
  agent: false,
  websocket: true
};

function startAggregation() {
  const io = getIO();

  // === Connect to SmartOps Agent WebSocket ===
  agentBridge.connect(io, () => {
    healthStatus.agent = true;
    console.log('[AGENT BRIDGE] Connected to SmartOps Agent');
  });

  // === Kubernetes + Prometheus every 3 seconds ===
  setInterval(async () => {
    let combinedTelemetry = { timestamp: Date.now() };

    // Kubernetes
    try {
      const kubernetesData = await kubernetesCollector.getClusterState();
      io.emit('cluster:update', kubernetesData);
      combinedTelemetry.cluster = kubernetesData;
      healthStatus.kubernetes = true;
    } catch (error) {
      console.error('[K8S ERROR]', error.message);
      healthStatus.kubernetes = false;
    }

    // Prometheus
    try {
      const prometheusData = await prometheusCollector.getMetrics();
      io.emit('metrics:update', prometheusData);
      combinedTelemetry.metrics = prometheusData;
      healthStatus.prometheus = true;

      // Unified Telemetry Emit
      combinedTelemetry.traffic = {
        rps: prometheusData.rps,
        errorRate: prometheusData.errorRate,
        p95Latency: prometheusData.p95Latency,
      };
      io.emit('telemetry:update', combinedTelemetry);
    } catch (error) {
      console.error('[PROMETHEUS ERROR]', error.message);
      healthStatus.prometheus = false;
    }

  }, 3000);

  // === Health broadcast every 5 seconds ===
  setInterval(() => {
    healthStatus.websocket = true;
    io.emit('health:status', healthStatus);
  }, 5000);

  console.log('[AGGREGATOR] Started all collection loops.');
}

module.exports = { startAggregation };
