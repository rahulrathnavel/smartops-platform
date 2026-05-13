'use strict';
require('./tracing');

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const Order = require('./models/Order');
const orderRoutes = require('./routes/orders');
const rabbit = require('./lib/rabbitmq');
const { metricsMiddleware, metricsHandler } = require('../../shared/metrics');

const app = express();
const PORT = process.env.PORT || 3005;
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/ammazone-orders';

const log = (level, msg, extra = {}) =>
  console.log(JSON.stringify({ level, service: 'order-service', ts: new Date().toISOString(), msg, ...extra }));

app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(metricsMiddleware('order-service'));

app.get('/health', (_req, res) => res.json({ status: 'ok', service: 'order-service' }));
app.get('/metrics', metricsHandler);
app.use('/', orderRoutes);

// RabbitMQ consumers for payment results
async function setupConsumers(channel) {
  // payment.completed -> update order status to 'paid'
  const paidQ = await channel.assertQueue('order-paid-queue', { durable: true });
  await channel.bindQueue(paidQ.queue, 'ammazone-events', 'payment.completed');

  channel.consume(paidQ.queue, async (msg) => {
    if (!msg) return;
    try {
      const data = JSON.parse(msg.content.toString());
      log('info', `Order ${data.orderId} payment completed`);
      await Order.findByIdAndUpdate(data.orderId, {
        status: 'paid',
        transactionId: data.transactionId,
      });
      channel.ack(msg);
    } catch (err) {
      log('error', `Failed to update order: ${err.message}`);
      channel.nack(msg, false, true);
    }
  });

  // payment.failed -> update order status to 'failed'
  const failQ = await channel.assertQueue('order-fail-queue', { durable: true });
  await channel.bindQueue(failQ.queue, 'ammazone-events', 'payment.failed');

  channel.consume(failQ.queue, async (msg) => {
    if (!msg) return;
    try {
      const data = JSON.parse(msg.content.toString());
      log('info', `Order ${data.orderId} payment failed: ${data.reason}`);
      await Order.findByIdAndUpdate(data.orderId, { status: 'failed' });
      channel.ack(msg);
    } catch (err) {
      log('error', `Failed to update order: ${err.message}`);
      channel.nack(msg, false, true);
    }
  });

  log('info', 'RabbitMQ consumers ready (payment.completed/failed -> update order)');
}

async function start() {
  try {
    await mongoose.connect(MONGO_URI, { tls: process.env.MONGO_TLS !== 'false', retryWrites: false, directConnection: false });
    log('info', 'Connected to Cosmos DB (MongoDB API)');

    const channel = await rabbit.connect();
    if (channel) await setupConsumers(channel);

    app.listen(PORT, () => log('info', `Order Service listening on port ${PORT}`));
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
