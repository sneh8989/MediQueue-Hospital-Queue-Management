import { getDB } from '../config/db.js';
import { generateId, nowISO } from '../utils/id.js';

/**
 * Consultation shape:
 * {
 *   id, queueEntryId, patientId, doctorId,
 *   chiefComplaint, symptoms, diagnosis, notes, followUpDate,
 *   createdAt, updatedAt
 * }
 *
 * A consultation is created once a queue entry reaches
 * 'in_consultation' (see queueEntryModel / queueController) - the
 * doctor is actively seeing the patient at that point. queueEntryId
 * links back so queue history and the patient profile can surface it.
 */

export async function findAll({ patientId, doctorId, queueEntryId } = {}) {
  const db = getDB();
  let results = db.data.consultations;
  if (patientId) results = results.filter((c) => c.patientId === patientId);
  if (doctorId) results = results.filter((c) => c.doctorId === doctorId);
  if (queueEntryId) results = results.filter((c) => c.queueEntryId === queueEntryId);
  return [...results].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function findById(id) {
  const db = getDB();
  return db.data.consultations.find((c) => c.id === id) || null;
}

export async function findByQueueEntryId(queueEntryId) {
  const db = getDB();
  return db.data.consultations.find((c) => c.queueEntryId === queueEntryId) || null;
}

export async function create(data) {
  const db = getDB();
  const now = nowISO();
  const consultation = {
    id: generateId(),
    queueEntryId: data.queueEntryId,
    patientId: data.patientId,
    doctorId: data.doctorId,
    chiefComplaint: data.chiefComplaint || null,
    symptoms: data.symptoms || null,
    diagnosis: data.diagnosis || null,
    notes: data.notes || null,
    followUpDate: data.followUpDate || null,
    createdAt: now,
    updatedAt: now,
  };
  db.data.consultations.push(consultation);
  await db.write();
  return consultation;
}

export async function update(id, updates) {
  const db = getDB();
  const consultation = db.data.consultations.find((c) => c.id === id);
  if (!consultation) return null;
  Object.assign(consultation, updates, { updatedAt: nowISO() });
  await db.write();
  return consultation;
}
