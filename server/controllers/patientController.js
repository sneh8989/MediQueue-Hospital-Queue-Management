import * as patientModel from '../models/patientModel.js';
import * as auditLogModel from '../models/auditLogModel.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import AppError from '../utils/AppError.js';

export const listPatients = asyncHandler(async (req, res) => {
  const { search, gender, bloodGroup } = req.query;
  const patients = await patientModel.findAll({ search, gender, bloodGroup });
  res.json({ success: true, count: patients.length, patients });
});

export const getPatient = asyncHandler(async (req, res) => {
  const patient = await patientModel.findById(req.params.id);
  if (!patient) {
    throw new AppError('Patient not found', 404);
  }
  res.json({ success: true, patient });
});

export const createPatient = asyncHandler(async (req, res) => {
  const patient = await patientModel.create(req.body);

  await auditLogModel.record({
    userId: req.user.sub,
    userName: req.user.email,
    action: 'patient_created',
    entity: 'patient',
    entityId: patient.id,
    description: `Registered patient ${patient.name} (${patient.patientCode})`,
  });

  res.status(201).json({ success: true, patient });
});

export const updatePatient = asyncHandler(async (req, res) => {
  const existing = await patientModel.findById(req.params.id);
  if (!existing) {
    throw new AppError('Patient not found', 404);
  }

  const patient = await patientModel.update(req.params.id, req.body);

  await auditLogModel.record({
    userId: req.user.sub,
    userName: req.user.email,
    action: 'patient_updated',
    entity: 'patient',
    entityId: patient.id,
    description: `Updated patient ${patient.name} (${patient.patientCode})`,
  });

  res.json({ success: true, patient });
});
