import { getDB } from '../config/db.js';
import { generateId, nowISO } from '../utils/id.js';

/**
 * QueueEntry shape:
 * {
 *   id, token, patientId, appointmentId (nullable),
 *   departmentId, doctorId, queueType (normal|appointment|emergency),
 *   priority (emergency|senior_citizen|pregnant|special_needs|normal),
 *   status (waiting|called|in_consultation|completed|skipped|cancelled|no_show),
 *   date (YYYY-MM-DD, the day this token belongs to),
 *   calledAt, startedAt, completedAt,
 *   createdAt, updatedAt
 * }
 *
 * Mirrors client/src/constants/statuses.js PRIORITY_LEVELS / QUEUE_STATUS /
 * QUEUE_TYPE exactly - see docs/QUEUE_LOGIC.md for the design.
 */

// Lower weight = served first. Mirrors client PRIORITY_LEVELS.
export const PRIORITY_WEIGHT = {
  emergency: 0,
  senior_citizen: 1,
  pregnant: 1,
  special_needs: 1,
  normal: 2,
};

const TOKEN_PREFIX_BY_QUEUE_TYPE = {
  normal: 'A',
  appointment: 'B',
  emergency: 'E',
};

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Generates the next sequential token for a department on a given date,
 * e.g. "A-027". Numbering resets each day and is shared across queue
 * types within a department (so A-001, then an emergency token is
 * E-002, not E-001) - this keeps tokens unique and chronological for a
 * given department/day, which is what "patients ahead" counting relies on.
 */
async function nextToken(departmentId, date, queueType) {
  const db = getDB();
  const todaysEntries = db.data.queueEntries.filter((e) => e.departmentId === departmentId && e.date === date);
  const nextNumber = todaysEntries.length + 1;
  const prefix = TOKEN_PREFIX_BY_QUEUE_TYPE[queueType] || 'A';
  return `${prefix}-${String(nextNumber).padStart(3, '0')}`;
}

export async function create(data) {
  const db = getDB();
  const now = nowISO();
  const date = data.date || todayISO();
  const token = await nextToken(data.departmentId, date, data.queueType);

  const entry = {
    id: generateId(),
    token,
    patientId: data.patientId,
    appointmentId: data.appointmentId || null,
    departmentId: data.departmentId,
    doctorId: data.doctorId,
    queueType: data.queueType || 'normal',
    priority: data.priority || 'normal',
    status: 'waiting',
    date,
    calledAt: null,
    startedAt: null,
    completedAt: null,
    createdAt: now,
    updatedAt: now,
  };
  db.data.queueEntries.push(entry);
  await db.write();
  return entry;
}

export async function findById(id) {
  const db = getDB();
  return db.data.queueEntries.find((e) => e.id === id) || null;
}

export async function findAll({ departmentId, doctorId, patientId, status, date } = {}) {
  const db = getDB();
  let results = db.data.queueEntries;
  if (departmentId) results = results.filter((e) => e.departmentId === departmentId);
  if (doctorId) results = results.filter((e) => e.doctorId === doctorId);
  if (patientId) results = results.filter((e) => e.patientId === patientId);
  if (status) results = results.filter((e) => e.status === status);
  if (date) results = results.filter((e) => e.date === date);
  return [...results].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/**
 * Returns today's WAITING entries for a department, ordered by priority
 * weight first, then by creation time within the same weight. This is the
 * heart of the queue engine - NOT a sort by token number. See
 * docs/QUEUE_LOGIC.md.
 */
export async function getOrderedWaitingQueue(departmentId, date = todayISO()) {
  const entries = await findAll({ departmentId, status: 'waiting', date });
  return [...entries].sort((a, b) => {
    const weightA = PRIORITY_WEIGHT[a.priority] ?? 2;
    const weightB = PRIORITY_WEIGHT[b.priority] ?? 2;
    if (weightA !== weightB) return weightA - weightB;
    return a.createdAt.localeCompare(b.createdAt);
  });
}

/**
 * Position (0-based) of a specific waiting entry within the priority-
 * ordered queue, i.e. how many patients are ahead of it. Returns null if
 * the entry isn't currently waiting.
 */
export async function getPatientsAhead(entry) {
  if (entry.status !== 'waiting') return null;
  const ordered = await getOrderedWaitingQueue(entry.departmentId, entry.date);
  const index = ordered.findIndex((e) => e.id === entry.id);
  return index === -1 ? null : index;
}

export async function update(id, updates) {
  const db = getDB();
  const entry = db.data.queueEntries.find((e) => e.id === id);
  if (!entry) return null;
  Object.assign(entry, updates, { updatedAt: nowISO() });
  await db.write();
  return entry;
}
