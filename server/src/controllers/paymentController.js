const crypto = require('crypto');
const Order = require('../models/Order');
const Payment = require('../models/Payment');
const AppError = require('../utils/AppError');
const createNotification = require('../utils/createNotification');
const logAdminChange = require('../utils/activityLogger');

async function simulatePayment(req, res) {
  const { orderId, method } = req.body;
  const order = await Order.findOne({ _id: orderId, user: req.user._id });
  if (!order) throw new AppError('Order not found', 404);
  if (order.status === 'cancelled') throw new AppError('Cancelled orders cannot be paid', 409);

  const existingPayment = await Payment.findOne({ order: order._id });
  if (existingPayment) {
    order.paymentMethod = existingPayment.method;
    order.paymentStatus = existingPayment.status === 'successful' ? 'paid' : 'failed';
    await order.save();
    return res.status(200).json({
      success: true,
      message: 'This order already has a simulated payment; no second transaction was created.',
      data: { payment: existingPayment, order },
    });
  }
  if (order.paymentStatus !== 'pending') {
    throw new AppError('This order has already been processed for payment', 409);
  }

  const simulatedResponse = req.body.simulatedResponse === 'failure'
    ? 'failure'
    : 'success';
  const status = simulatedResponse === 'success' ? 'successful' : 'failed';
  const transactionId = `SIM-${Date.now()}-${crypto.randomBytes(5).toString('hex').toUpperCase()}`;
  let payment;
  try {
    payment = await Payment.create({
      order: order._id,
      user: req.user._id,
      method,
      amount: order.totalAmount,
      transactionId,
      status,
      simulatedResponse,
    });

    order.paymentMethod = method;
    order.paymentStatus = simulatedResponse === 'success' ? 'paid' : 'failed';
    await order.save();
  } catch (error) {
    if (payment) await Payment.deleteOne({ _id: payment._id });
    if (error.code === 11000) {
      const duplicatePayment = await Payment.findOne({ order: order._id });
      if (duplicatePayment) {
        order.paymentMethod = duplicatePayment.method;
        order.paymentStatus = duplicatePayment.status === 'successful' ? 'paid' : 'failed';
        await order.save();
        return res.status(200).json({
          success: true,
          data: { payment: duplicatePayment, order },
        });
      }
    }
    throw error;
  }

  const message = simulatedResponse === 'success'
    ? `Simulated payment for order ${order.orderNumber} succeeded. No real money was transferred.`
    : `Simulated payment for order ${order.orderNumber} failed. No real money was transferred.`;
  await createNotification(req.user._id, order._id, 'Payment simulation result', message, 'payment');
  await logAdminChange(req, 'payment_simulated', 'Payment', payment._id, {
    orderNumber: order.orderNumber,
    status,
    method,
    amount: payment.amount,
    simulated: true,
  });

  return res.status(201).json({
    success: true,
    message: 'Academic payment simulation only; no real transaction was made.',
    data: { payment, order },
  });
}

async function listMyPayments(req, res) {
  const payments = await Payment.find({ user: req.user._id })
    .populate('order', 'orderNumber totalAmount status')
    .sort({ createdAt: -1 });
  return res.status(200).json({ success: true, data: { payments } });
}

async function getMyPayment(req, res) {
  const payment = await Payment.findOne({ _id: req.params.id, user: req.user._id })
    .populate('order', 'orderNumber totalAmount status pickupType');
  if (!payment) throw new AppError('Payment not found', 404);
  return res.status(200).json({
    success: true,
    data: {
      payment,
      order: payment.order,
    },
  });
}

async function listPayments(req, res) {
  const filter = {};
  if (req.query.status) filter.status = req.query.status;
  if (req.query.method) filter.method = req.query.method;
  if (req.query.search) {
    const escaped = req.query.search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    filter.transactionId = { $regex: escaped, $options: 'i' };
  }
  if (req.query.startDate || req.query.endDate) {
    const start = req.query.startDate ? new Date(req.query.startDate) : new Date(0);
    const end = req.query.endDate ? new Date(req.query.endDate) : new Date();
    if (req.query.endDate && /^\d{4}-\d{2}-\d{2}$/.test(req.query.endDate)) end.setUTCHours(23, 59, 59, 999);
    if (start > end) throw new AppError('Start date must be on or before end date', 400);
    filter.createdAt = { $gte: start, $lte: end };
  }
  const page = Number(req.query.page) || 1;
  const limit = Number(req.query.limit) || 25;
  const [payments, total] = await Promise.all([
    Payment.find(filter)
    .populate('user', 'name')
    .populate('order', 'orderNumber totalAmount status')
    .sort({ createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(limit),
    Payment.countDocuments(filter),
  ]);
  return res.status(200).json({
    success: true,
    data: { payments, simulationOnly: true },
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  });
}

module.exports = { simulatePayment, listMyPayments, getMyPayment, listPayments };
