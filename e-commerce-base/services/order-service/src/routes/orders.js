'use strict';

const express = require('express');
const { trace } = require('@opentelemetry/api');
const Order = require('../models/Order');
const { publish } = require('../lib/rabbitmq');

const router = express.Router();
const tracer = trace.getTracer('order-service');

// POST / - create order (triggers payment flow via RabbitMQ)
router.post('/', async (req, res) => {
  const span = tracer.startSpan('order.create');
  try {
    const { userId, items, totalAmount, shippingAddress } = req.body;
    if (!userId || !items || !items.length || !totalAmount) {
      span.setStatus({ code: 2, message: 'Missing fields' });
      return res.status(400).json({ error: 'userId, items, and totalAmount are required' });
    }

    const order = await Order.create({
      userId,
      items,
      totalAmount,
      status: 'pending',
      shippingAddress,
    });

    // Publish order.created event for Payment Service
    publish('order.created', {
      orderId: order._id.toString(),
      userId,
      totalAmount,
      items,
    });

    span.setAttribute('order.id', order._id.toString());
    span.setAttribute('order.amount', totalAmount);
    span.setStatus({ code: 1 });
    res.status(201).json({ order });
  } catch (err) {
    span.recordException(err);
    span.setStatus({ code: 2, message: err.message });
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    span.end();
  }
});

// GET /user/:userId - get user's orders
router.get('/user/:userId', async (req, res) => {
  try {
    const orders = await Order.find({ userId: req.params.userId }).sort({ createdAt: -1 }).lean();
    res.json({ orders });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /:id
router.get('/:id', async (req, res) => {
  try {
    const order = await Order.findById(req.params.id).lean();
    if (!order) return res.status(404).json({ error: 'Order not found' });
    res.json({ order });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
