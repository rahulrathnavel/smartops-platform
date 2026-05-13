'use strict';

const mongoose = require('mongoose');

const orderItemSchema = new mongoose.Schema({
  productId:   { type: String, required: true },
  name:        String,
  price:       { type: Number, required: true },
  quantity:    { type: Number, required: true },
  image:       String,
}, { _id: false });

const orderSchema = new mongoose.Schema(
  {
    userId:       { type: String, required: true, index: true },
    items:        [orderItemSchema],
    totalAmount:  { type: Number, required: true },
    status:       { type: String, enum: ['pending', 'paid', 'failed', 'cancelled'], default: 'pending' },
    transactionId: String,
    shippingAddress: {
      firstName: String,
      lastName:  String,
      street:    String,
      city:      String,
      postalCode: String,
      country:   String,
      phone:     String,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Order', orderSchema);
