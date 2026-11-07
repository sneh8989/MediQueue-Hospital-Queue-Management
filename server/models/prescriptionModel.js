import { getDB } from '../config/db.js';
import { generateId, nowISO } from '../utils/id.js';

/**
 * Prescription shape:
 * {
 *   id, consultationId, patientId, doctorId,
 *   items: [{ id, medicineName, dosage, frequency, duration, instructions }],
 *   createdAt, updatedAt
 * }
 *
 * Items are embedded directly on the prescription document rather than a
 * separate PrescriptionItem collection - see docs/DATABASE.md for why
 * this is still consistent with the target Mongoose schema (an embedded
 * subdocument array is the natural Mongoose equivalent here too, not a
 * deviation specific to the lowdb fallback).
 */

function buildItem(raw) {
  return {
    id: generateId(),
    medicineName: raw.medicineName,
    dosage: raw.dosage,
    frequency: raw.frequency || null,
    duration: raw.duration || null,
    instructions: raw.instructions || null,
  };
}

export async function findAll({ patientId, doctorId, consultationId } = {}) {
  const db = getDB();
  let results = db.data.prescriptions;
  if (patientId) results = results.filter((p) => p.patientId === patientId);
  if (doctorId) results = results.filter((p) => p.doctorId === doctorId);
  if (consultationId) results = results.filter((p) => p.consultationId === consultationId);
  return [...results].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function findById(id) {
  const db = getDB();
  return db.data.prescriptions.find((p) => p.id === id) || null;
}

export async function findByConsultationId(consultationId) {
  const db = getDB();
  return db.data.prescriptions.find((p) => p.consultationId === consultationId) || null;
}

export async function create(data) {
  const db = getDB();
  const now = nowISO();
  const prescription = {
    id: generateId(),
    consultationId: data.consultationId,
    patientId: data.patientId,
    doctorId: data.doctorId,
    items: (data.items || []).map(buildItem),
    createdAt: now,
    updatedAt: now,
  };
  db.data.prescriptions.push(prescription);
  await db.write();
  return prescription;
}

export async function update(id, updates) {
  const db = getDB();
  const prescription = db.data.prescriptions.find((p) => p.id === id);
  if (!prescription) return null;

  const merged = { ...updates };
  if (merged.items) {
    merged.items = merged.items.map(buildItem);
  }

  Object.assign(prescription, merged, { updatedAt: nowISO() });
  await db.write();
  return prescription;
}
