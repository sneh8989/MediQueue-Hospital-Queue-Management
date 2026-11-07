import AppError from '../utils/AppError.js';

// Consistent error shape for every API error response:
// { success: false, message, details? }
export function notFoundHandler(req, res, next) {
  next(new AppError(`Route not found: ${req.method} ${req.originalUrl}`, 404));
}

// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, next) {
  let error = err;

  // AppError instances are intentional, safe-to-show messages crafted by
  // the controller (e.g. "Patient not found"). Anything else is an
  // unexpected exception (a bug, a driver error, etc.) whose raw message
  // could contain internal details (file paths, stack info, library
  // internals) that shouldn't reach the client - so those get a generic
  // message in the response, while the real message/stack still goes to
  // the server log below for debugging.
  if (!(error instanceof AppError)) {
    const statusCode = error.statusCode || 500;
    const safeMessage = statusCode >= 500 ? 'Internal server error' : error.message || 'Internal server error';
    error = new AppError(safeMessage, statusCode);
  }

  if (process.env.NODE_ENV !== 'test') {
    console.error(`[error] ${req.method} ${req.originalUrl} ->`, err.message);
    if (error.statusCode >= 500) console.error(err.stack);
  }

  res.status(error.statusCode).json({
    success: false,
    message: error.message,
    ...(error.details ? { details: error.details } : {}),
  });
}

export function asyncHandler(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}
