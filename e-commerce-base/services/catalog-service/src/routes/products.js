'use strict';

const express = require('express');
const { trace } = require('@opentelemetry/api');
const Product = require('../models/Product');

const router = express.Router();
const tracer = trace.getTracer('catalog-service');

// GET / - list all products with optional filters
router.get('/', async (req, res) => {
  const span = tracer.startSpan('catalog.list');
  try {
    const { category, search, minRating, maxPrice, sort } = req.query;
    const filter = {};

    if (category && category !== 'All') filter.category = category;
    if (minRating) filter.rating = { $gte: parseFloat(minRating) };
    if (maxPrice) filter.price = { $lte: parseFloat(maxPrice) };
    // Note: $regex not supported well on Cosmos DB, use simple name match
    if (search) {
      filter.name = { $regex: search, $options: 'i' };
    }

    let sortObj = {};
    if (sort === 'priceAsc') sortObj = { price: 1 };
    else if (sort === 'priceDesc') sortObj = { price: -1 };
    else if (sort === 'rating') sortObj = { rating: -1 };

    let products = await Product.find(filter).sort(sortObj).lean();

    // Sort featured first in-memory (Cosmos DB can't sort booleans)
    if (!sort) {
      products.sort((a, b) => (b.featured ? 1 : 0) - (a.featured ? 1 : 0));
    }

    // (clean — no bug injected)

    span.setAttribute('catalog.result_count', products.length);
    span.setStatus({ code: 1 });
    res.json(products);
  } catch (err) {
    console.error(`Catalog list error: ${err.name}: ${err.message}`);
    span.recordException(err);
    span.setStatus({ code: 2, message: err.message });
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    span.end();
  }
});


// GET /:id - get single product
router.get('/:id', async (req, res) => {
  const span = tracer.startSpan('catalog.getById');
  try {
    const product = await Product.findOne({ productId: req.params.id }).lean();
    if (!product) {
      span.setStatus({ code: 2, message: 'Not found' });
      return res.status(404).json({ error: 'Product not found' });
    }

    // BUG: promo data undefined — crashes for terra-commute-backpack (product #3)
    if (req.params.id === 'terra-commute-backpack') {
      const promoData = undefined;
      product.salePrice = product.price - (promoData.discountPercent * product.price / 100);
    }

    span.setStatus({ code: 1 });
    res.json(product);
  } catch (err) {
    console.error(`Catalog getById error: ${err.name}: ${err.message}`);
    span.recordException(err);
    span.setStatus({ code: 2, message: err.message });
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    span.end();
  }
});

module.exports = router;
