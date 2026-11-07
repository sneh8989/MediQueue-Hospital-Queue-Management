import { getDB } from '../config/db.js';
import { generateId, nowISO } from '../utils/id.js';

/**
 * Doctor shape:
 * {
 *   id, userId (links to users collection for login),
 *   name, specialization, departmentId, roomId,
 *   phone, avgConsultationMinutes, schedule (free text for now),
 *   isActive, createdAt, updatedAt
 * }
 *
 * A doctor is deliberately split across two collections: `users` holds
 * login credentials/role, `doctors` holds clinical/admin metadata. This
 * keeps auth concerns separate from scheduling concerns, and means a
 * doctor's user account can be deactivated without losing their
 * historical doctor record (consultations still reference doctorId).
 */

export async function findAll({ departmentId, includeInactive = false } = {}) {
  const db = getDB();
  let results = db.data.doctors;
  if (!includeInactive) results = results.filter((d) => d.isActive);
  if (departmentId) results = results.filter((d) => d.departmentId === departmentId);
  return [...results].sort((a, b) => a.name.localeCompare(b.name));
}

export async function findById(id) {
  const db = getDB();
  return db.data.doctors.find((d) => d.id === id) || null;
}

export async function findByUserId(userId) {
  const db = getDB();
  return db.data.doctors.find((d) => d.userId === userId) || null;
}

export async function create(data) {
  const db = getDB();
  const now = nowISO();
  const doctor = {
    id: generateId(),
    userId: data.userId,
    name: data.name,
    specialization: data.specialization || null,
    departmentId: data.departmentId,
    roomId: data.roomId || null,
    phone: data.phone || null,
    avgConsultationMinutes: data.avgConsultationMinutes ?? 5,
    schedule: data.schedule || null,
    isActive: true,
    createdAt: now,
    updatedAt: now,
  };
  db.data.doctors.push(doctor);
  await db.write();
  return doctor;
}

export async function update(id, updates) {
  const db = getDB();
  const doctor = db.data.doctors.find((d) => d.id === id);
  if (!doctor) return null;
  Object.assign(doctor, updates, { updatedAt: nowISO() });
  await db.write();
  return doctor;
}

export async function deactivate(id) {
  return update(id, { isActive: false });
}
