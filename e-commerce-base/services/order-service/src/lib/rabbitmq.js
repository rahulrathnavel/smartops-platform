'use strict';

const amqp = require('amqplib');

const RABBITMQ_URL = process.env.RABBITMQ_URL || 'amqp://guest:guest@rabbitmq:5672';
let channel = null;
let connection = null;

async function connect() {
  try {
    connection = await amqp.connect(RABBITMQ_URL);
    channel = await connection.createChannel();
    await channel.assertExchange('ammazone-events', 'topic', { durable: true });
    console.log(JSON.stringify({ level: 'info', service: 'order-service', msg: 'RabbitMQ connected' }));
    return channel;
  } catch (err) {
    console.log(JSON.stringify({ level: 'error', service: 'order-service', msg: `RabbitMQ connection failed: ${err.message}` }));
    setTimeout(connect, 5000);
  }
}

function publish(routingKey, data) {
  if (!channel) throw new Error('RabbitMQ channel not ready');
  channel.publish('ammazone-events', routingKey, Buffer.from(JSON.stringify(data)), { persistent: true });
}

function getChannel() {
  return channel;
}

module.exports = { connect, publish, getChannel };
