const mongoose = require('mongoose');
const multer = require('multer');
const ApiError = require('../utils/ApiError');
const { UPLOAD, MONGO_DUPLICATE_KEY_CODE } = require('../config/constants');

const BYTES_PER_MEGABYTE = 1024 * 1024;

function fromMulterError(error) {
  if (error.code === 'LIMIT_FILE_SIZE') {
    const maxMb = UPLOAD.MAX_IMAGE_SIZE_BYTES / BYTES_PER_MEGABYTE;
    return new ApiError(413, `Image must be ${maxMb} MB or smaller`);
  }
  if (error.code === 'LIMIT_UNEXPECTED_FILE') {
    return ApiError.badRequest(`Unexpected file field: ${error.field}`);
  }
  return ApiError.badRequest(error.message);
}

// Converts known library errors into client-safe ApiErrors. Unknown errors return null.
function toApiError(error) {
  if (error instanceof ApiError) {
    return error;
  }
  if (error instanceof multer.MulterError) {
    return fromMulterError(error);
  }
  if (error instanceof mongoose.Error.CastError) {
    return ApiError.badRequest(`Invalid value for ${error.path}`);
  }
  if (error instanceof mongoose.Error.ValidationError) {
    const details = Object.values(error.errors).map((item) => ({ field: item.path, message: item.message }));
    return ApiError.badRequest('Validation failed', details);
  }
  if (error.code === MONGO_DUPLICATE_KEY_CODE) {
    const field = Object.keys(error.keyPattern || {})[0] || 'value';
    return ApiError.conflict(`That ${field} is already in use`);
  }
  if (error.type === 'entity.parse.failed') {
    return ApiError.badRequest('Request body contains invalid JSON');
  }
  if (error.type === 'entity.too.large') {
    return new ApiError(413, 'Request body is too large');
  }
  return null;
}

// Express recognises error handlers by their four arguments, so `next` must stay even though it is unused.
function errorHandler(error, req, res, next) {
  const apiError = toApiError(error);

  if (!apiError) {
    console.error(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl}`, error);
    return res.status(500).json({
      success: false,
      error: { status: 500, message: 'Internal server error' },
    });
  }

  const body = { status: apiError.statusCode, message: apiError.message };
  if (apiError.details) {
    body.details = apiError.details;
  }
  return res.status(apiError.statusCode).json({ success: false, error: body });
}

module.exports = errorHandler;
