'use strict';

const express = require('express');
const { trace } = require('@opentelemetry/api');
const { recordTransaction, getUserTransactions } = require('../lib/dynamo');
const crypto = require('crypto');

const router = express.Router();
const tracer = trace.getTracer('payment-service');

// POST /process - process a payment (called via RabbitMQ consumer)
router.post('/process', async (req, res) => {
  const span = tracer.startSpan('payment.process');
  try {
    const { userId, orderId, amount } = req.body;
    if (!userId || !orderId || !amount) {
      span.setStatus({ code: 2, message: 'Missing fields' });
      return res.status(400).json({ error: 'userId, orderId, and amount are required' });
    }

    // Check balance via user service
    const userServiceUrl = process.env.USER_SERVICE_URL || 'http://user-service:3001';
    const profileRes = await fetch(`${userServiceUrl}/profile`, {
      headers: { 'Authorization': req.headers.authorization || '' },
    });

    if (!profileRes.ok) {
      span.setStatus({ code: 2, message: 'Failed to fetch user profile' });
      return res.status(400).json({ error: 'Could not verify user balance' });
    }

    const { user } = await profileRes.json();
    if (user.balance < amount) {
      span.setStatus({ code: 2, message: 'Insufficient balance' });
      return res.status(400).json({ error: 'Insufficient balance', balance: user.balance });
    }

    // Deduct balance
    const deductRes = await fetch(`${userServiceUrl}/balance`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, amount: -amount }),
    });

    if (!deductRes.ok) {
      span.setStatus({ code: 2, message: 'Balance deduction failed' });
      return res.status(500).json({ error: 'Balance deduction failed' });
    }

    const { balance: newBalance } = await deductRes.json();

    // Record transaction in DynamoDB
    const transactionId = `txn_${crypto.randomUUID()}`;
    const transaction = await recordTransaction(userId, transactionId, amount, orderId, 'completed');

    span.setAttribute('payment.transactionId', transactionId);
    span.setAttribute('payment.amount', amount);
    span.setStatus({ code: 1 });
    res.json({ transaction, newBalance });
  } catch (err) {
    span.recordException(err);
    span.setStatus({ code: 2, message: err.message });
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    span.end();
  }
});

// GET /transactions/:userId
router.get('/transactions/:userId', async (req, res) => {
  try {
    const transactions = await getUserTransactions(req.params.userId);
    res.json({ transactions });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
