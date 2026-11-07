import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

process.env.NODE_ENV = 'test';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TEST_DB = path.join(__dirname, '..', 'data', 'db.prescriptions.test.json');

let app;
let server;
let baseUrl;
let adminToken, receptionToken, doctorToken, otherDoctorToken;
let deptId, doctorId, patientId;

function headers(token) {
  return { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
}

async function login(email, password) {
  const res = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  return (await res.json()).token;
}

async function makeInConsultationEntry() {
  const tokenRes = await fetch(`${baseUrl}/api/queue/token`, {
    method: 'POST',
    headers: headers(receptionToken),
    body: JSON.stringify({ patientId, departmentId: deptId, doctorId }),
  });
  const entryId = (await tokenRes.json()).entry.id;
  await fetch(`${baseUrl}/api/queue/${entryId}/call`, { method: 'POST', headers: headers(receptionToken) });
  await fetch(`${baseUrl}/api/queue/${entryId}/start`, { method: 'POST', headers: headers(receptionToken) });
  return entryId;
}

async function makeConsultation() {
  const entryId = await makeInConsultationEntry();
  const res = await fetch(`${baseUrl}/api/consultations`, {
    method: 'POST',
    headers: headers(doctorToken),
    body: JSON.stringify({ queueEntryId: entryId, diagnosis: 'Test diagnosis' }),
  });
  return (await res.json()).consultation.id;
}

before(async () => {
  if (fs.existsSync(TEST_DB)) fs.unlinkSync(TEST_DB);

  const { connectDB } = await import('../config/db.js');
  await connectDB(TEST_DB);

  const userModel = await import('../models/userModel.js');
  const authService = await import('../services/authService.js');

  await userModel.create({
    name: 'Rx Admin',
    email: 'rx-admin@mediqueue.test',
    passwordHash: await authService.hashPassword('Test@123'),
    role: 'admin',
  });
  await userModel.create({
    name: 'Rx Reception',
    email: 'rx-reception@mediqueue.test',
    passwordHash: await authService.hashPassword('Test@123'),
    role: 'receptionist',
  });

  ({ default: app } = await import('../app.js'));
  server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  baseUrl = `http://localhost:${server.address().port}`;

  adminToken = await login('rx-admin@mediqueue.test', 'Test@123');
  receptionToken = await login('rx-reception@mediqueue.test', 'Test@123');

  const deptRes = await fetch(`${baseUrl}/api/departments`, {
    method: 'POST',
    headers: headers(adminToken),
    body: JSON.stringify({ name: 'Prescription Test Dept' }),
  });
  deptId = (await deptRes.json()).department.id;

  const docRes = await fetch(`${baseUrl}/api/doctors`, {
    method: 'POST',
    headers: headers(adminToken),
    body: JSON.stringify({
      name: 'Dr. Prescription Tester',
      email: 'rx-doctor@mediqueue.test',
      password: 'DocPass1',
      departmentId: deptId,
    }),
  });
  doctorId = (await docRes.json()).doctor.id;
  doctorToken = await login('rx-doctor@mediqueue.test', 'DocPass1');

  const otherDocRes = await fetch(`${baseUrl}/api/doctors`, {
    method: 'POST',
    headers: headers(adminToken),
    body: JSON.stringify({
      name: 'Dr. Other Rx',
      email: 'rx-other-doctor@mediqueue.test',
      password: 'DocPass1',
      departmentId: deptId,
    }),
  });
  otherDoctorToken = await login('rx-other-doctor@mediqueue.test', 'DocPass1');

  const patRes = await fetch(`${baseUrl}/api/patients`, {
    method: 'POST',
    headers: headers(receptionToken),
    body: JSON.stringify({ name: 'Prescription Patient', gender: 'female', phone: '5559993333' }),
  });
  patientId = (await patRes.json()).patient.id;
});

after(async () => {
  server.close();
  if (fs.existsSync(TEST_DB)) fs.unlinkSync(TEST_DB);
});

test('receptionist cannot create a prescription (403, doctor-only)', async () => {
  const consultationId = await makeConsultation();
  const res = await fetch(`${baseUrl}/api/prescriptions`, {
    method: 'POST',
    headers: headers(receptionToken),
    body: JSON.stringify({ consultationId, items: [{ medicineName: 'Amoxicillin', dosage: '500mg' }] }),
  });
  assert.equal(res.status, 403);
});

test('creating a prescription with no items fails validation (400)', async () => {
  const consultationId = await makeConsultation();
  const res = await fetch(`${baseUrl}/api/prescriptions`, {
    method: 'POST',
    headers: headers(doctorToken),
    body: JSON.stringify({ consultationId, items: [] }),
  });
  assert.equal(res.status, 400);
});

test('an item missing dosage fails validation (400)', async () => {
  const consultationId = await makeConsultation();
  const res = await fetch(`${baseUrl}/api/prescriptions`, {
    method: 'POST',
    headers: headers(doctorToken),
    body: JSON.stringify({ consultationId, items: [{ medicineName: 'Amoxicillin' }] }),
  });
  assert.equal(res.status, 400);
});

test('a doctor cannot prescribe against another doctor\'s consultation (403)', async () => {
  const consultationId = await makeConsultation();
  const res = await fetch(`${baseUrl}/api/prescriptions`, {
    method: 'POST',
    headers: headers(otherDoctorToken),
    body: JSON.stringify({ consultationId, items: [{ medicineName: 'Ibuprofen', dosage: '200mg' }] }),
  });
  assert.equal(res.status, 403);
});

let prescriptionId, consultationForPrescription;

test('the assigned doctor creates a multi-item prescription', async () => {
  consultationForPrescription = await makeConsultation();
  const res = await fetch(`${baseUrl}/api/prescriptions`, {
    method: 'POST',
    headers: headers(doctorToken),
    body: JSON.stringify({
      consultationId: consultationForPrescription,
      items: [
        { medicineName: 'Amoxicillin', dosage: '500mg', frequency: '3x daily', duration: '7 days', instructions: 'Take with food' },
        { medicineName: 'Paracetamol', dosage: '500mg', frequency: 'as needed' },
      ],
    }),
  });
  assert.equal(res.status, 201);
  const json = await res.json();
  assert.equal(json.prescription.items.length, 2);
  assert.equal(json.prescription.items[0].medicineName, 'Amoxicillin');
  assert.equal(json.prescription.items[1].duration, null, 'optional fields default to null, not undefined/error');
  assert.equal(json.prescription.patientName, 'Prescription Patient');
  prescriptionId = json.prescription.id;
});

test('a second prescription for the same consultation is rejected (409)', async () => {
  const res = await fetch(`${baseUrl}/api/prescriptions`, {
    method: 'POST',
    headers: headers(doctorToken),
    body: JSON.stringify({ consultationId: consultationForPrescription, items: [{ medicineName: 'X', dosage: '1' }] }),
  });
  assert.equal(res.status, 409);
});

test('another doctor cannot edit this prescription (403)', async () => {
  const res = await fetch(`${baseUrl}/api/prescriptions/${prescriptionId}`, {
    method: 'PUT',
    headers: headers(otherDoctorToken),
    body: JSON.stringify({ items: [{ medicineName: 'Hijacked', dosage: '1' }] }),
  });
  assert.equal(res.status, 403);
});

test('the assigned doctor updates the prescription items', async () => {
  const res = await fetch(`${baseUrl}/api/prescriptions/${prescriptionId}`, {
    method: 'PUT',
    headers: headers(doctorToken),
    body: JSON.stringify({
      items: [{ medicineName: 'Amoxicillin', dosage: '500mg', frequency: '3x daily', duration: '10 days' }],
    }),
  });
  assert.equal(res.status, 200);
  const json = await res.json();
  assert.equal(json.prescription.items.length, 1);
  assert.equal(json.prescription.items[0].duration, '10 days');
});

test('GET /api/prescriptions scopes doctors to their own', async () => {
  const mine = await fetch(`${baseUrl}/api/prescriptions`, { headers: headers(doctorToken) });
  assert.equal((await mine.json()).count, 1);

  const others = await fetch(`${baseUrl}/api/prescriptions`, { headers: headers(otherDoctorToken) });
  assert.equal((await others.json()).count, 0);
});

test('admin can filter prescriptions by patientId', async () => {
  const res = await fetch(`${baseUrl}/api/prescriptions?patientId=${patientId}`, { headers: headers(adminToken) });
  const json = await res.json();
  assert.equal(json.count, 1);
});

test('GET /api/prescriptions/:id returns 404 for unknown id', async () => {
  const res = await fetch(`${baseUrl}/api/prescriptions/does-not-exist`, { headers: headers(adminToken) });
  assert.equal(res.status, 404);
});

test('creating a prescription against an unknown consultation fails (400)', async () => {
  const res = await fetch(`${baseUrl}/api/prescriptions`, {
    method: 'POST',
    headers: headers(doctorToken),
    body: JSON.stringify({ consultationId: 'does-not-exist', items: [{ medicineName: 'X', dosage: '1' }] }),
  });
  assert.equal(res.status, 400);
});
