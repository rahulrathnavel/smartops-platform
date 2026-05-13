'use strict';

const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { trace } = require('@opentelemetry/api');
const User = require('../models/User');
const authMiddleware = require('../middleware/auth');

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'default-dev-secret-change-me';
const JWT_EXPIRES = '7d';
const tracer = trace.getTracer('user-service');

// POST /signup
router.post('/signup', async (req, res) => {
  const span = tracer.startSpan('user.signup');
  try {
    const { email, password, name } = req.body;
    if (!email || !password || !name) {
      span.setStatus({ code: 2, message: 'Missing fields' });
      return res.status(400).json({ error: 'Email, password, and name are required' });
    }

    const existing = await User.findOne({ email });
    if (existing) {
      span.setStatus({ code: 2, message: 'User exists' });
      return res.status(409).json({ error: 'An account with this email already exists' });
    }

    const hashedPassword = await bcrypt.hash(password, 12);
    const user = await User.create({ email, password: hashedPassword, name, balance: 1000 });

    const token = jwt.sign({ userId: user._id, email: user.email }, JWT_SECRET, { expiresIn: JWT_EXPIRES });

    span.setAttribute('user.id', user._id.toString());
    span.setStatus({ code: 1 });
    res.status(201).json({
      token,
      user: { id: user._id, email: user.email, name: user.name, balance: user.balance },
    });
  } catch (err) {
    span.recordException(err);
    span.setStatus({ code: 2, message: err.message });
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    span.end();
  }
});

// POST /login
router.post('/login', async (req, res) => {
  const span = tracer.startSpan('user.login');
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      span.setStatus({ code: 2, message: 'Missing fields' });
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const user = await User.findOne({ email });
    if (!user) {
      span.setStatus({ code: 2, message: 'User not found' });
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
      span.setStatus({ code: 2, message: 'Bad password' });
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const token = jwt.sign({ userId: user._id, email: user.email }, JWT_SECRET, { expiresIn: JWT_EXPIRES });

    span.setAttribute('user.id', user._id.toString());
    span.setStatus({ code: 1 });
    res.json({
      token,
      user: { id: user._id, email: user.email, name: user.name, balance: user.balance },
    });
  } catch (err) {
    span.recordException(err);
    span.setStatus({ code: 2, message: err.message });
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    span.end();
  }
});

// GET /profile (authenticated)
router.get('/profile', authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.userId).select('-password');
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json({ user: { id: user._id, email: user.email, name: user.name, balance: user.balance } });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PATCH /balance (internal - used by payment service)
router.patch('/balance', async (req, res) => {
  try {
    const { userId, amount } = req.body;
    if (!userId || amount === undefined) {
      return res.status(400).json({ error: 'userId and amount are required' });
    }

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ error: 'User not found' });

    if (user.balance + amount < 0) {
      return res.status(400).json({ error: 'Insufficient balance', balance: user.balance });
    }

    user.balance += amount;
    await user.save();
    res.json({ balance: user.balance });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
