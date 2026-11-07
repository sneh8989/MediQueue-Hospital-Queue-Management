import { getDB } from '../config/db.js';
import * as queueEntryModel from '../models/queueEntryModel.js';
import * as patientModel from '../models/patientModel.js';
import * as doctorModel from '../models/doctorModel.js';
import * as departmentModel from '../models/departmentModel.js';
import * as appointmentModel from '../models/appointmentModel.js';
import * as auditLogModel from '../models/auditLogModel.js';
import * as notificationService from '../services/notificationService.js';
import { transitionQueueEntry, completeQueueEntry } from '../services/queueTransitionService.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import AppError from '../utils/AppError.js';

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

async function getAvgConsultationMinutes(doctorId) {
  const doctor = await doctorModel.findById(doctorId);
  if (doctor?.avgConsultationMinutes) return doctor.avgConsultationMinutes;
  const db = getDB();
  return db.data.hospitalSettings.averageConsultationMinutes || 5;
}

async function enrich(entry) {
  const [patient, doctor, department, patientsAhead, avgMinutes] = await Promise.all([
    patientModel.findById(entry.patientId),
    doctorModel.findById(entry.doctorId),
    departmentModel.findById(entry.departmentId),
    queueEntryModel.getPatientsAhead(entry),
    getAvgConsultationMinutes(entry.doctorId),
  ]);
  return {
    ...entry,
    patientName: patient?.name || null,
    patientCode: patient?.patientCode || null,
    doctorName: doctor?.name || null,
    departmentName: department?.name || null,
    patientsAhead,
    estimatedWaitMinutes: patientsAhead !== null ? patientsAhead * avgMinutes : null,
  };
}

export const getQueue = asyncHandler(async (req, res) => {
  const { departmentId, date } = req.query;
  if (!departmentId) throw new AppError('departmentId is required', 400);

  const effectiveDate = date || todayISO();

  const [waiting, called, inConsultation, completed, skipped] = await Promise.all([
    queueEntryModel.getOrderedWaitingQueue(departmentId, effectiveDate),
    queueEntryModel.findAll({ departmentId, status: 'called', date: effectiveDate }),
    queueEntryModel.findAll({ departmentId, status: 'in_consultation', date: effectiveDate }),
    queueEntryModel.findAll({ departmentId, status: 'completed', date: effectiveDate }),
    queueEntryModel.findAll({ departmentId, status: 'skipped', date: effectiveDate }),
  ]);

  const [waitingEnriched, calledEnriched, inConsultationEnriched, completedEnriched, skippedEnriched] =
    await Promise.all([
      Promise.all(waiting.map(enrich)),
      Promise.all(called.map(enrich)),
      Promise.all(inConsultation.map(enrich)),
      Promise.all(completed.map(enrich)),
      Promise.all(skipped.map(enrich)),
    ]);

  res.json({
    success: true,
    date: effectiveDate,
    waiting: waitingEnriched,
    called: calledEnriched,
    inConsultation: inConsultationEnriched,
    completed: completedEnriched,
    skipped: skippedEnriched,
    counts: {
      waiting: waiting.length,
      called: called.length,
      inConsultation: inConsultation.length,
      completed: completed.length,
      skipped: skipped.length,
    },
  });
});

// GET /api/queue/history?patientId=... - used by the patient profile page
// to show past queue entries across all departments/dates, most recent first.
export const getPatientQueueHistory = asyncHandler(async (req, res) => {
  const { patientId } = req.query;
  if (!patientId) throw new AppError('patientId is required', 400);
  const entries = await queueEntryModel.findAll({ patientId });
  const enriched = await Promise.all(entries.map(enrich));
  res.json({ success: true, count: enriched.length, entries: enriched });
});

export const getQueueEntry = asyncHandler(async (req, res) => {
  const entry = await queueEntryModel.findById(req.params.id);
  if (!entry) throw new AppError('Queue entry not found', 404);
  res.json({ success: true, entry: await enrich(entry) });
});

export const generateToken = asyncHandler(async (req, res) => {
  let { patientId, departmentId, doctorId, priority, appointmentId } = req.body;
  let queueType = 'normal';

  if (appointmentId) {
    const appointment = await appointmentModel.findById(appointmentId);
    if (!appointment) throw new AppError('Appointment not found', 400);
    if (appointment.status === 'cancelled' || appointment.status === 'no_show') {
      throw new AppError(`Cannot check in an appointment with status "${appointment.status}"`, 400);
    }
    if (['waiting', 'in_consultation', 'completed'].includes(appointment.status)) {
      throw new AppError('A token has already been generated for this appointment', 409);
    }
    patientId = appointment.patientId;
    departmentId = appointment.departmentId;
    doctorId = appointment.doctorId;
    queueType = 'appointment';
  } else if (priority === 'emergency') {
    queueType = 'emergency';
  }

  const [patient, doctor, department] = await Promise.all([
    patientModel.findById(patientId),
    doctorModel.findById(doctorId),
    departmentModel.findById(departmentId),
  ]);
  if (!patient) throw new AppError('Patient not found', 400);
  if (!doctor) throw new AppError('Doctor not found', 400);
  if (!department) throw new AppError('Department not found', 400);

  const entry = await queueEntryModel.create({
    patientId,
    departmentId,
    doctorId,
    appointmentId: appointmentId || null,
    queueType,
    priority: priority || 'normal',
  });

  if (appointmentId) {
    await appointmentModel.update(appointmentId, { status: 'waiting' });
  }

  await auditLogModel.record({
    userId: req.user.sub,
    userName: req.user.email,
    action: 'token_generated',
    entity: 'queueEntry',
    entityId: entry.id,
    description: `Generated token ${entry.token} for ${patient.name} (${department.name})`,
  });

  await notificationService.notifyTokenGenerated(entry.doctorId, entry.token);

  res.status(201).json({ success: true, entry: await enrich(entry) });
});

async function transition(req, res, { from, to, action, timestampField }) {
  const updated = await transitionQueueEntry({
    id: req.params.id,
    from,
    to,
    action,
    timestampField,
    actor: req.user,
  });
  res.json({ success: true, entry: await enrich(updated) });
}

export const callNext = asyncHandler(async (req, res) => {
  const { departmentId } = req.body;
  if (!departmentId) throw new AppError('departmentId is required', 400);

  const ordered = await queueEntryModel.getOrderedWaitingQueue(departmentId);
  const next = ordered[0];
  if (!next) throw new AppError('No patients waiting in this department', 404);

  const updated = await queueEntryModel.update(next.id, {
    status: 'called',
    calledAt: new Date().toISOString(),
  });

  await auditLogModel.record({
    userId: req.user.sub,
    userName: req.user.email,
    action: 'token_called',
    entity: 'queueEntry',
    entityId: next.id,
    description: `Called token ${next.token}`,
  });

  await notificationService.notifyTokenCalled(next.doctorId, next.token);

  res.json({ success: true, entry: await enrich(updated) });
});

export const callSpecific = asyncHandler(async (req, res) =>
  transition(req, res, { from: 'waiting', to: 'called', action: 'call', timestampField: 'calledAt' })
);

export const skip = asyncHandler(async (req, res) =>
  transition(req, res, { from: 'called', to: 'skipped', action: 'skip' })
);

export const recall = asyncHandler(async (req, res) =>
  transition(req, res, { from: 'skipped', to: 'called', action: 'recall', timestampField: 'calledAt' })
);

export const start = asyncHandler(async (req, res) =>
  transition(req, res, { from: 'called', to: 'in_consultation', action: 'start', timestampField: 'startedAt' })
);

export const complete = asyncHandler(async (req, res) => {
  const updated = await completeQueueEntry(req.params.id, req.user);
  res.json({ success: true, entry: await enrich(updated) });
});

export const cancel = asyncHandler(async (req, res) =>
  transition(req, res, { from: ['waiting', 'called', 'skipped'], to: 'cancelled', action: 'cancel' })
);

export const markNoShow = asyncHandler(async (req, res) =>
  transition(req, res, { from: ['called', 'skipped'], to: 'no_show', action: 'no_show' })
);
