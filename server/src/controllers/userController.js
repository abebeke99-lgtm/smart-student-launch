const User = require('../models/User');
const Order = require('../models/Order');
const Payment = require('../models/Payment');
const Cart = require('../models/Cart');
const Notification = require('../models/Notification');
const AppError = require('../utils/AppError');
const logAdminChange = require('../utils/activityLogger');

function publicUser(user) {
  return {
    id: user._id,
    name: user.name,
    email: user.email,
    role: user.role,
    isActive: user.isActive,
    phone: user.phone,
    createdAt: user.createdAt,
  };
}

async function listUsers(req, res) {
  const filter = {};
  if (req.query.search) {
    const search = req.query.search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    filter.$or = [
      { name: { $regex: search, $options: 'i' } },
      { email: { $regex: search, $options: 'i' } },
    ];
  }
  if (req.query.role) filter.role = req.query.role;
  if (req.query.isActive !== undefined) {
    filter.isActive = req.query.isActive === 'true' ? { $ne: false } : false;
  }
  const page = Number(req.query.page) || 1;
  const limit = Number(req.query.limit) || 25;
  const [users, total] = await Promise.all([
    User.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit),
    User.countDocuments(filter),
  ]);
  return res.status(200).json({
    success: true,
    data: { users: users.map(publicUser) },
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  });
}

async function getUser(req, res) {
  const user = await User.findById(req.params.id);
  if (!user) throw new AppError('User not found', 404);
  return res.status(200).json({ success: true, data: { user: publicUser(user) } });
}

async function ensureAnotherActiveAdmin(user) {
  if (user.role !== 'admin' || !user.isActive) return;
  const activeAdmins = await User.countDocuments({ role: 'admin', isActive: { $ne: false } });
  if (activeAdmins <= 1) {
    throw new AppError('The final active administrator cannot be deactivated, demoted, or deleted', 409);
  }
}

async function updateProfile(req, res) {
  const allowed = {};
  if (req.body.name !== undefined) allowed.name = req.body.name;
  if (req.body.phone !== undefined) allowed.phone = req.body.phone;
  if (req.body.email !== undefined) allowed.email = req.body.email;
  Object.assign(req.user, allowed);
  await req.user.save();
  return res.status(200).json({ success: true, data: { user: publicUser(req.user) } });
}

async function updateUserStatus(req, res) {
  const user = await User.findById(req.params.id);
  if (!user) throw new AppError('User not found', 404);
  if (!req.body.isActive) await ensureAnotherActiveAdmin(user);
  user.isActive = req.body.isActive;
  await user.save();
  await logAdminChange(req, 'user_status_changed', 'User', user._id, {
    isActive: user.isActive,
  });
  return res.status(200).json({ success: true, data: { user: publicUser(user) } });
}

async function updateUserRole(req, res) {
  const user = await User.findById(req.params.id);
  if (!user) throw new AppError('User not found', 404);
  if (user._id.equals(req.user._id)) {
    throw new AppError('Administrators cannot change their own role', 409);
  }
  const previousRole = user.role;
  if (req.body.role !== 'admin') await ensureAnotherActiveAdmin(user);
  user.role = req.body.role;
  await user.save();
  await logAdminChange(req, 'user_role_changed', 'User', user._id, {
    previousRole,
    role: user.role,
  });
  return res.status(200).json({ success: true, data: { user: publicUser(user) } });
}

async function deleteUser(req, res) {
  const user = await User.findById(req.params.id);
  if (!user) throw new AppError('User not found', 404);
  if (user._id.equals(req.user._id)) {
    throw new AppError('Administrators cannot delete their own account', 409);
  }
  await ensureAnotherActiveAdmin(user);
  const [hasOrders, hasPayments] = await Promise.all([
    Order.exists({ user: user._id }),
    Payment.exists({ user: user._id }),
  ]);
  if (hasOrders || hasPayments) {
    throw new AppError('Accounts with order or payment history cannot be deleted; deactivate them instead', 409);
  }
  await Promise.all([
    Cart.deleteOne({ user: user._id }),
    Notification.deleteMany({ user: user._id }),
  ]);
  await User.deleteOne({ _id: user._id });
  await logAdminChange(req, 'user_deleted', 'User', user._id, { email: user.email });
  return res.status(200).json({ success: true, message: 'User deleted' });
}

module.exports = { listUsers, getUser, updateProfile, updateUserStatus, updateUserRole, deleteUser };
