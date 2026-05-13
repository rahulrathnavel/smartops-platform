'use strict';
require('./tracing');

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const { createProxyMiddleware } = require('http-proxy-middleware');
const { trace, context, propagation } = require('@opentelemetry/api');
const { metricsMiddleware, metricsHandler } = require('../../shared/metrics');

const app = express();
const PORT = process.env.PORT || 3000;

const log = (level, msg, extra = {}) =>
  console.log(JSON.stringify({ level, service: 'api-gateway', ts: new Date().toISOString(), msg, ...extra }));

// Middleware
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({ origin: '*', credentials: true }));

// Health check
app.get('/health', (_req, res) => res.json({ status: 'ok', service: 'api-gateway' }));
app.get('/metrics', metricsHandler);

// Parse JSON bodies for analytics endpoint
app.use(express.json());
app.use(metricsMiddleware('api-gateway'));

// Analytics / tracking endpoint — logs every user interaction
app.post('/api/analytics/track', (req, res) => {
  const { event, ...data } = req.body || {};
  log('info', `[ANALYTICS] ${event}`, {
    event,
    ...data,
    userAgent: req.headers['user-agent'],
    ip: req.headers['x-forwarded-for'] || req.connection.remoteAddress,
  });
  res.json({ ok: true });
});

// Service URLs from environment
const SERVICES = {
  '/api/auth':     process.env.USER_SERVICE_URL     || 'http://user-service:3001',
  '/api/products': process.env.CATALOG_SERVICE_URL  || 'http://catalog-service:3002',
  '/api/cart':     process.env.CART_SERVICE_URL      || 'http://cart-service:3003',
  '/api/payments': process.env.PAYMENT_SERVICE_URL  || 'http://payment-service:3004',
  '/api/orders':   process.env.ORDER_SERVICE_URL    || 'http://order-service:3005',
};

// Trace-propagating proxy for each service route
Object.entries(SERVICES).forEach(([path, target]) => {
  app.use(
    path,
    createProxyMiddleware({
      target,
      changeOrigin: true,
      pathRewrite: { [`^${path}`]: '' },
      on: {
        proxyReq: (proxyReq, req) => {
          // Propagate trace context to downstream services
          const activeContext = context.active();
          const headers = {};
          propagation.inject(activeContext, headers);
          Object.entries(headers).forEach(([key, value]) => {
            proxyReq.setHeader(key, value);
          });
          log('info', `Proxying ${req.method} ${req.originalUrl} -> ${target}`, {
            traceId: trace.getSpan(activeContext)?.spanContext()?.traceId,
          });
        },
        error: (err, req, res) => {
          log('error', `Proxy error: ${err.message}`, { path: req.originalUrl });
          if (!res.headersSent) {
            res.status(502).json({ error: 'Service unavailable' });
          }
        },
      },
    }),
  );
});

app.listen(PORT, () => log('info', `API Gateway listening on port ${PORT}`));
