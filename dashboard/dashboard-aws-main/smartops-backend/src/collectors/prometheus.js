'use strict';

// ---------------------------------------------------------------------------
// Prometheus Collector — queries real metrics from ammazone microservices
// ---------------------------------------------------------------------------

const axios = require('axios');

const PROMETHEUS_URL = process.env.PROMETHEUS_URL || 'http://prometheus-kube-prometheus-prometheus.monitoring.svc.cluster.local:9090';

async function queryPrometheus(query) {
  const response = await axios.get(`${PROMETHEUS_URL}/api/v1/query`, {
    params: { query },
    timeout: 5000
  });
  if (response.data.status !== 'success') throw new Error(`Query failed: ${query}`);
  return response.data.data.result;
}

function scalar(result) {
  if (!result || result.length === 0) return 0;
  const val = parseFloat(result[0].value[1]);
  return isNaN(val) ? 0 : val;
}

function perPod(result, labelKey = 'pod') {
  if (!result || result.length === 0) return [];
  return result.map(r => ({
    pod: r.metric[labelKey] || r.metric.instance || 'unknown',
    value: parseFloat(r.value[1]) || 0
  })).filter(r => r.pod !== '');
}

function perService(result) {
  if (!result || result.length === 0) return [];
  return result.map(r => ({
    service: r.metric.service || r.metric.pod || 'unknown',
    value: parseFloat(r.value[1]) || 0
  }));
}

async function getMetrics() {
  const queries = {
    // --- Real metrics from ammazone microservices (prom-client) ---
    totalRPS:           'sum(rate(http_requests_total[1m]))',
    rpsPerService:      'sum(rate(http_requests_total[1m])) by (service)',
    errorRate:          'sum(rate(http_requests_total{status=~"5.."}[1m]))',
    errorsPerService:   'sum(rate(service_errors_total[1m])) by (service)',
    p95Latency:         'histogram_quantile(0.95, sum(rate(http_request_duration_seconds_bucket[5m])) by (le))',
    p95PerService:      'histogram_quantile(0.95, sum(rate(http_request_duration_seconds_bucket[5m])) by (le, service))',

    // --- Node-level metrics (node-exporter) ---
    nodeCpuUsage:       '1 - avg(rate(node_cpu_seconds_total{mode="idle"}[1m])) by (instance)',
    nodeMemoryUsage:    '1 - (node_memory_MemAvailable_bytes / node_memory_MemTotal_bytes)',

    // --- Pod-level metrics (kube-state-metrics) ---
    podRestarts:        'sum(kube_pod_container_status_restarts_total{namespace="ammazone"}) by (pod)',
    networkReceive:     'sum(rate(container_network_receive_bytes_total{namespace="ammazone"}[1m])) by (pod)',
    networkTransmit:    'sum(rate(container_network_transmit_bytes_total{namespace="ammazone"}[1m])) by (pod)',
  };

  const results = {};
  const errors = {};

  await Promise.all(
    Object.entries(queries).map(async ([key, query]) => {
      try {
        results[key] = await queryPrometheus(query);
      } catch (e) {
        errors[key] = e.message;
        results[key] = [];
      }
    })
  );

  if (Object.keys(errors).length > 0) {
    const failedKeys = Object.keys(errors);
    console.warn(`[PROMETHEUS] ${failedKeys.length} queries failed:`, failedKeys.join(', '));
  }

  return {
    // Aggregate traffic metrics
    rps: scalar(results.totalRPS),
    errorRate: scalar(results.errorRate),
    p95Latency: scalar(results.p95Latency),

    // Per-service breakdowns
    rpsPerService: perService(results.rpsPerService),
    errorsPerService: perService(results.errorsPerService),

    // Node metrics
    nodeCpu: perPod(results.nodeCpuUsage, 'instance'),
    nodeMemory: perPod(results.nodeMemoryUsage, 'instance'),

    // Pod metrics
    podRestarts: perPod(results.podRestarts),
    networkReceive: perPod(results.networkReceive),
    networkTransmit: perPod(results.networkTransmit),

    timestamp: Date.now()
  };
}

module.exports = { getMetrics };
