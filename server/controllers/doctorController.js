import * as doctorModel from '../models/doctorModel.js';
import * as userModel from '../models/userModel.js';
import * as departmentModel from '../models/departmentModel.js';
import * as roomModel from '../models/roomModel.js';
import * as authService from '../services/authService.js';
import * as auditLogModel from '../models/auditLogModel.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import AppError from '../utils/AppError.js';

async function attachRefs(doctor) {
  const [department, room] = await Promise.all([
    doctor.departmentId ? departmentModel.findById(doctor.departmentId) : null,
    doctor.roomId ? roomModel.findById(doctor.roomId) : null,
  ]);
  return {
    ...doctor,
    departmentName: department?.name || null,
    roomNumber: room?.number || null,
  };
}

export const listDoctors = asyncHandler(async (req, res) => {
  const { departmentId } = req.query;
  const includeInactive = req.query.includeInactive === 'true' && req.user.role === 'admin';
  const doctors = await doctorModel.findAll({ departmentId, includeInactive });
  const withRefs = await Promise.all(doctors.map(attachRefs));
  res.json({ success: true, count: withRefs.length, doctors: withRefs });
});

// GET /api/doctors/me - lets a logged-in doctor resolve their own doctor
// record (department/room/avgConsultationMinutes) without needing to know
// their doctorId up front. Used by the doctor dashboard (Phase 8).
export const getMyDoctorProfile = asyncHandler(async (req, res) => {
  const doctor = await doctorModel.findByUserId(req.user.sub);
  if (!doctor) throw new AppError('No doctor profile is linked to this account', 404);
  res.json({ success: true, doctor: await attachRefs(doctor) });
});

export const getDoctor = asyncHandler(async (req, res) => {
  const doctor = await doctorModel.findById(req.params.id);
  if (!doctor) throw new AppError('Doctor not found', 404);
  res.json({ success: true, doctor: await attachRefs(doctor) });
});

/**
 * Creates a doctor. Two supported request shapes:
 * 1. { name, email, password, specialization, departmentId, roomId, phone,
 *      avgConsultationMinutes, schedule } — creates BOTH a login (`users`)
 *      account with role 'doctor' AND the doctor record in one call. This
 *      is the normal path for "Admin adds a new doctor".
 * 2. { userId, ...doctor fields } — links an existing user account (already
 *      created via user management) to a new doctor record, without
 *      creating a second login.
 */
export const createDoctor = asyncHandler(async (req, res) => {
  const { name, email, password, departmentId } = req.body;

  const department = await departmentModel.findById(departmentId);
  if (!department) {
    throw new AppError('The selected department does not exist', 400);
  }

  let userId = req.body.userId;

  if (!userId) {
    if (!email || !password) {
      throw new AppError('email and password are required to create a new doctor login', 400);
    }
    const existingUser = await userModel.findByEmail(email);
    if (existingUser) {
      throw new AppError('A user with this email already exists', 409);
    }
    const passwordHash = await authService.hashPassword(password);
    const user = await userModel.create({ name, email, passwordHash, role: 'doctor' });
    userId = user.id;
  } else {
    const existingDoctor = await doctorModel.findByUserId(userId);
    if (existingDoctor) {
      throw new AppError('This user is already linked to a doctor record', 409);
    }
  }

  const doctor = await doctorModel.create({ ...req.body, userId });

  // Keep the doctor record and room in sync if a room was assigned up front.
  if (doctor.roomId) {
    await roomModel.update(doctor.roomId, { doctorId: doctor.id, status: 'occupied' });
  }

  await auditLogModel.record({
    userId: req.user.sub,
    userName: req.user.email,
    action: 'doctor_created',
    entity: 'doctor',
    entityId: doctor.id,
    description: `Added doctor ${doctor.name} to ${department.name}`,
  });

  res.status(201).json({ success: true, doctor: await attachRefs(doctor) });
});

export const updateDoctor = asyncHandler(async (req, res) => {
  const existing = await doctorModel.findById(req.params.id);
  if (!existing) throw new AppError('Doctor not found', 404);

  if (req.body.departmentId) {
    const department = await departmentModel.findById(req.body.departmentId);
    if (!department) throw new AppError('The selected department does not exist', 400);
  }

  // If the room assignment changed, keep room statuses consistent.
  if (req.body.roomId !== undefined && req.body.roomId !== existing.roomId) {
    if (existing.roomId) {
      await roomModel.update(existing.roomId, { doctorId: null, status: 'available' });
    }
    if (req.body.roomId) {
      await roomModel.update(req.body.roomId, { doctorId: existing.id, status: 'occupied' });
    }
  }

  const doctor = await doctorModel.update(req.params.id, req.body);

  await auditLogModel.record({
    userId: req.user.sub,
    userName: req.user.email,
    action: 'doctor_updated',
    entity: 'doctor',
    entityId: doctor.id,
    description: `Updated doctor ${doctor.name}`,
  });

  res.json({ success: true, doctor: await attachRefs(doctor) });
});

export const deactivateDoctor = asyncHandler(async (req, res) => {
  const existing = await doctorModel.findById(req.params.id);
  if (!existing) throw new AppError('Doctor not found', 404);

  if (existing.roomId) {
    await roomModel.update(existing.roomId, { doctorId: null, status: 'available' });
  }

  const doctor = await doctorModel.deactivate(req.params.id);

  await auditLogModel.record({
    userId: req.user.sub,
    userName: req.user.email,
    action: 'doctor_deactivated',
    entity: 'doctor',
    entityId: doctor.id,
    description: `Deactivated doctor ${doctor.name}`,
  });

  res.json({ success: true, doctor: await attachRefs(doctor) });
});
