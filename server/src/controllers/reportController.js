const Order = require('../models/Order');
const Payment = require('../models/Payment');
const User = require('../models/User');
const Category = require('../models/Category');
const MenuItem = require('../models/MenuItem');

function parseDateRange(query) {
  const end = query.endDate ? new Date(query.endDate) : new Date();
  const start = query.startDate ? new Date(query.startDate) : new Date(end);
  if (!query.startDate) start.setUTCDate(start.getUTCDate() - 30);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    const error = new Error('Invalid date filter');
    error.statusCode = 400;
    throw error;
  }
  if (query.startDate && /^\d{4}-\d{2}-\d{2}$/.test(query.startDate)) start.setUTCHours(0, 0, 0, 0);
  if (query.endDate && /^\d{4}-\d{2}-\d{2}$/.test(query.endDate)) end.setUTCHours(23, 59, 59, 999);
  if (start > end) {
    const error = new Error('Start date must be on or before end date');
    error.statusCode = 400;
    throw error;
  }
  return { createdAt: { $gte: start, $lte: end } };
}

async function dashboard(req, res) {
  const now = new Date();
  const dayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const weekStart = new Date(now);
  weekStart.setUTCDate(now.getUTCDate() - 6);
  weekStart.setUTCHours(0, 0, 0, 0);
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const salesStart = weekStart < monthStart ? weekStart : monthStart;

  const [users, menuItems, categories, orders, completed, pending, confirmed, preparing, ready, cancelled, sales] = await Promise.all([
    User.countDocuments(),
    MenuItem.countDocuments(),
    Category.countDocuments(),
    Order.countDocuments(),
    Order.countDocuments({ status: 'served' }),
    Order.countDocuments({ status: 'pending' }),
    Order.countDocuments({ status: 'confirmed' }),
    Order.countDocuments({ status: 'preparing' }),
    Order.countDocuments({ status: 'ready' }),
    Order.countDocuments({ status: 'cancelled' }),
    Order.aggregate([
      { $match: { paymentStatus: 'paid', status: { $ne: 'cancelled' }, createdAt: { $gte: salesStart } } },
      {
        $group: {
          _id: null,
          monthly: { $sum: '$totalAmount' },
          weekly: { $sum: { $cond: [{ $gte: ['$createdAt', weekStart] }, '$totalAmount', 0] } },
          daily: { $sum: { $cond: [{ $gte: ['$createdAt', dayStart] }, '$totalAmount', 0] } },
        },
      },
    ]),
  ]);
  const popularFoods = await Order.aggregate([
    { $match: { status: { $ne: 'cancelled' } } },
    { $unwind: '$items' },
    { $group: { _id: '$items.name', quantity: { $sum: '$items.quantity' } } },
    { $sort: { quantity: -1 } },
    { $limit: 5 },
  ]);
  const statusDistribution = await Order.aggregate([
    { $group: { _id: '$status', count: { $sum: 1 } } },
    { $sort: { _id: 1 } },
  ]);

  return res.status(200).json({
    success: true,
    data: {
      totals: { users, menuItems, categories, orders, completed, pending, confirmed, preparing, ready, cancelled },
      sales: sales[0] || { daily: 0, weekly: 0, monthly: 0 },
      popularFoods,
      statusDistribution,
    },
  });
}

async function ordersReport(req, res) {
  const match = parseDateRange(req.query);
  if (req.query.status) match.status = req.query.status;
  if (req.query.customerSearch) {
    const escaped = req.query.customerSearch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const users = await User.find({
      $or: [
        { name: { $regex: escaped, $options: 'i' } },
        { email: { $regex: escaped, $options: 'i' } },
      ],
    }).select('_id').limit(100);
    match.user = { $in: users.map((user) => user._id) };
  }
  const page = Number(req.query.page) || 1;
  const limit = Number(req.query.limit) || 50;
  const [orders, total] = await Promise.all([
    Order.find(match)
      .populate('user', 'name')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit),
    Order.countDocuments(match),
  ]);
  return res.status(200).json({
    success: true,
    data: { orders },
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  });
}

async function salesReport(req, res) {
  const { createdAt } = parseDateRange(req.query);
  const sales = await Order.aggregate([
    { $match: { paymentStatus: 'paid', status: { $ne: 'cancelled' }, createdAt } },
    {
      $group: {
        _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt', timezone: 'UTC' } },
        sales: { $sum: '$totalAmount' },
        orders: { $sum: 1 },
      },
    },
    { $sort: { _id: 1 } },
  ]);
  return res.status(200).json({
    success: true,
    definition: 'Sales sum order totals where paymentStatus is paid and order status is not cancelled; dates use order creation time in UTC.',
    data: { sales },
  });
}

async function popularFoods(req, res) {
  const { createdAt } = parseDateRange(req.query);
  const items = await Order.aggregate([
    { $match: { createdAt, status: { $ne: 'cancelled' } } },
    { $unwind: '$items' },
    {
      $group: {
        _id: '$items.name',
        quantity: { $sum: '$items.quantity' },
        revenue: { $sum: { $multiply: ['$items.price', '$items.quantity'] } },
      },
    },
    { $sort: { quantity: -1 } },
    {
      $facet: {
        items: [
          { $skip: (Number(req.query.page) - 1) * Number(req.query.limit) || 0 },
          { $limit: Number(req.query.limit) || 50 },
        ],
        total: [{ $count: 'count' }],
      },
    },
  ]);
  const result = items[0] || { items: [], total: [] };
  return res.status(200).json({
    success: true,
    definition: 'Popular-food counts and revenue use order-item price snapshots from all non-cancelled orders, including unpaid orders.',
    data: { items: result.items },
    pagination: {
      page: Number(req.query.page) || 1,
      limit: Number(req.query.limit) || 50,
      total: result.total[0]?.count || 0,
      totalPages: Math.ceil((result.total[0]?.count || 0) / (Number(req.query.limit) || 50)),
    },
  });
}

async function paymentsReport(req, res) {
  const { createdAt } = parseDateRange(req.query);
  const filter = { createdAt };
  if (req.query.status) filter.status = req.query.status;
  if (req.query.method) filter.method = req.query.method;
  if (req.query.search) {
    const escaped = req.query.search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    filter.transactionId = { $regex: escaped, $options: 'i' };
  }
  const page = Number(req.query.page) || 1;
  const limit = Number(req.query.limit) || 50;
  const [payments, total] = await Promise.all([
    Payment.find(filter)
      .populate('order', 'orderNumber')
      .populate('user', 'name')
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

module.exports = { dashboard, ordersReport, salesReport, popularFoods, paymentsReport };
