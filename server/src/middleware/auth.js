const jwt = require('jsonwebtoken');
const User = require('../models/User');
const AppError = require('../utils/AppError');

async function protect(req, res, next) {
  const authorization = req.get('authorization');
  const match = authorization && authorization.match(/^Bearer\s+(\S+)$/i);
  if (!match) return next(new AppError('Authentication required', 401));

  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 32 || secret === 'replace-with-a-long-random-secret') {
    return next(new Error('JWT_SECRET must be set to a secure value'));
  }

  let payload;
  try {
    payload = jwt.verify(match[1], secret);
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError || error instanceof jwt.TokenExpiredError) {
      return next(new AppError('Invalid or expired authentication token', 401));
    }
    return next(error);
  }

  if (!payload || typeof payload === 'string' || typeof payload.sub !== 'string') {
    return next(new AppError('Invalid or expired authentication token', 401));
  }

  try {
    const user = await User.findById(payload.sub);
    if (!user || !user.isActive) {
      return next(new AppError('Invalid or inactive account', 401));
    }
    req.user = user;
    return next();
  } catch (error) {
    return next(error);
  }
}

function authorize(...roles) {
  return (req, res, next) => {
    if (!req.user) return next(new AppError('Authentication required', 401));
    if (!roles.includes(req.user.role)) {
      return next(new AppError('You are not authorized to access this resource', 403));
    }
    return next();
  };
}

module.exports = { protect, authorize };
