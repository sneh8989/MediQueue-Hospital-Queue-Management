import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

process.env.NODE_ENV = 'test';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TEST_DB = path.join(__dirname, '..', 'data', 'db.consultations.test.json');

let app;
let server;
let baseUrl;
let adminToken, receptionToken, doctorToken, otherDoctorToken;
let deptId, doctorId, otherDoctorId, patientId;

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

before(async () => {
  if (fs.existsSync(TEST_DB)) fs.unlinkSync(TEST_DB);

  const { connectDB } = await import('../config/db.js');
  await connectDB(TEST_DB);

  const userModel = await import('../models/userModel.js');
  const authService = await import('../services/authService.js');

  await userModel.create({
    name: 'Consult Admin',
    email: 'consult-admin@mediqueue.test',
    passwordHash: await authService.hashPassword('Test@123'),
    role: 'admin',
  });
  await userModel.create({
    name: 'Consult Reception',
    email: 'consult-reception@mediqueue.test',
    passwordHash: await authService.hashPassword('Test@123'),
    role: 'receptionist',
  });

  ({ default: app } = await import('../app.js'));
  server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  baseUrl = `http://localhost:${server.address().port}`;

  adminToken = await login('consult-admin@mediqueue.test', 'Test@123');
  receptionToken = await login('consult-reception@mediqueue.test', 'Test@123');

  const deptRes = await fetch(`${baseUrl}/api/departments`, {
    method: 'POST',
    headers: headers(adminToken),
    body: JSON.stringify({ name: 'Consultation Test Dept' }),
  });
  deptId = (await deptRes.json()).department.id;

  const docRes = await fetch(`${baseUrl}/api/doctors`, {
    method: 'POST',
    headers: headers(adminToken),
    body: JSON.stringify({
      name: 'Dr. Consultation Tester',
      email: 'consult-doctor@mediqueue.test',
      password: 'DocPass1',
      departmentId: deptId,
    }),
  });
  doctorId = (await docRes.json()).doctor.id;
  doctorToken = await login('consult-doctor@mediqueue.test', 'DocPass1');

  const otherDocRes = await fetch(`${baseUrl}/api/doctors`, {
    method: 'POST',
    headers: headers(adminToken),
    body: JSON.stringify({
      name: 'Dr. Other',
      email: 'other-doctor@mediqueue.test',
      password: 'DocPass1',
      departmentId: deptId,
    }),
  });
  otherDoctorId = (await otherDocRes.json()).doctor.id;
  otherDoctorToken = await login('other-doctor@mediqueue.test', 'DocPass1');

  const patRes = await fetch(`${baseUrl}/api/patients`, {
    method: 'POST',
    headers: headers(receptionToken),
    body: JSON.stringify({ name: 'Consultation Patient', gender: 'male', phone: '5556661111' }),
  });
  patientId = (await patRes.json()).patient.id;
});

after(async () => {
  server.close();
  if (fs.existsSync(TEST_DB)) fs.unlinkSync(TEST_DB);
});

async function makeQueueEntry() {
  const res = await fetch(`${baseUrl}/api/queue/token`, {
    method: 'POST',
    headers: headers(receptionToken),
    body: JSON.stringify({ patientId, departmentId: deptId, doctorId }),
  });
  return (await res.json()).entry.id;
}

test('receptionist cannot create a consultation (403, doctor-only)', async () => {
  const entryId = await makeQueueEntry();
  const res = await fetch(`${baseUrl}/api/consultations`, {
    method: 'POST',
    headers: headers(receptionToken),
    body: JSON.stringify({ queueEntryId: entryId, chiefComplaint: 'Test' }),
  });
  assert.equal(res.status, 403);
});

test('cannot create a consultation for a queue entry that is still waiting (409)', async () => {
  const entryId = await makeQueueEntry();
  const res = await fetch(`${baseUrl}/api/consultations`, {
    method: 'POST',
    headers: headers(doctorToken),
    body: JSON.stringify({ queueEntryId: entryId, chiefComplaint: 'Test' }),
  });
  assert.equal(res.status, 409);
});

test('a doctor cannot create a consultation for another doctor\'s queue entry (403)', async () => {
  const entryId = await makeQueueEntry();
  await fetch(`${baseUrl}/api/queue/${entryId}/call`, { method: 'POST', headers: headers(receptionToken) });
  await fetch(`${baseUrl}/api/queue/${entryId}/start`, { method: 'POST', headers: headers(receptionToken) });

  const res = await fetch(`${baseUrl}/api/consultations`, {
    method: 'POST',
    headers: headers(otherDoctorToken),
    body: JSON.stringify({ queueEntryId: entryId, chiefComplaint: 'Not my patient' }),
  });
  assert.equal(res.status, 403);
});

let consultationId, activeEntryId;

test('the assigned doctor creates a consultation once the entry is in_consultation', async () => {
  activeEntryId = await makeQueueEntry();
  await fetch(`${baseUrl}/api/queue/${activeEntryId}/call`, { method: 'POST', headers: headers(receptionToken) });
  await fetch(`${baseUrl}/api/queue/${activeEntryId}/start`, { method: 'POST', headers: headers(receptionToken) });

  const res = await fetch(`${baseUrl}/api/consultations`, {
    method: 'POST',
    headers: headers(doctorToken),
    body: JSON.stringify({
      queueEntryId: activeEntryId,
      chiefComplaint: 'Headache',
      symptoms: 'Throbbing pain, 2 days',
      diagnosis: 'Tension headache',
      notes: 'Advised rest and hydration',
    }),
  });
  assert.equal(res.status, 201);
  const json = await res.json();
  assert.equal(json.consultation.diagnosis, 'Tension headache');
  assert.equal(json.consultation.patientName, 'Consultation Patient');
  assert.equal(json.consultation.doctorName, 'Dr. Consultation Tester');
  consultationId = json.consultation.id;
});

test('a second consultation for the same queue entry is rejected (409)', async () => {
  const res = await fetch(`${baseUrl}/api/consultations`, {
    method: 'POST',
    headers: headers(doctorToken),
    body: JSON.stringify({ queueEntryId: activeEntryId, chiefComplaint: 'Duplicate' }),
  });
  assert.equal(res.status, 409);
});

test('another doctor cannot edit this consultation (403)', async () => {
  const res = await fetch(`${baseUrl}/api/consultations/${consultationId}`, {
    method: 'PUT',
    headers: headers(otherDoctorToken),
    body: JSON.stringify({ notes: 'Hijacked note' }),
  });
  assert.equal(res.status, 403);
});

test('GET /api/consultations scopes doctors to their own consultations', async () => {
  const mine = await fetch(`${baseUrl}/api/consultations`, { headers: headers(doctorToken) });
  const mineJson = await mine.json();
  assert.equal(mineJson.count, 1);

  const others = await fetch(`${baseUrl}/api/consultations`, { headers: headers(otherDoctorToken) });
  const othersJson = await others.json();
  assert.equal(othersJson.count, 0, "other doctor should not see this doctor's consultation");
});

test('admin can view all consultations, filterable by patientId', async () => {
  const res = await fetch(`${baseUrl}/api/consultations?patientId=${patientId}`, { headers: headers(adminToken) });
  assert.equal(res.status, 200);
  const json = await res.json();
  assert.equal(json.count, 1);
});

test('updating with completeConsultation:true also completes the underlying queue entry', async () => {
  const updateRes = await fetch(`${baseUrl}/api/consultations/${consultationId}`, {
    method: 'PUT',
    headers: headers(doctorToken),
    body: JSON.stringify({ notes: 'Follow up in a week', completeConsultation: true }),
  });
  assert.equal(updateRes.status, 200);
  const updateJson = await updateRes.json();
  assert.equal(updateJson.consultation.notes, 'Follow up in a week');

  const queueRes = await fetch(`${baseUrl}/api/queue/${activeEntryId}`, { headers: headers(adminToken) });
  const queueJson = await queueRes.json();
  assert.equal(queueJson.entry.status, 'completed', 'queue entry should auto-complete alongside the consultation');
});

test('GET /api/consultations/:id returns 404 for unknown id', async () => {
  const res = await fetch(`${baseUrl}/api/consultations/does-not-exist`, { headers: headers(adminToken) });
  assert.equal(res.status, 404);
});

test('creating a consultation with an invalid followUpDate fails validation (400)', async () => {
  const entryId = await makeQueueEntry();
  await fetch(`${baseUrl}/api/queue/${entryId}/call`, { method: 'POST', headers: headers(receptionToken) });
  await fetch(`${baseUrl}/api/queue/${entryId}/start`, { method: 'POST', headers: headers(receptionToken) });

  const res = await fetch(`${baseUrl}/api/consultations`, {
    method: 'POST',
    headers: headers(doctorToken),
    body: JSON.stringify({ queueEntryId: entryId, followUpDate: 'not-a-date' }),
  });
  assert.equal(res.status, 400);
});
