'use strict';

const express = require('express');
const { trace } = require('@opentelemetry/api');
const redis = require('../lib/redis');

const router = express.Router();
const tracer = trace.getTracer('cart-service');

const cartKey = (userId) => `cart:${userId}`;

// GET /:userId
router.get('/:userId', async (req, res) => {
  const span = tracer.startSpan('cart.get');
  try {
    const data = await redis.get(cartKey(req.params.userId));
    const items = data ? JSON.parse(data) : [];
    span.setAttribute('cart.item_count', items.length);
    span.setStatus({ code: 1 });
    res.json({ items });
  } catch (err) {
    span.recordException(err);
    span.setStatus({ code: 2, message: err.message });
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    span.end();
  }
});

// POST /:userId/items
router.post('/:userId/items', async (req, res) => {
  const span = tracer.startSpan('cart.addItem');
  try {
    const { product, quantity = 1 } = req.body;
    if (!product || !product.productId) {
      return res.status(400).json({ error: 'Product data required' });
    }

    const data = await redis.get(cartKey(req.params.userId));
    const items = data ? JSON.parse(data) : [];

    const existing = items.find((i) => i.productId === product.productId);
    if (existing) {
      existing.quantity = Math.min(existing.quantity + quantity, product.stock || 99);
    } else {
      items.push({ ...product, quantity });
    }

    await redis.set(cartKey(req.params.userId), JSON.stringify(items), 'EX', 86400); // 24h TTL
    span.setStatus({ code: 1 });
    res.json({ items });
  } catch (err) {
    span.recordException(err);
    span.setStatus({ code: 2, message: err.message });
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    span.end();
  }
});

// PUT /:userId/items/:productId
router.put('/:userId/items/:productId', async (req, res) => {
  try {
    const { quantity } = req.body;
    const data = await redis.get(cartKey(req.params.userId));
    const items = data ? JSON.parse(data) : [];

    const item = items.find((i) => i.productId === req.params.productId);
    if (!item) return res.status(404).json({ error: 'Item not in cart' });

    item.quantity = Math.max(1, quantity);
    await redis.set(cartKey(req.params.userId), JSON.stringify(items), 'EX', 86400);
    res.json({ items });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /:userId/items/:productId
router.delete('/:userId/items/:productId', async (req, res) => {
  try {
    const data = await redis.get(cartKey(req.params.userId));
    let items = data ? JSON.parse(data) : [];
    items = items.filter((i) => i.productId !== req.params.productId);
    await redis.set(cartKey(req.params.userId), JSON.stringify(items), 'EX', 86400);
    res.json({ items });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /:userId - clear cart
router.delete('/:userId', async (req, res) => {
  try {
    await redis.del(cartKey(req.params.userId));
    res.json({ items: [] });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
