import { getDB } from '../config/db.js';
import { generateId, nowISO } from '../utils/id.js';

/**
 * Patient shape (mirrors the future Mongoose schema):
 * {
 *   id, patientCode, name, dob, age, gender, phone, email, address,
 *   emergencyContact: { name, phone, relation },
 *   bloodGroup, medicalNotes,
 *   isActive, createdAt, updatedAt
 * }
 */

function calculateAge(dob) {
  if (!dob) return null;
  const birth = new Date(dob);
  if (Number.isNaN(birth.getTime())) return null;
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age--;
  }
  return age;
}

async function nextPatientCode() {
  const db = getDB();
  const count = db.data.patients.length;
  const nextNumber = count + 1;
  return `P-${String(nextNumber).padStart(4, '0')}`;
}

export async function findAll({ search, gender, bloodGroup } = {}) {
  const db = getDB();
  let results = db.data.patients;

  if (search && search.trim()) {
    const term = search.trim().toLowerCase();
    results = results.filter(
      (p) =>
        p.name.toLowerCase().includes(term) ||
        p.patientCode.toLowerCase().includes(term) ||
        (p.phone && p.phone.includes(term))
    );
  }

  if (gender) {
    results = results.filter((p) => p.gender === gender);
  }

  if (bloodGroup) {
    results = results.filter((p) => p.bloodGroup === bloodGroup);
  }

  return [...results].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function findById(id) {
  const db = getDB();
  return db.data.patients.find((p) => p.id === id) || null;
}

export async function findByPhone(phone) {
  const db = getDB();
  return db.data.patients.find((p) => p.phone === phone) || null;
}

export async function create(data) {
  const db = getDB();
  const now = nowISO();
  const patient = {
    id: generateId(),
    patientCode: await nextPatientCode(),
    name: data.name,
    dob: data.dob || null,
    age: data.dob ? calculateAge(data.dob) : data.age ?? null,
    gender: data.gender,
    phone: data.phone,
    email: data.email || null,
    address: data.address || null,
    emergencyContact: data.emergencyContact || null,
    bloodGroup: data.bloodGroup || null,
    medicalNotes: data.medicalNotes || null,
    isActive: true,
    createdAt: now,
    updatedAt: now,
  };
  db.data.patients.push(patient);
  await db.write();
  return patient;
}

export async function update(id, updates) {
  const db = getDB();
  const patient = db.data.patients.find((p) => p.id === id);
  if (!patient) return null;

  const merged = { ...updates };
  if (merged.dob) {
    merged.age = calculateAge(merged.dob);
  }

  Object.assign(patient, merged, { updatedAt: nowISO() });
  await db.write();
  return patient;
}

export async function remove(id) {
  const db = getDB();
  const before = db.data.patients.length;
  db.data.patients = db.data.patients.filter((p) => p.id !== id);
  await db.write();
  return db.data.patients.length < before;
}
