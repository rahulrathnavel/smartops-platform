'use strict';

// ---------------------------------------------------------------------------
// Prometheus metrics middleware for all ammazone microservices.
// Exposes /metrics endpoint with:
//   - http_requests_total (counter)
//   - http_request_duration_seconds (histogram)
//   - Default Node.js metrics (CPU, memory, event loop lag, GC)
// ---------------------------------------------------------------------------

const client = require('prom-client');

// Collect default metrics (CPU, memory, heap, event loop, GC)
client.collectDefaultMetrics({ prefix: 'ammazone_' });

const httpRequestsTotal = new client.Counter({
  name: 'http_requests_total',
  help: 'Total HTTP requests',
  labelNames: ['method', 'route', 'status', 'service'],
});

const httpDuration = new client.Histogram({
  name: 'http_request_duration_seconds',
  help: 'HTTP request duration in seconds',
  labelNames: ['method', 'route', 'status', 'service'],
  buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5],
});

const serviceErrors = new client.Counter({
  name: 'service_errors_total',
  help: 'Total service errors',
  labelNames: ['service', 'error_type'],
});

/**
 * Express middleware that tracks request count and duration.
 * @param {string} serviceName - Name of the service (e.g., 'catalog-service')
 */
function metricsMiddleware(serviceName) {
  return (req, res, next) => {
    if (req.path === '/metrics' || req.path === '/health') return next();

    const end = httpDuration.startTimer();
    res.on('finish', () => {
      const route = req.route?.path || req.path || 'unknown';
      const labels = {
        method: req.method,
        route,
        status: res.statusCode,
        service: serviceName,
      };
      httpRequestsTotal.inc(labels);
      end(labels);

      // Track errors
      if (res.statusCode >= 500) {
        serviceErrors.inc({ service: serviceName, error_type: `${res.statusCode}` });
      }
    });
    next();
  };
}

/**
 * Express handler for /metrics endpoint.
 */
async function metricsHandler(_req, res) {
  res.set('Content-Type', client.register.contentType);
  res.end(await client.register.metrics());
}

module.exports = { metricsMiddleware, metricsHandler, client, serviceErrors };
