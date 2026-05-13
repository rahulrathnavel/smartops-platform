const promClient = require("prom-client");
const register = new promClient.Registry();
const activeSessions = require("../utils/sessions");

const totalRequests = new promClient.Counter({
  name: 'total_requests',
  help: 'Total number of requests',
  labelNames: ['method', 'route', 'status'],
  registers: [register],
});

const loginRequests = new promClient.Counter({
  name: 'login_requests_total',
  help: 'Total number of login attempts',
  labelNames: ['status'],
  registers: [register],
});

const resultRequests = new promClient.Counter({
  name: 'result_requests_total',
  help: 'Total number of result fetch requests',
  labelNames: ['registration_no'],
  registers: [register],
});

const failedLogins = new promClient.Counter({
  name: 'failed_logins_total',
  help: 'Total number of failed login attempts',
  labelNames: ['status'],
  registers: [register],
});

const requestDuration = new promClient.Histogram({
  name: 'request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status'],
  buckets: [0.01, 0.05, 0.1, 0.2, 0.5, 1, 2, 5],
  registers: [register],
});

const activeConnections = new promClient.Gauge({
  name: 'active_connections',
  help: 'Number of active connections',
  registers: [register],
});

const activeSessionsGauge = new promClient.Gauge({
  name: 'active_sessions_total',
  help: 'Currently active sessions',
  registers: [register],
});

promClient.collectDefaultMetrics({ register });

// Override metrics to include session count update
const originalMetrics = register.metrics.bind(register);
register.metrics = async () => {
  activeSessionsGauge.set(activeSessions.size);
  return originalMetrics();
};

module.exports = {
  register,
  totalRequests,
  loginRequests,
  resultRequests,
  failedLogins,
  requestDuration,
  activeConnections,
  activeSessionsGauge
};
