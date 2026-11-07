import * as authService from '../services/authService.js';
import AppError from '../utils/AppError.js';

export function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const [scheme, token] = header.split(' ');

  if (scheme !== 'Bearer' || !token) {
    return next(new AppError('Authentication required', 401));
  }

  try {
    const payload = authService.verifyToken(token);
    req.user = payload; // { sub, role, email }
    next();
  } catch (err) {
    next(new AppError('Invalid or expired token', 401));
  }
}
