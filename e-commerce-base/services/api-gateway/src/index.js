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

app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({ origin: '*', credentials: true }));

app.get('/health', (_req, res) => res.json({ status: 'ok', service: 'api-gateway' }));
app.get('/metrics', metricsHandler);
app.use(metricsMiddleware('api-gateway'));

// Analytics endpoint — express.json() is scoped here only, NOT before proxy routes
app.post('/api/analytics/track', express.json(), (req, res) => {
  const { event, ...data } = req.body || {};
  log('info', `[ANALYTICS] ${event}`, {
    event,
    ...data,
    userAgent: req.headers['user-agent'],
    ip: req.headers['x-forwarded-for'] || req.connection.remoteAddress,
  });
  res.json({ ok: true });
});

const SERVICES = {
  '/api/auth':     process.env.USER_SERVICE_URL    || 'http://user-service:3001',
  '/api/products': process.env.CATALOG_SERVICE_URL || 'http://catalog-service:3002',
  '/api/cart':     process.env.CART_SERVICE_URL    || 'http://cart-service:3003',
  '/api/payments': process.env.PAYMENT_SERVICE_URL || 'http://payment-service:3004',
  '/api/orders':   process.env.ORDER_SERVICE_URL   || 'http://order-service:3005',
};

// Proxy routes registered BEFORE any body-parsing middleware — this keeps the
// request stream intact so http-proxy-middleware can forward the body to downstream services.
Object.entries(SERVICES).forEach(([path, target]) => {
  app.use(
    path,
    createProxyMiddleware({
      target,
      changeOrigin: true,
      pathRewrite: { [`^${path}`]: '' },
      on: {
        proxyReq: (proxyReq, req) => {
          const activeContext = context.active();
          const headers = {};
          propagation.inject(activeContext, headers);
          Object.entries(headers).forEach(([key, value]) => {
            proxyReq.setHeader(key, value);
          });
          log('info', `Proxying ${req.method} ${req.originalUrl} -> ${target}`, {
            traceId: trace.getSpan(activeContext)?.spanContext()?.traceId,
            status: null,
          });
        },
        proxyRes: (proxyRes, req) => {
          log('info', `Response ${proxyRes.statusCode} for ${req.method} ${req.originalUrl}`, {
            status: proxyRes.statusCode,
            service: target,
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
