const ActivityLog = require('../models/ActivityLog');
const User = require('../models/User');
const AppError = require('../utils/AppError');
const createToken = require('../utils/createToken');

function userResponse(user) {
  return {
    id: user._id,
    name: user.name,
    email: user.email,
    role: user.role,
    isActive: user.isActive,
  };
}

async function register(req, res) {
  const user = await User.create({
    name: req.body.name,
    email: req.body.email,
    password: req.body.password,
    role: 'student',
  });

  const token = createToken(user._id);
  return res.status(201).json({
    success: true,
    data: { user: userResponse(user), token },
  });
}

async function login(req, res) {
  const user = await User.findOne({ email: req.body.email }).select('+password');
  const passwordMatches = user
    ? await user.comparePassword(req.body.password)
    : false;

  if (!user || !passwordMatches || !user.isActive) {
    await ActivityLog.create({
      user: user?._id,
      action: 'login_failed',
      entity: 'User',
      entityId: user?._id,
      ipAddress: req.ip,
    });
    throw new AppError('Invalid email or password', 401);
  }

  await ActivityLog.create({
    user: user._id,
    action: 'login',
    entity: 'User',
    entityId: user._id,
    ipAddress: req.ip,
  });

  const token = createToken(user._id);
  return res.status(200).json({
    success: true,
    data: { user: userResponse(user), token },
  });
}

async function getCurrentUser(req, res) {
  return res.status(200).json({
    success: true,
    data: { user: userResponse(req.user) },
  });
}

async function logout(req, res) {
  return res.status(200).json({
    success: true,
    message: 'Logged out. Discard the bearer token on the client.',
  });
}

module.exports = { register, login, getCurrentUser, logout };
