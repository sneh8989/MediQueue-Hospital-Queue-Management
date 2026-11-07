import { getDB } from '../config/db.js';
import { generateId, nowISO } from '../utils/id.js';

/**
 * User shape (mirrors the future Mongoose schema):
 * {
 *   id, name, email, passwordHash, role,
 *   isActive, doctorId (optional link if role === 'doctor'),
 *   createdAt, updatedAt
 * }
 */

export async function findAll() {
  const db = getDB();
  return db.data.users;
}

export async function findById(id) {
  const db = getDB();
  return db.data.users.find((u) => u.id === id) || null;
}

export async function findByEmail(email) {
  const db = getDB();
  const normalized = email.trim().toLowerCase();
  return db.data.users.find((u) => u.email.toLowerCase() === normalized) || null;
}

export async function create(userData) {
  const db = getDB();
  const now = nowISO();
  const user = {
    id: generateId(),
    name: userData.name,
    email: userData.email.trim().toLowerCase(),
    passwordHash: userData.passwordHash,
    role: userData.role,
    isActive: userData.isActive ?? true,
    doctorId: userData.doctorId ?? null,
    createdAt: now,
    updatedAt: now,
  };
  db.data.users.push(user);
  await db.write();
  return user;
}

export async function update(id, updates) {
  const db = getDB();
  const user = db.data.users.find((u) => u.id === id);
  if (!user) return null;
  Object.assign(user, updates, { updatedAt: nowISO() });
  await db.write();
  return user;
}

export async function remove(id) {
  const db = getDB();
  const before = db.data.users.length;
  db.data.users = db.data.users.filter((u) => u.id !== id);
  await db.write();
  return db.data.users.length < before;
}

// Never send the password hash to the client.
export function toPublicUser(user) {
  if (!user) return null;
  const { passwordHash, ...rest } = user;
  return rest;
}
