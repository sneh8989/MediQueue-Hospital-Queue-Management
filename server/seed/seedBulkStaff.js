import { connectDB } from '../config/db.js';
import * as userModel from '../models/userModel.js';
import * as doctorModel from '../models/doctorModel.js';
import * as roomModel from '../models/roomModel.js';
import * as departmentModel from '../models/departmentModel.js';
import * as authService from '../services/authService.js';

/**
 * ADDITIVE SEED SCRIPT
 * ---------------------
 * Adds 50 doctors (spread across every existing department, each doctor
 * given a brand-new, unique room) and 20 nurses. It does not modify any
 * existing users, doctors, rooms, or departments — it only appends new
 * records and is safe to run once. Run again and it will skip anything
 * whose email already exists.
 *
 * Usage:  node seed/seedBulkStaff.js
 */

const DOCTOR_PASSWORD = 'Doctor@123';
const NURSE_PASSWORD = 'Nurse@123';

// Department name -> { prefix (matches existing room numbering), specialization }
const DEPARTMENT_META = {
  'Emergency Department (ED)': { prefix: 'ED', specialization: 'Emergency Medicine Physician' },
  'General Medicine': { prefix: 'GM', specialization: 'General Physician' },
  'General Surgery': { prefix: 'GS', specialization: 'General Surgeon' },
  Cardiology: { prefix: 'CARD', specialization: 'Cardiologist' },
  Neurology: { prefix: 'NEU', specialization: 'Neurologist' },
  Orthopedics: { prefix: 'ORTH', specialization: 'Orthopedic Surgeon' },
  'Obstetrics & Gynecology (OB/GYN)': { prefix: 'OBG', specialization: 'Gynecologist' },
  Psychiatry: { prefix: 'PSY', specialization: 'Psychiatrist' },
  Ophthalmology: { prefix: 'OPH', specialization: 'Ophthalmologist' },
  'Ear, Nose & Throat (ENT)': { prefix: 'ENT', specialization: 'ENT Specialist' },
  Anesthesiology: { prefix: 'ANS', specialization: 'Anesthesiologist' },
  'Intensive Care Unit (ICU)': { prefix: 'ICU', specialization: 'Intensivist' },
  'Neonatal Intensive Care Unit (NICU)': { prefix: 'NICU', specialization: 'Neonatologist' },
  Radiology: { prefix: 'RAD', specialization: 'Radiologist' },
  'Rehabilitation / Physiotherapy': { prefix: 'PHY', specialization: 'Physiotherapist' },
  'Laboratory Services': { prefix: 'LAB', specialization: 'Pathologist' },
  Pharmacy: { prefix: 'PH', specialization: 'Clinical Pharmacist' },
  'Blood Bank': { prefix: 'BB', specialization: 'Transfusion Medicine Specialist' },
  'Imaging Center (X-ray, CT, MRI, Ultrasound)': { prefix: 'IMG', specialization: 'Imaging Specialist' },
  'Nutrition & Dietetics': { prefix: 'ND', specialization: 'Dietitian' },
  'Infection Control': { prefix: 'IC', specialization: 'Infection Control Physician' },
};

const FIRST_NAMES = [
  'Aarav', 'Vivaan', 'Aditya', 'Vihaan', 'Arjun', 'Sai', 'Reyansh', 'Krishna', 'Ishaan', 'Rohan',
  'Kabir', 'Ananya', 'Diya', 'Isha', 'Kavya', 'Meera', 'Neha', 'Priya', 'Riya', 'Saanvi',
  'Tara', 'Zoya', 'Aditi', 'Bhavya', 'Chirag', 'Devansh', 'Esha', 'Farhan', 'Gaurav', 'Harini',
  'Ishita', 'Jatin', 'Kiran', 'Lavanya', 'Manish', 'Nikhil', 'Omkar', 'Pooja', 'Rakesh', 'Shreya',
  'Tanvi', 'Uday', 'Varun', 'Yash', 'Zara', 'Aisha', 'Bhavesh', 'Chitra', 'Darshan', 'Ekta',
];

const LAST_NAMES = [
  'Sharma', 'Verma', 'Gupta', 'Mehta', 'Patel', 'Shah', 'Joshi', 'Desai', 'Kapoor', 'Malhotra',
  'Chopra', 'Nair', 'Iyer', 'Menon', 'Reddy', 'Rao', 'Naidu', 'Pillai', 'Bhatt', 'Trivedi',
  'Agarwal', 'Bansal', 'Chawla', 'Dutta', 'Ghosh', 'Kulkarni', 'Mishra', 'Pandey', 'Saxena', 'Singh',
  'Thakur', 'Yadav', 'Bose', 'Chatterjee', 'Das', 'Sinha', 'Rana', 'Khanna', 'Arora', 'Bhatia',
];

function pickName(index) {
  const first = FIRST_NAMES[index % FIRST_NAMES.length];
  const last = LAST_NAMES[Math.floor(index / FIRST_NAMES.length) % LAST_NAMES.length];
  return { first, last, full: `Dr. ${first} ${last}` };
}

function nextRoomNumber(prefix, usedNumbers) {
  let n = 101;
  while (usedNumbers.has(`${prefix}-${n}`)) n += 1;
  const number = `${prefix}-${n}`;
  usedNumbers.add(number);
  return number;
}

async function seedBulkStaff() {
  const db = await connectDB();

  const departments = await departmentModel.findAll();
  const existingRooms = await roomModel.findAll();
  const usedRoomNumbers = new Set(existingRooms.map((r) => r.number));

  // Build a round-robin list of departments so the 50 doctors are spread
  // as evenly as possible across every existing department.
  const deptCycle = departments.filter((d) => DEPARTMENT_META[d.name]);
  if (deptCycle.length === 0) {
    throw new Error('[seedBulkStaff] No matching departments found — aborting.');
  }

  const TOTAL_DOCTORS = 50;
  const TOTAL_NURSES = 20;

  console.log(`[seedBulkStaff] Adding ${TOTAL_DOCTORS} doctors across ${deptCycle.length} departments...`);

  let createdDoctors = 0;
  let skippedDoctors = 0;

  for (let i = 0; i < TOTAL_DOCTORS; i += 1) {
    const department = deptCycle[i % deptCycle.length];
    const meta = DEPARTMENT_META[department.name];
    const { first, last, full } = pickName(i);

    const email = `${first.toLowerCase()}.${last.toLowerCase()}.${i + 1}@mediqueue.test`;

    const existingUser = await userModel.findByEmail(email);
    if (existingUser) {
      console.log(`[seedBulkStaff] Skipping doctor ${email} (already exists)`);
      skippedDoctors += 1;
      continue;
    }

    // Every doctor gets a brand-new room, so no two doctors ever share one.
    const roomNumber = nextRoomNumber(meta.prefix, usedRoomNumbers);
    const room = await roomModel.create({
      number: roomNumber,
      departmentId: department.id,
      status: 'available',
    });

    const passwordHash = await authService.hashPassword(DOCTOR_PASSWORD);
    const user = await userModel.create({
      name: full,
      email,
      passwordHash,
      role: 'doctor',
    });

    const doctor = await doctorModel.create({
      userId: user.id,
      name: full,
      specialization: meta.specialization,
      departmentId: department.id,
      roomId: room.id,
      phone: `98765${String(30000 + i).padStart(5, '0')}`,
      avgConsultationMinutes: 10 + (i % 4) * 5, // 10, 15, 20, 25 minute rotation
    });

    await roomModel.update(room.id, { doctorId: doctor.id, status: 'occupied' });

    createdDoctors += 1;
  }

  console.log(`[seedBulkStaff] Doctors created: ${createdDoctors}, skipped (already existed): ${skippedDoctors}`);
  console.log(`[seedBulkStaff] Adding ${TOTAL_NURSES} nurses...`);

  let createdNurses = 0;
  let skippedNurses = 0;

  for (let i = 0; i < TOTAL_NURSES; i += 1) {
    // Offset the name index so nurses don't reuse the same first/last
    // name combinations as the doctors above.
    const { first, last } = pickName(TOTAL_DOCTORS + i);
    const full = `${first} ${last}`;
    const email = `${first.toLowerCase()}.${last.toLowerCase()}.nurse${i + 1}@mediqueue.test`;

    const existingUser = await userModel.findByEmail(email);
    if (existingUser) {
      console.log(`[seedBulkStaff] Skipping nurse ${email} (already exists)`);
      skippedNurses += 1;
      continue;
    }

    const passwordHash = await authService.hashPassword(NURSE_PASSWORD);
    await userModel.create({
      name: full,
      email,
      passwordHash,
      role: 'nurse',
    });

    createdNurses += 1;
  }

  console.log(`[seedBulkStaff] Nurses created: ${createdNurses}, skipped (already existed): ${skippedNurses}`);

  await db.write();

  console.log('\n[seedBulkStaff] Done.');
  console.log(`  Doctor login password (all new doctors): ${DOCTOR_PASSWORD}`);
  console.log(`  Nurse login password (all new nurses):   ${NURSE_PASSWORD}`);

  process.exit(0);
}

seedBulkStaff().catch((err) => {
  console.error('[seedBulkStaff] Failed:', err);
  process.exit(1);
});
