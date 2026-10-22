const crypto = require('crypto');
const Cart = require('../models/Cart');
const Category = require('../models/Category');
const MenuItem = require('../models/MenuItem');
const Order = require('../models/Order');
const User = require('../models/User');
const AppError = require('../utils/AppError');
const createNotification = require('../utils/createNotification');
const logAdminChange = require('../utils/activityLogger');
const { canTransition, calculateSubtotal } = require('../utils/orderRules');
const { isMenuItemOrderable } = require('../utils/menuRules');

async function createOrder(req, res) {
  const { pickupType, deliveryLocation, notes } = req.body;
  const idempotencyKey = req.get('Idempotency-Key');
  if (!idempotencyKey || idempotencyKey.length < 8 || idempotencyKey.length > 100) {
    throw new AppError('A valid Idempotency-Key header is required', 400);
  }
  if (pickupType === 'campus-delivery' && !deliveryLocation?.trim()) {
    throw new AppError('Delivery location is required for campus delivery', 400);
  }

  const existingOrder = await Order.findOne({ user: req.user._id, idempotencyKey });
  if (existingOrder) {
    await Cart.updateOne({ user: req.user._id }, { $set: { items: [] } });
    return res.status(200).json({ success: true, data: { order: existingOrder } });
  }

  const cart = await Cart.findOne({ user: req.user._id });
  if (!cart || cart.items.length === 0) throw new AppError('Cart is empty', 400);

  const ids = cart.items.map((item) => item.menuItem);
  const activeCategories = await Category.find({ isActive: { $ne: false } }).select('_id');
  const menuItems = await MenuItem.find({
    _id: { $in: ids },
    isAvailable: { $ne: false },
    isPublished: { $ne: false },
    category: { $in: activeCategories.map((category) => category._id) },
  }).populate('category', 'isActive');
  const byId = new Map(menuItems.map((item) => [item._id.toString(), item]));
  if (byId.size !== cart.items.length) {
    throw new AppError('One or more cart items are no longer available', 409);
  }

  const items = cart.items.map((cartItem) => {
    const menuItem = byId.get(cartItem.menuItem.toString());
    if (!menuItem) throw new AppError('A cart item is unavailable', 409);
    if (!isMenuItemOrderable(menuItem)) throw new AppError('A cart item is not currently available to order', 409);
    if (!Number.isInteger(cartItem.quantity) || cartItem.quantity < 1 || cartItem.quantity > 20) {
      throw new AppError('Cart contains an invalid item quantity', 400);
    }
    return {
      menuItem: menuItem._id,
      name: menuItem.name,
      price: menuItem.price,
      quantity: cartItem.quantity,
    };
  });
  const totalAmount = calculateSubtotal(items);
  let order;
  try {
    order = await Order.create({
      orderNumber: `SC-${Date.now().toString(36).toUpperCase()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`,
      idempotencyKey,
      user: req.user._id,
      items,
      subtotal: totalAmount,
      totalAmount,
      pickupType,
      deliveryLocation: pickupType === 'campus-delivery' ? deliveryLocation.trim() : undefined,
      notes,
    });
  } catch (error) {
    if (error.code !== 11000) throw error;
    const duplicateOrder = await Order.findOne({ user: req.user._id, idempotencyKey });
    if (!duplicateOrder) throw error;
    await Cart.updateOne({ user: req.user._id }, { $set: { items: [] } });
    return res.status(200).json({ success: true, data: { order: duplicateOrder } });
  }

  cart.items = [];
  await cart.save();
  await createNotification(
    req.user._id,
    order._id,
    'Order placed',
    `Your order ${order.orderNumber} was placed and is awaiting confirmation.`,
  );
  const foodmakers = await User.find({ role: 'foodmaker', isActive: true }).select('_id');
  await Promise.all(foodmakers.map((foodmaker) => createNotification(
    foodmaker._id,
    order._id,
    'New student order',
    `Order ${order.orderNumber} is waiting for kitchen review.`,
  )));
  await logAdminChange(req, 'order_placed', 'Order', order._id, {
    orderNumber: order.orderNumber,
    totalAmount: order.totalAmount,
  });

  return res.status(201).json({ success: true, data: { order } });
}

async function listMyOrders(req, res) {
  const orders = await Order.find({ user: req.user._id })
    .populate('items.menuItem', 'imageUrl')
    .sort({ createdAt: -1 });
  return res.status(200).json({ success: true, data: { orders } });
}

async function listOrders(req, res) {
  const filter = {};
  if (req.query.status) filter.status = req.query.status;
  if (req.query.paymentStatus) filter.paymentStatus = req.query.paymentStatus;
  if (req.query.search) {
    const escaped = req.query.search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    filter.orderNumber = { $regex: escaped, $options: 'i' };
  }
  if (req.query.startDate || req.query.endDate) {
    const start = req.query.startDate ? new Date(req.query.startDate) : new Date(0);
    const end = req.query.endDate ? new Date(req.query.endDate) : new Date();
    if (req.query.endDate && /^\d{4}-\d{2}-\d{2}$/.test(req.query.endDate)) {
      end.setUTCHours(23, 59, 59, 999);
    }
    if (start > end) throw new AppError('Start date must be on or before end date', 400);
    filter.createdAt = { $gte: start, $lte: end };
  }
  if (req.query.customer) filter.user = req.query.customer;
  if (req.query.customerSearch) {
    const escaped = req.query.customerSearch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const customers = await User.find({
      $or: [
        { name: { $regex: escaped, $options: 'i' } },
        { email: { $regex: escaped, $options: 'i' } },
      ],
    }).select('_id').limit(100);
    const matchingIds = customers.map((customer) => customer._id);
    if (filter.user) {
      filter.user = matchingIds.some((id) => id.equals(filter.user)) ? filter.user : null;
    } else {
      filter.user = { $in: matchingIds };
    }
  }
  const page = Number(req.query.page) || 1;
  const limit = Number(req.query.limit) || 100;
  const [orders, total] = await Promise.all([
    Order.find(filter)
      .populate('user', 'name')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit),
    Order.countDocuments(filter),
  ]);
  return res.status(200).json({
    success: true,
    data: { orders },
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  });
}

async function getOrder(req, res) {
  const order = await Order.findById(req.params.id)
    .populate('user', 'name')
    .populate('items.menuItem', 'imageUrl');
  if (!order) throw new AppError('Order not found', 404);
  const canViewAll = ['admin', 'foodmaker'].includes(req.user.role);
  if (!canViewAll && order.user._id.toString() !== req.user._id.toString()) {
    throw new AppError('You are not authorized to view this order', 403);
  }
  return res.status(200).json({ success: true, data: { order } });
}

async function updateOrderStatus(req, res) {
  const { status } = req.body;
  const order = await Order.findById(req.params.id);
  if (!order) throw new AppError('Order not found', 404);
  if (!canTransition(order.status, status)) {
    throw new AppError(`Order cannot transition from ${order.status} to ${status}`, 409);
  }
  if (status === 'cancelled' && order.paymentStatus === 'paid') {
    throw new AppError('Paid orders cannot be cancelled without a refund workflow', 409);
  }
  if (status === 'confirmed' && order.paymentStatus !== 'paid' && req.user.role === 'foodmaker') {
    throw new AppError('Only paid orders can be confirmed by kitchen staff', 409);
  }
  if (req.user.role === 'foodmaker' && status !== 'cancelled' && order.paymentStatus !== 'paid') {
    throw new AppError('Only paid orders can be processed by kitchen staff', 409);
  }

  order.status = status;
  order.statusHistory.push({ status, note: req.body.note });
  await order.save();
  await createNotification(
    order.user,
    order._id,
    'Order status updated',
    `Order ${order.orderNumber} is now ${status}.`,
  );
  await logAdminChange(req, 'order_status_changed', 'Order', order._id, {
    status,
    orderNumber: order.orderNumber,
  });
  return res.status(200).json({ success: true, data: { order } });
}

async function cancelOrder(req, res) {
  const order = await Order.findById(req.params.id);
  if (!order) throw new AppError('Order not found', 404);
  const isOwner = order.user.toString() === req.user._id.toString();
  if (!isOwner && req.user.role !== 'admin') {
    throw new AppError('You are not authorized to cancel this order', 403);
  }
  if (!canTransition(order.status, 'cancelled')) {
    throw new AppError('This order can no longer be cancelled', 409);
  }
  if (order.paymentStatus === 'paid') {
    throw new AppError('A paid order cannot be cancelled through this endpoint', 409);
  }
  order.status = 'cancelled';
  order.statusHistory.push({ status: 'cancelled', note: req.body.note });
  await order.save();
  await createNotification(order.user, order._id, 'Order cancelled', `Order ${order.orderNumber} was cancelled.`);
  await logAdminChange(req, 'order_cancelled', 'Order', order._id, {
    orderNumber: order.orderNumber,
  });
  return res.status(200).json({ success: true, data: { order } });
}

module.exports = { createOrder, listMyOrders, listOrders, getOrder, updateOrderStatus, cancelOrder };
