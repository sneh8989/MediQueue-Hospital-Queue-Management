import { getDB } from '../config/db.js';
import { generateId, nowISO } from '../utils/id.js';

/**
 * Room shape:
 * { id, number, departmentId, doctorId, status, createdAt, updatedAt }
 * status: 'available' | 'occupied' | 'maintenance'
 */

export async function findAll({ departmentId, status } = {}) {
  const db = getDB();
  let results = db.data.rooms;
  if (departmentId) results = results.filter((r) => r.departmentId === departmentId);
  if (status) results = results.filter((r) => r.status === status);
  return [...results].sort((a, b) => a.number.localeCompare(b.number, undefined, { numeric: true }));
}

export async function findById(id) {
  const db = getDB();
  return db.data.rooms.find((r) => r.id === id) || null;
}

export async function findByNumber(number) {
  const db = getDB();
  return db.data.rooms.find((r) => r.number === number) || null;
}

export async function create(data) {
  const db = getDB();
  const now = nowISO();
  const room = {
    id: generateId(),
    number: data.number,
    departmentId: data.departmentId,
    doctorId: data.doctorId || null,
    status: data.status || 'available',
    createdAt: now,
    updatedAt: now,
  };
  db.data.rooms.push(room);
  await db.write();
  return room;
}

export async function update(id, updates) {
  const db = getDB();
  const room = db.data.rooms.find((r) => r.id === id);
  if (!room) return null;
  Object.assign(room, updates, { updatedAt: nowISO() });
  await db.write();
  return room;
}

export async function remove(id) {
  const db = getDB();
  const before = db.data.rooms.length;
  db.data.rooms = db.data.rooms.filter((r) => r.id !== id);
  await db.write();
  return db.data.rooms.length < before;
}
