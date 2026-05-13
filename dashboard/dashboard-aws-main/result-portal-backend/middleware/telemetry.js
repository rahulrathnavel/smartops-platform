const promClient = require('prom-client');
const { emitEvent } = require('../kafka/producer');

const register = new promClient.Registry();
promClient.collectDefaultMetrics({ register });

const httpRequestsTotal = new promClient.Counter({
  name: 'api_requests_total',
  help: 'Total API requests',
  labelNames: ['route', 'method', 'status_code'],
});
register.registerMetric(httpRequestsTotal);

const httpDuration = new promClient.Histogram({
  name: 'request_duration_seconds',
  help: 'API latency in seconds',
  labelNames: ['route', 'method', 'status_code'], // Added status_code for better error tracking
  buckets: [0.05, 0.1, 0.3, 0.5, 1, 2, 5],
});
register.registerMetric(httpDuration);

const activeSessionsGauge = new promClient.Gauge({
  name: 'active_sessions_total',
  help: 'Currently active logged-in users',
});
register.registerMetric(activeSessionsGauge);

const loginCounter = new promClient.Counter({
  name: 'login_requests_total',
  help: 'Login attempts',
  labelNames: ['status'],
});
register.registerMetric(loginCounter);

const activeSessions = new Map(); // registrationNo -> { loginTime, department, ip }

// Helper for session management
function addSession(registrationNo, department, ip) {
  activeSessions.set(registrationNo, { loginTime: Date.now(), department, ip });
  activeSessionsGauge.set(activeSessions.size);
  console.log('[SESSION ADDED]', { registrationNo, activeUsers: activeSessions.size });
}

function removeSession(registrationNo) {
  if (activeSessions.has(registrationNo)) {
    activeSessions.delete(registrationNo);
    activeSessionsGauge.set(activeSessions.size);
    console.log('[SESSION REMOVED]', { registrationNo, activeUsers: activeSessions.size });
  }
}

// Track RPS for Kafka events
let currentRequests = 0;
let topEndpointsMap = new Map();

setInterval(() => {
  const rps = currentRequests / 5;
  
  const endpoints = Array.from(topEndpointsMap.entries())
    .map(([path, count]) => ({ path, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  const payload = {
    timestamp: Date.now(),
    rps: rps,
    activeUsers: activeSessions.size,
    topEndpoints: endpoints
  };

  // Only emit if there is activity to avoid noise, but user wants live telemetry
  emitEvent('traffic-events', payload);

  currentRequests = 0;
  topEndpointsMap.clear();
}, 5000);

const telemetryMiddleware = (req, res, next) => {
  const route = req.path;
  const start = Date.now();
  
  currentRequests++;
  topEndpointsMap.set(route, (topEndpointsMap.get(route) || 0) + 1);

  res.on('finish', () => {
    const duration = (Date.now() - start) / 1000;
    httpRequestsTotal.inc({ route: route, method: req.method, status_code: res.statusCode });
    httpDuration.observe({ route: route, method: req.method, status_code: res.statusCode }, duration);
  });
  next();
};

const getMetrics = async (req, res) => {
  res.set('Content-Type', register.contentType);
  res.end(await register.metrics());
};

module.exports = {
  telemetryMiddleware,
  getMetrics,
  loginCounter,
  addSession,
  removeSession,
  activeSessions,
};
