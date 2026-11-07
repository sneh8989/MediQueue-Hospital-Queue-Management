import { getDB } from '../config/db.js';
import { generateId, nowISO } from '../utils/id.js';

/**
 * Appointment shape:
 * {
 *   id, patientId, doctorId, departmentId, date (YYYY-MM-DD),
 *   timeSlot (HH:mm), status, notes,
 *   createdAt, updatedAt
 * }
 *
 * Status values mirror client/src/constants/statuses.js APPOINTMENT_STATUS:
 * scheduled, confirmed, waiting, in_consultation, completed, cancelled, no_show
 */

const INACTIVE_STATUSES = new Set(['cancelled', 'no_show']);

export async function findAll({ date, doctorId, departmentId, patientId, status } = {}) {
  const db = getDB();
  let results = db.data.appointments;

  if (date) results = results.filter((a) => a.date === date);
  if (doctorId) results = results.filter((a) => a.doctorId === doctorId);
  if (departmentId) results = results.filter((a) => a.departmentId === departmentId);
  if (patientId) results = results.filter((a) => a.patientId === patientId);
  if (status) results = results.filter((a) => a.status === status);

  return [...results].sort((a, b) => {
    if (a.date !== b.date) return a.date.localeCompare(b.date);
    return a.timeSlot.localeCompare(b.timeSlot);
  });
}

export async function findById(id) {
  const db = getDB();
  return db.data.appointments.find((a) => a.id === id) || null;
}

/**
 * Returns an active (not cancelled/no_show) appointment for the same
 * doctor + date + timeSlot, if one exists. Used to prevent double-booking.
 * `excludeId` lets an update check against everyone except itself.
 */
export async function findConflict({ doctorId, date, timeSlot, excludeId }) {
  const db = getDB();
  return (
    db.data.appointments.find(
      (a) =>
        a.doctorId === doctorId &&
        a.date === date &&
        a.timeSlot === timeSlot &&
        !INACTIVE_STATUSES.has(a.status) &&
        a.id !== excludeId
    ) || null
  );
}

export async function create(data) {
  const db = getDB();
  const now = nowISO();
  const appointment = {
    id: generateId(),
    patientId: data.patientId,
    doctorId: data.doctorId,
    departmentId: data.departmentId,
    date: data.date,
    timeSlot: data.timeSlot,
    status: data.status || 'scheduled',
    notes: data.notes || null,
    createdAt: now,
    updatedAt: now,
  };
  db.data.appointments.push(appointment);
  await db.write();
  return appointment;
}

export async function update(id, updates) {
  const db = getDB();
  const appointment = db.data.appointments.find((a) => a.id === id);
  if (!appointment) return null;
  Object.assign(appointment, updates, { updatedAt: nowISO() });
  await db.write();
  return appointment;
}
