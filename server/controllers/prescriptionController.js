import * as prescriptionModel from '../models/prescriptionModel.js';
import * as consultationModel from '../models/consultationModel.js';
import * as doctorModel from '../models/doctorModel.js';
import * as patientModel from '../models/patientModel.js';
import * as auditLogModel from '../models/auditLogModel.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import AppError from '../utils/AppError.js';

async function attachRefs(prescription) {
  const [patient, doctor] = await Promise.all([
    patientModel.findById(prescription.patientId),
    doctorModel.findById(prescription.doctorId),
  ]);
  return {
    ...prescription,
    patientName: patient?.name || null,
    patientCode: patient?.patientCode || null,
    doctorName: doctor?.name || null,
  };
}

async function resolveCallerDoctor(req) {
  if (req.user.role !== 'doctor') return null;
  return doctorModel.findByUserId(req.user.sub);
}

export const listPrescriptions = asyncHandler(async (req, res) => {
  const { patientId, consultationId } = req.query;
  let { doctorId } = req.query;

  // Same doctor-scoping pattern used for appointments/queue/consultations:
  // a doctor can only ever see their own prescriptions, regardless of any
  // doctorId query param they pass.
  if (req.user.role === 'doctor') {
    const doctor = await resolveCallerDoctor(req);
    if (!doctor) return res.json({ success: true, count: 0, prescriptions: [] });
    doctorId = doctor.id;
  }

  const prescriptions = await prescriptionModel.findAll({ patientId, doctorId, consultationId });
  const enriched = await Promise.all(prescriptions.map(attachRefs));
  res.json({ success: true, count: enriched.length, prescriptions: enriched });
});

export const getPrescription = asyncHandler(async (req, res) => {
  const prescription = await prescriptionModel.findById(req.params.id);
  if (!prescription) throw new AppError('Prescription not found', 404);
  res.json({ success: true, prescription: await attachRefs(prescription) });
});

/**
 * POST /api/prescriptions - a doctor attaches a prescription to a
 * consultation they own. One prescription per consultation, mirroring the
 * one-consultation-per-queue-entry rule from Phase 8 (use PUT to revise).
 */
export const createPrescription = asyncHandler(async (req, res) => {
  const { consultationId, items } = req.body;

  const consultation = await consultationModel.findById(consultationId);
  if (!consultation) throw new AppError('Consultation not found', 400);

  const doctor = await resolveCallerDoctor(req);
  if (!doctor || doctor.id !== consultation.doctorId) {
    throw new AppError('You can only add a prescription to your own consultation', 403);
  }

  const existing = await prescriptionModel.findByConsultationId(consultationId);
  if (existing) {
    throw new AppError('A prescription already exists for this consultation - use PUT to update it', 409);
  }

  const prescription = await prescriptionModel.create({
    consultationId,
    patientId: consultation.patientId,
    doctorId: consultation.doctorId,
    items,
  });

  await auditLogModel.record({
    userId: req.user.sub,
    userName: req.user.email,
    action: 'prescription_created',
    entity: 'prescription',
    entityId: prescription.id,
    description: `Prescribed ${prescription.items.length} medicine(s) for consultation ${consultationId}`,
  });

  res.status(201).json({ success: true, prescription: await attachRefs(prescription) });
});

export const updatePrescription = asyncHandler(async (req, res) => {
  const existing = await prescriptionModel.findById(req.params.id);
  if (!existing) throw new AppError('Prescription not found', 404);

  const doctor = await resolveCallerDoctor(req);
  if (req.user.role === 'doctor' && (!doctor || doctor.id !== existing.doctorId)) {
    throw new AppError('You can only edit your own prescriptions', 403);
  }

  const prescription = await prescriptionModel.update(req.params.id, { items: req.body.items });

  await auditLogModel.record({
    userId: req.user.sub,
    userName: req.user.email,
    action: 'prescription_updated',
    entity: 'prescription',
    entityId: prescription.id,
    description: `Updated prescription for consultation ${prescription.consultationId}`,
  });

  res.json({ success: true, prescription: await attachRefs(prescription) });
});
