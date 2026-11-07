import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { connectDB } from '../config/db.js';
import * as authService from '../services/authService.js';
import { generateId, nowISO } from '../utils/id.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PATIENTS_PER_DOCTOR = 100;
const DEFAULT_DOCTOR_PASSWORD = 'Doctor@123';
const KNOWN_PASSWORDS = {
  'admin@mediqueue.test': 'Admin@123',
  'reception@mediqueue.test': 'Reception@123',
  'doctor@mediqueue.test': 'Doctor@123',
  'nurse@mediqueue.test': 'Nurse@123',
};

const MALE = ['Aarav','Vihaan','Aditya','Rahul','Kiran','Manish','Suresh','Rajesh','Deepak','Nikhil','Harsh','Yash','Pranav','Mehul','Jignesh','Bhavesh','Chirag','Hitesh','Dhruv','Ishan'];
const FEMALE = ['Priya','Neha','Pooja','Kavya','Anita','Sunita','Meera','Riya','Sneha','Divya','Nisha','Komal','Hetal','Jinal','Dipika','Bhumi','Krupa','Ritu','Isha','Payal'];
const LAST = ['Patel','Shah','Mehta','Desai','Joshi','Parmar','Solanki','Trivedi','Pandya','Rana','Chauhan','Thakkar','Modi','Vyas','Bhatt','Gandhi','Dave','Zala','Rathod','Prajapati'];
const BLOOD = ['A+','A-','B+','B-','AB+','AB-','O+','O-'];
const CITIES = ['Kapadvanj','Nadiad','Kheda','Anand','Ahmedabad','Vadodara','Mahemdavad','Dakor'];
const NOTES = [null,null,null,'Hypertension','Diabetes type 2','Allergic to penicillin','Asthma','No known allergies','Follow-up visit'];
const REL = ['Spouse','Parent','Sibling','Child','Friend'];

const pick = (arr, i) => arr[i % arr.length];
const pad = (n, l = 2) => String(n).padStart(l, '0');

function slotList() {
  const s = [];
  for (const [h0, h1] of [[9, 13], [14, 18]])
    for (let h = h0; h < h1; h++) for (let m = 0; m < 60; m += 10) s.push(`${pad(h)}:${pad(m)}`);
  return s; // 48 slots/day
}

async function main() {
  const db = await connectDB();
  const { users, doctors, patients, appointments } = db.data;
  const slots = slotList();
  const today = new Date();

  // 1. Make sure every login has a known password (only reset if we can't verify it).
  const creds = new Map();
  for (const u of users) {
    const wanted = KNOWN_PASSWORDS[u.email] || DEFAULT_DOCTOR_PASSWORD;
    const ok = await authService.verifyPassword(wanted, u.passwordHash);
    if (!ok) {
      u.passwordHash = await authService.hashPassword(wanted);
      u.updatedAt = nowISO();
    }
    creds.set(u.id, wanted);
  }

  // 2. 100 patients + one appointment each, per active doctor.
  let n = patients.length;
  let phoneSeq = 9800000000 + n;
  doctors.forEach((doc, di) => {
    const already = patients.filter((p) => p.seedDoctorId === doc.id).length;
    for (let i = already; i < PATIENTS_PER_DOCTOR; i++) {
      n++;
      const female = (i + di) % 2 === 0;
      const first = pick(female ? FEMALE : MALE, i * 3 + di);
      const last = pick(LAST, i * 7 + di * 5);
      const age = 5 + ((i * 11 + di * 13) % 80);
      const born = new Date(today.getFullYear() - age, (i * 5) % 12, 1 + ((i * 3) % 28));
      const now = nowISO();
      const patientId = generateId();
      phoneSeq++;
      patients.push({
        id: patientId,
        patientCode: `P-${pad(n, 4)}`,
        name: `${first} ${last}`,
        dob: born.toISOString().slice(0, 10),
        age,
        gender: female ? 'female' : 'male',
        phone: String(phoneSeq),
        email: `${first}.${last}${n}@example.test`.toLowerCase(),
        address: `${10 + (i % 90)}, ${pick(['MG Road','Station Road','Gandhi Nagar','Shivaji Chowk','Ashram Road'], i)}, ${pick(CITIES, i + di)}, Gujarat`,
        emergencyContact: { name: `${pick(FEMALE, i + 2)} ${last}`, phone: String(9700000000 + n), relation: pick(REL, i) },
        bloodGroup: pick(BLOOD, i + di),
        medicalNotes: pick(NOTES, i + di),
        isActive: true,
        createdAt: now,
        updatedAt: now,
        seedDoctorId: doc.id,
      });
      const d = new Date(today);
      d.setDate(d.getDate() + Math.floor(i / slots.length));
      appointments.push({
        id: generateId(),
        patientId,
        doctorId: doc.id,
        departmentId: doc.departmentId,
        date: d.toISOString().slice(0, 10),
        timeSlot: slots[i % slots.length],
        status: 'scheduled',
        notes: 'Dummy seed appointment',
        createdAt: now,
        updatedAt: now,
      });
    }
  });
  await db.write();

  // 3. Credentials file.
  const deptName = (id) => db.data.departments.find((x) => x.id === id)?.name || '-';
  const roomNo = (id) => db.data.rooms.find((x) => x.id === id)?.number || '-';
  const line = '='.repeat(72);
  const out = [];
  out.push('MEDIQUEUE - HOSPITAL QUEUE MANAGEMENT: STAFF ACCOUNTS', `Generated: ${nowISO()}`, 'Login URL (dev): http://localhost:5173', line, '');
  const byRole = (r) => users.filter((u) => u.role === r);

  out.push('ADMIN', '-'.repeat(72));
  byRole('admin').forEach((u) => out.push(`Name     : ${u.name}`, `Email    : ${u.email}`, `Password : ${creds.get(u.id)}`, `Active   : ${u.isActive}`, ''));

  out.push(line, 'RECEPTIONISTS', '-'.repeat(72));
  byRole('receptionist').forEach((u) => out.push(`Name     : ${u.name}`, `Email    : ${u.email}`, `Password : ${creds.get(u.id)}`, `Active   : ${u.isActive}`, ''));

  out.push(line, 'NURSES', '-'.repeat(72));
  byRole('nurse').forEach((u) => out.push(`Name     : ${u.name}`, `Email    : ${u.email}`, `Password : ${creds.get(u.id)}`, `Active   : ${u.isActive}`, ''));

  out.push(line, 'DOCTORS', '-'.repeat(72));
  byRole('doctor').forEach((u) => {
    const doc = doctors.find((d) => d.userId === u.id);
    out.push(`Name           : ${u.name}`, `Email          : ${u.email}`, `Password       : ${creds.get(u.id)}`, `Active         : ${u.isActive}`);
    if (doc) {
      const cnt = appointments.filter((a) => a.doctorId === doc.id).length;
      out.push(`Specialization : ${doc.specialization || '-'}`, `Department     : ${deptName(doc.departmentId)}`, `Room           : ${roomNo(doc.roomId)}`, `Phone          : ${doc.phone || '-'}`, `Avg consult    : ${doc.avgConsultationMinutes} min`, `Patients booked: ${cnt}`);
    } else {
      out.push('Doctor profile : (none - login only, no doctor record / no patients)');
    }
    out.push('');
  });
  out.push(line, `Totals: ${users.length} logins, ${doctors.length} doctor profiles, ${patients.length} patients, ${appointments.length} appointments`);
  const outFile = path.join(__dirname, '..', '..', 'staff-credentials.txt');
  fs.writeFileSync(outFile, out.join('\n') + '\n');
  console.log(`Wrote ${outFile}`);
  console.log(`Patients: ${patients.length}, appointments: ${appointments.length}`);
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
