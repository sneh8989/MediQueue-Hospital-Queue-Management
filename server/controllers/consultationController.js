import * as consultationModel from '../models/consultationModel.js';
import * as queueEntryModel from '../models/queueEntryModel.js';
import * as doctorModel from '../models/doctorModel.js';
import * as patientModel from '../models/patientModel.js';
import * as auditLogModel from '../models/auditLogModel.js';
import { completeQueueEntry } from '../services/queueTransitionService.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import AppError from '../utils/AppError.js';

async function attachRefs(consultation) {
  const [patient, doctor] = await Promise.all([
    patientModel.findById(consultation.patientId),
    doctorModel.findById(consultation.doctorId),
  ]);
  return {
    ...consultation,
    patientName: patient?.name || null,
    patientCode: patient?.patientCode || null,
    doctorName: doctor?.name || null,
  };
}

async function resolveCallerDoctor(req) {
  if (req.user.role !== 'doctor') return null;
  return doctorModel.findByUserId(req.user.sub);
}

export const listConsultations = asyncHandler(async (req, res) => {
  const { patientId, queueEntryId } = req.query;
  let { doctorId } = req.query;

  // Doctors are scoped to their own consultations, same pattern as
  // appointments in Phase 5 - they can't view another doctor's notes by
  // guessing a doctorId query param.
  if (req.user.role === 'doctor') {
    const doctor = await resolveCallerDoctor(req);
    if (!doctor) return res.json({ success: true, count: 0, consultations: [] });
    doctorId = doctor.id;
  }

  const consultations = await consultationModel.findAll({ patientId, doctorId, queueEntryId });
  const enriched = await Promise.all(consultations.map(attachRefs));
  res.json({ success: true, count: enriched.length, consultations: enriched });
});

export const getConsultation = asyncHandler(async (req, res) => {
  const consultation = await consultationModel.findById(req.params.id);
  if (!consultation) throw new AppError('Consultation not found', 404);
  res.json({ success: true, consultation: await attachRefs(consultation) });
});

/**
 * POST /api/consultations - a doctor starts recording a consultation for a
 * queue entry that is currently 'in_consultation' and assigned to them.
 * One consultation per queue entry (a second POST for the same entry
 * updates it via PUT instead, enforced by the unique-per-entry check below).
 */
export const createConsultation = asyncHandler(async (req, res) => {
  const { queueEntryId } = req.body;

  const queueEntry = await queueEntryModel.findById(queueEntryId);
  if (!queueEntry) throw new AppError('Queue entry not found', 400);

  const doctor = await resolveCallerDoctor(req);
  if (!doctor || doctor.id !== queueEntry.doctorId) {
    throw new AppError('You can only create a consultation for your own queue entry', 403);
  }

  if (queueEntry.status !== 'in_consultation') {
    throw new AppError(
      `Cannot start a consultation record for a queue entry that is "${queueEntry.status}" (expected: in_consultation - use Start on the queue board first)`,
      409
    );
  }

  const existing = await consultationModel.findByQueueEntryId(queueEntryId);
  if (existing) {
    throw new AppError('A consultation already exists for this queue entry - use PUT to update it', 409);
  }

  const consultation = await consultationModel.create({
    queueEntryId,
    patientId: queueEntry.patientId,
    doctorId: queueEntry.doctorId,
    chiefComplaint: req.body.chiefComplaint,
    symptoms: req.body.symptoms,
    diagnosis: req.body.diagnosis,
    notes: req.body.notes,
    followUpDate: req.body.followUpDate,
  });

  await auditLogModel.record({
    userId: req.user.sub,
    userName: req.user.email,
    action: 'consultation_created',
    entity: 'consultation',
    entityId: consultation.id,
    description: `Started consultation for token ${queueEntry.token}`,
  });

  res.status(201).json({ success: true, consultation: await attachRefs(consultation) });
});

/**
 * PUT /api/consultations/:id - update consultation fields. Optionally pass
 * { completeConsultation: true } to also transition the underlying queue
 * entry to 'completed' in the same request, rather than requiring the
 * doctor to separately hit the queue board's Complete button. This is a
 * deliberate convenience: a doctor finishing their notes is the natural
 * moment to mark the visit done, and duplicating the queue's state-machine
 * validation here would risk the two getting out of sync - so this calls
 * the exact same completeQueueEntry() service the queue board's Complete
 * button uses (see docs/QUEUE_LOGIC.md).
 */
export const updateConsultation = asyncHandler(async (req, res) => {
  const existing = await consultationModel.findById(req.params.id);
  if (!existing) throw new AppError('Consultation not found', 404);

  const doctor = await resolveCallerDoctor(req);
  if (req.user.role === 'doctor' && (!doctor || doctor.id !== existing.doctorId)) {
    throw new AppError('You can only edit your own consultations', 403);
  }

  const { completeConsultation, ...fields } = req.body;

  const consultation = await consultationModel.update(req.params.id, fields);

  await auditLogModel.record({
    userId: req.user.sub,
    userName: req.user.email,
    action: 'consultation_updated',
    entity: 'consultation',
    entityId: consultation.id,
    description: `Updated consultation for ${consultation.patientId}`,
  });

  if (completeConsultation) {
    await completeQueueEntry(consultation.queueEntryId, req.user);
  }

  res.json({ success: true, consultation: await attachRefs(consultation) });
});
