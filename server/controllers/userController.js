import * as userModel from '../models/userModel.js';
import * as authService from '../services/authService.js';
import * as auditLogModel from '../models/auditLogModel.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import AppError from '../utils/AppError.js';

/**
 * Admin-only staff account management, for roles that DON'T go through
 * the doctor-creation flow (Phase 4's POST /api/doctors already handles
 * creating a doctor's linked login). This covers admin/receptionist/
 * nurse accounts, plus general edit/deactivate/reset-password for ANY
 * staff account including doctors (a doctor's clinical record stays
 * managed via /api/doctors, but their login itself can be administered
 * here too - e.g. deactivating a doctor's account without touching their
 * doctors-collection row, for a temporary suspension scenario that
 * doesn't warrant the full doctor-deactivation flow from Phase 4).
 */

export const listUsers = asyncHandler(async (req, res) => {
  const users = await userModel.findAll();
  res.json({ success: true, count: users.length, users: users.map(userModel.toPublicUser) });
});

export const getUser = asyncHandler(async (req, res) => {
  const user = await userModel.findById(req.params.id);
  if (!user) throw new AppError('User not found', 404);
  res.json({ success: true, user: userModel.toPublicUser(user) });
});

export const createUser = asyncHandler(async (req, res) => {
  const { name, email, password, role } = req.body;
  // role is already constrained to admin/receptionist/nurse by
  // express-validator's isIn() rule in userRoutes.js - no need to
  // re-check here.

  const existing = await userModel.findByEmail(email);
  if (existing) {
    throw new AppError('A user with this email already exists', 409);
  }

  const passwordHash = await authService.hashPassword(password);
  const user = await userModel.create({ name, email, passwordHash, role });

  await auditLogModel.record({
    userId: req.user.sub,
    userName: req.user.email,
    action: 'user_created',
    entity: 'user',
    entityId: user.id,
    description: `Created ${role} account for ${name} (${email})`,
  });

  res.status(201).json({ success: true, user: userModel.toPublicUser(user) });
});

export const updateUser = asyncHandler(async (req, res) => {
  const existing = await userModel.findById(req.params.id);
  if (!existing) throw new AppError('User not found', 404);

  // Note: req.body.role is already constrained to admin/receptionist/
  // nurse by express-validator, so it can never literally be 'doctor'
  // here. What IS still possible - and needs an explicit block - is
  // trying to change an EXISTING doctor's role to something else,
  // which would desync the doctors collection (a doctor row still
  // references this userId). That has no valid use case through this
  // endpoint.
  if (existing.role === 'doctor' && req.body.role && req.body.role !== 'doctor') {
    throw new AppError("Changing a doctor's role away from 'doctor' is not supported here", 400);
  }

  const { password, ...fields } = req.body;
  const user = await userModel.update(req.params.id, fields);

  await auditLogModel.record({
    userId: req.user.sub,
    userName: req.user.email,
    action: 'user_updated',
    entity: 'user',
    entityId: user.id,
    description: `Updated user ${user.name}`,
  });

  res.json({ success: true, user: userModel.toPublicUser(user) });
});

export const resetPassword = asyncHandler(async (req, res) => {
  const existing = await userModel.findById(req.params.id);
  if (!existing) throw new AppError('User not found', 404);

  const passwordHash = await authService.hashPassword(req.body.password);
  const user = await userModel.update(req.params.id, { passwordHash });

  await auditLogModel.record({
    userId: req.user.sub,
    userName: req.user.email,
    action: 'user_password_reset',
    entity: 'user',
    entityId: user.id,
    description: `Reset password for ${user.name}`,
  });

  res.json({ success: true, message: 'Password reset successfully' });
});
