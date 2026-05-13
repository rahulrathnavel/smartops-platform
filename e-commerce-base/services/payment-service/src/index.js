'use strict';
require('./tracing');

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const amqp = require('amqplib');
const { recordTransaction } = require('./lib/dynamo');
const paymentRoutes = require('./routes/payments');
const crypto = require('crypto');
const { metricsMiddleware, metricsHandler } = require('../../shared/metrics');

const app = express();
const PORT = process.env.PORT || 3004;
const RABBITMQ_URL = process.env.RABBITMQ_URL || 'amqp://guest:guest@rabbitmq:5672';
const USER_SERVICE_URL = process.env.USER_SERVICE_URL || 'http://user-service:3001';

const log = (level, msg, extra = {}) =>
  console.log(JSON.stringify({ level, service: 'payment-service', ts: new Date().toISOString(), msg, ...extra }));

app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(metricsMiddleware('payment-service'));

app.get('/health', (_req, res) => res.json({ status: 'ok', service: 'payment-service' }));
app.get('/metrics', metricsHandler);
app.use('/', paymentRoutes);

let rabbitChannel = null;

// RabbitMQ consumer - listens for order.created to process payment
async function setupConsumer() {
  try {
    const conn = await amqp.connect(RABBITMQ_URL);
    const channel = await conn.createChannel();
    rabbitChannel = channel;
    await channel.assertExchange('ammazone-events', 'topic', { durable: true });
    const q = await channel.assertQueue('payment-process-queue', { durable: true });
    await channel.bindQueue(q.queue, 'ammazone-events', 'order.created');

    channel.consume(q.queue, async (msg) => {
      if (!msg) return;
      try {
        const data = JSON.parse(msg.content.toString());
        log('info', `Processing payment for order ${data.orderId}`, { userId: data.userId, amount: data.totalAmount });

        // Deduct balance via user service
        const deductRes = await fetch(`${USER_SERVICE_URL}/balance`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: data.userId, amount: -data.totalAmount }),
        });

        if (!deductRes.ok) {
          const errBody = await deductRes.json();
          log('error', `Payment failed: ${errBody.error}`, { orderId: data.orderId });
          // Publish payment.failed
          channel.publish('ammazone-events', 'payment.failed',
            Buffer.from(JSON.stringify({ orderId: data.orderId, userId: data.userId, reason: errBody.error })),
            { persistent: true }
          );
          channel.ack(msg);
          return;
        }

        // Record in DynamoDB
        const transactionId = `txn_${crypto.randomUUID()}`;
        await recordTransaction(data.userId, transactionId, data.totalAmount, data.orderId, 'completed');

        // Publish payment.completed
        channel.publish('ammazone-events', 'payment.completed',
          Buffer.from(JSON.stringify({ orderId: data.orderId, userId: data.userId, transactionId, amount: data.totalAmount })),
          { persistent: true }
        );

        log('info', `Payment completed: ${transactionId}`, { orderId: data.orderId });
        channel.ack(msg);
      } catch (err) {
        log('error', `Payment processing error: ${err.message}`);
        channel.nack(msg, false, true);
      }
    });

    log('info', 'RabbitMQ consumer ready (order.created -> process payment)');
  } catch (err) {
    log('error', `RabbitMQ connection failed: ${err.message}`);
    setTimeout(setupConsumer, 5000);
  }
}

app.listen(PORT, () => {
  log('info', `Payment Service listening on port ${PORT}`);
  setupConsumer();
});

process.on('SIGTERM', () => {
  log('info', 'SIGTERM received, shutting down');
  process.exit(0);
});
