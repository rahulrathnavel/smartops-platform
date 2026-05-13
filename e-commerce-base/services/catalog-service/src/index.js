'use strict';
require('./tracing');

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const productRoutes = require('./routes/products');
const { metricsMiddleware, metricsHandler } = require('../../shared/metrics');

const app = express();
const PORT = process.env.PORT || 3002;
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/ammazone-catalog';

const log = (level, msg, extra = {}) =>
  console.log(JSON.stringify({ level, service: 'catalog-service', ts: new Date().toISOString(), msg, ...extra }));

app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(metricsMiddleware('catalog-service'));

app.get('/health', (_req, res) => res.json({ status: 'ok', service: 'catalog-service' }));
app.get('/metrics', metricsHandler);
app.use('/', productRoutes);

async function start() {
  try {
    await mongoose.connect(MONGO_URI, { tls: true, retryWrites: false, directConnection: false });
    log('info', 'Connected to Cosmos DB (MongoDB API)');
    app.listen(PORT, () => log('info', `Catalog Service listening on port ${PORT}`));
  } catch (err) {
    log('error', `Failed to start: ${err.message}`);
    process.exit(1);
  }
}

start();

process.on('SIGTERM', async () => {
  log('info', 'SIGTERM received, shutting down');
  await mongoose.disconnect();
  process.exit(0);
});
