const { validationResult } = require('express-validator');
const AppError = require('../utils/AppError');
const { removeUploadedFile } = require('../utils/imageFiles');

async function validateRequest(req, res, next) {
  const result = validationResult(req);
  if (result.isEmpty()) return next();

  try {
    await removeUploadedFile(req.file);
  } catch (error) {
    return next(error);
  }
  const details = result.array().map(({ path, msg }) => ({ field: path, message: msg }));
  return next(new AppError('Request validation failed', 400, details));
}

module.exports = validateRequest;
