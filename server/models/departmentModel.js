import { getDB } from '../config/db.js';
import { generateId, nowISO } from '../utils/id.js';

/**
 * Department shape: { id, name, description, isActive, createdAt, updatedAt }
 */

export async function findAll({ includeInactive = false } = {}) {
  const db = getDB();
  let results = db.data.departments;
  if (!includeInactive) results = results.filter((d) => d.isActive);
  return [...results].sort((a, b) => a.name.localeCompare(b.name));
}

export async function findById(id) {
  const db = getDB();
  return db.data.departments.find((d) => d.id === id) || null;
}

export async function findByName(name) {
  const db = getDB();
  const normalized = name.trim().toLowerCase();
  return db.data.departments.find((d) => d.name.toLowerCase() === normalized) || null;
}

export async function create(data) {
  const db = getDB();
  const now = nowISO();
  const department = {
    id: generateId(),
    name: data.name,
    description: data.description || null,
    isActive: true,
    createdAt: now,
    updatedAt: now,
  };
  db.data.departments.push(department);
  await db.write();
  return department;
}

export async function update(id, updates) {
  const db = getDB();
  const department = db.data.departments.find((d) => d.id === id);
  if (!department) return null;
  Object.assign(department, updates, { updatedAt: nowISO() });
  await db.write();
  return department;
}

// Deactivate rather than hard-delete, so historical doctors/appointments
// that reference this department stay meaningful.
export async function deactivate(id) {
  return update(id, { isActive: false });
}
