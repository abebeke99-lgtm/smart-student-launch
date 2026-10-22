const jwt = require('jsonwebtoken');

function createToken(userId) {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 32 || secret === 'replace-with-a-long-random-secret') {
    throw new Error('JWT_SECRET must be set to a value of at least 32 characters');
  }

  return jwt.sign({ sub: userId.toString() }, secret, {
    expiresIn: process.env.JWT_EXPIRES_IN || '1d',
  });
}

module.exports = createToken;
