const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema(
  {
    order: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Order',
      required: [true, 'Order is required'],
      index: true,
      unique: true,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User is required'],
      index: true,
    },
    method: {
      type: String,
      enum: ['telebirr', 'cbe-birr', 'mobile-banking'],
      required: [true, 'Payment method is required'],
    },
    amount: {
      type: Number,
      required: [true, 'Amount is required'],
      min: [0, 'Amount cannot be negative'],
    },
    transactionId: {
      type: String,
      unique: true,
      sparse: true,
      trim: true,
      maxlength: 200,
    },
    status: {
      type: String,
      enum: ['pending', 'successful', 'failed'],
      default: 'pending',
      required: true,
    },
    encryptedPayload: {
      type: String,
      select: false,
    },
    simulatedResponse: {
      type: String,
      enum: ['success', 'failure'],
      required: true,
    },
  },
  { timestamps: true },
);

module.exports = mongoose.model('Payment', paymentSchema);
