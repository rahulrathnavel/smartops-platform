'use strict';

const mongoose = require('mongoose');

const productSchema = new mongoose.Schema(
  {
    productId:        { type: String, required: true, unique: true },
    name:             { type: String, required: true },
    category:         { type: String, required: true, index: true },
    price:            { type: Number, required: true },
    rating:           { type: Number, default: 0 },
    reviewsCount:     { type: Number, default: 0 },
    stock:            { type: Number, default: 0 },
    featured:         { type: Boolean, default: false },
    colors:           [String],
    shortDescription: String,
    description:      String,
    badge:            String,
    specs:            [String],
    images:           [String],
  },
  { timestamps: true }
);

productSchema.index({ name: 'text', description: 'text' });

module.exports = mongoose.model('Product', productSchema);
