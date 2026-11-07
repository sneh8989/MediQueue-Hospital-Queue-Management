import * as appointmentModel from '../models/appointmentModel.js';
import * as patientModel from '../models/patientModel.js';
import * as doctorModel from '../models/doctorModel.js';
import * as departmentModel from '../models/departmentModel.js';
import * as auditLogModel from '../models/auditLogModel.js';
import * as notificationService from '../services/notificationService.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import AppError from '../utils/AppError.js';

const VALID_STATUSES = [
  'scheduled',
  'confirmed',
  'waiting',
  'in_consultation',
  'completed',
  'cancelled',
  'no_show',
];

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

async function attachRefs(appointment) {
  const [patient, doctor, department] = await Promise.all([
    patientModel.findById(appointment.patientId),
    doctorModel.findById(appointment.doctorId),
    departmentModel.findById(appointment.departmentId),
  ]);
  return {
    ...appointment,
    patientName: patient?.name || null,
    patientCode: patient?.patientCode || null,
    patientPhone: patient?.phone || null,
    doctorName: doctor?.name || null,
    departmentName: department?.name || null,
  };
}

async function enrichList(appointments) {
  return Promise.all(appointments.map(attachRefs));
}

export const listAppointments = asyncHandler(async (req, res) => {
  const { date, doctorId, departmentId, patientId, status } = req.query;

  // Doctors can only see their own appointments unless they're also admin.
  let effectiveDoctorId = doctorId;
  if (req.user.role === 'doctor') {
    const doctor = await doctorModel.findByUserId(req.user.sub);
    if (!doctor) {
      return res.json({ success: true, count: 0, appointments: [] });
    }
    effectiveDoctorId = doctor.id;
  }

  const appointments = await appointmentModel.findAll({
    date,
    doctorId: effectiveDoctorId,
    departmentId,
    patientId,
    status,
  });
  res.json({ success: true, count: appointments.length, appointments: await enrichList(appointments) });
});

export const todayAppointments = asyncHandler(async (req, res) => {
  let effectiveDoctorId;
  if (req.user.role === 'doctor') {
    const doctor = await doctorModel.findByUserId(req.user.sub);
    if (!doctor) {
      return res.json({ success: true, count: 0, appointments: [] });
    }
    effectiveDoctorId = doctor.id;
  }

  const appointments = await appointmentModel.findAll({ date: todayISO(), doctorId: effectiveDoctorId });
  res.json({ success: true, count: appointments.length, appointments: await enrichList(appointments) });
});

export const getAppointment = asyncHandler(async (req, res) => {
  const appointment = await appointmentModel.findById(req.params.id);
  if (!appointment) throw new AppError('Appointment not found', 404);
  res.json({ success: true, appointment: await attachRefs(appointment) });
});

export const createAppointment = asyncHandler(async (req, res) => {
  const { patientId, doctorId, departmentId, date, timeSlot } = req.body;

  const [patient, doctor, department] = await Promise.all([
    patientModel.findById(patientId),
    doctorModel.findById(doctorId),
    departmentModel.findById(departmentId),
  ]);
  if (!patient) throw new AppError('Patient not found', 400);
  if (!doctor) throw new AppError('Doctor not found', 400);
  if (!department) throw new AppError('Department not found', 400);

  const conflict = await appointmentModel.findConflict({ doctorId, date, timeSlot });
  if (conflict) {
    throw new AppError('This doctor already has an appointment at that date and time slot', 409);
  }

  const appointment = await appointmentModel.create(req.body);

  await auditLogModel.record({
    userId: req.user.sub,
    userName: req.user.email,
    action: 'appointment_created',
    entity: 'appointment',
    entityId: appointment.id,
    description: `Booked ${patient.name} with Dr. ${doctor.name} on ${date} at ${timeSlot}`,
  });

  res.status(201).json({ success: true, appointment: await attachRefs(appointment) });
});

export const updateAppointment = asyncHandler(async (req, res) => {
  const existing = await appointmentModel.findById(req.params.id);
  if (!existing) throw new AppError('Appointment not found', 404);

  // Doctors may only update the status of their own appointments (e.g. mark
  // completed) — not reassign patient/doctor/date/time.
  if (req.user.role === 'doctor') {
    const doctor = await doctorModel.findByUserId(req.user.sub);
    if (!doctor || doctor.id !== existing.doctorId) {
      throw new AppError('You can only update your own appointments', 403);
    }
    const allowedFields = ['status', 'notes'];
    const attemptedFields = Object.keys(req.body);
    const disallowed = attemptedFields.filter((f) => !allowedFields.includes(f));
    if (disallowed.length) {
      throw new AppError(`Doctors can only update: ${allowedFields.join(', ')}`, 403);
    }
  }

  // If date/timeSlot is changing (a reschedule), re-check for conflicts.
  const nextDoctorId = req.body.doctorId ?? existing.doctorId;
  const nextDate = req.body.date ?? existing.date;
  const nextTimeSlot = req.body.timeSlot ?? existing.timeSlot;
  const isRescheduling =
    nextDoctorId !== existing.doctorId || nextDate !== existing.date || nextTimeSlot !== existing.timeSlot;

  if (isRescheduling) {
    const conflict = await appointmentModel.findConflict({
      doctorId: nextDoctorId,
      date: nextDate,
      timeSlot: nextTimeSlot,
      excludeId: existing.id,
    });
    if (conflict) {
      throw new AppError('This doctor already has an appointment at that date and time slot', 409);
    }
  }

  const previousStatus = existing.status;
  const appointment = await appointmentModel.update(req.params.id, req.body);

  await auditLogModel.record({
    userId: req.user.sub,
    userName: req.user.email,
    action: isRescheduling ? 'appointment_rescheduled' : 'appointment_updated',
    entity: 'appointment',
    entityId: appointment.id,
    description: isRescheduling
      ? `Rescheduled appointment to ${appointment.date} at ${appointment.timeSlot}`
      : `Updated appointment status to ${appointment.status}`,
  });

  // Only fire a notification when the status actually changed to one of
  // these two values (not on every update - e.g. a reschedule or a notes
  // edit shouldn't spam a "confirmed" notification if it was already
  // confirmed).
  if (req.body.status && req.body.status !== previousStatus) {
    const patient = await patientModel.findById(appointment.patientId);
    if (req.body.status === 'confirmed') {
      await notificationService.notifyAppointmentConfirmed(
        appointment.doctorId,
        patient?.name || 'Patient',
        appointment.date,
        appointment.timeSlot
      );
    } else if (req.body.status === 'cancelled') {
      await notificationService.notifyAppointmentCancelled(
        appointment.doctorId,
        patient?.name || 'Patient',
        appointment.date,
        appointment.timeSlot
      );
    }
  }

  res.json({ success: true, appointment: await attachRefs(appointment) });
});

export { VALID_STATUSES };
