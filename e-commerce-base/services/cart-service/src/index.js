'use strict';
require('./tracing');

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const amqp = require('amqplib');
const redis = require('./lib/redis');
const cartRoutes = require('./routes/cart');
const { metricsMiddleware, metricsHandler } = require('../../shared/metrics');

const app = express();
const PORT = process.env.PORT || 3003;
const RABBITMQ_URL = process.env.RABBITMQ_URL || 'amqp://guest:guest@rabbitmq:5672';

const log = (level, msg, extra = {}) =>
  console.log(JSON.stringify({ level, service: 'cart-service', ts: new Date().toISOString(), msg, ...extra }));

app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(metricsMiddleware('cart-service'));

app.get('/health', (_req, res) => res.json({ status: 'ok', service: 'cart-service' }));
app.get('/metrics', metricsHandler);
app.use('/', cartRoutes);

// RabbitMQ consumer - listens for payment.completed to clear cart
async function setupConsumer() {
  try {
    const conn = await amqp.connect(RABBITMQ_URL);
    const channel = await conn.createChannel();
    await channel.assertExchange('ammazone-events', 'topic', { durable: true });
    const q = await channel.assertQueue('cart-clear-queue', { durable: true });
    await channel.bindQueue(q.queue, 'ammazone-events', 'payment.completed');

    channel.consume(q.queue, async (msg) => {
      if (!msg) return;
      try {
        const data = JSON.parse(msg.content.toString());
        log('info', `Clearing cart for user ${data.userId} after payment`);
        await redis.del(`cart:${data.userId}`);
        channel.ack(msg);
      } catch (err) {
        log('error', `Failed to process cart clear: ${err.message}`);
        channel.nack(msg, false, true);
      }
    });

    log('info', 'RabbitMQ consumer ready (payment.completed -> cart clear)');
  } catch (err) {
    log('error', `RabbitMQ connection failed: ${err.message}`);
    setTimeout(setupConsumer, 5000);
  }
}

app.listen(PORT, () => {
  log('info', `Cart Service listening on port ${PORT}`);
  setupConsumer();
});

process.on('SIGTERM', () => {
  log('info', 'SIGTERM received, shutting down');
  redis.quit();
  process.exit(0);
});
