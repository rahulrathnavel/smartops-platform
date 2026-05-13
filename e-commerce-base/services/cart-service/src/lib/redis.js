'use strict';

const Redis = require('ioredis');

const REDIS_URL = process.env.REDIS_URL || 'redis://redis:6379';
const redis = new Redis(REDIS_URL, {
  maxRetriesPerRequest: 3,
  retryStrategy: (times) => Math.min(times * 200, 3000),
});

redis.on('connect', () => console.log(JSON.stringify({ level: 'info', service: 'cart-service', msg: 'Redis connected' })));
redis.on('error', (err) => console.log(JSON.stringify({ level: 'error', service: 'cart-service', msg: `Redis error: ${err.message}` })));

module.exports = redis;
