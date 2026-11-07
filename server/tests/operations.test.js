import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

process.env.NODE_ENV = 'test';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TEST_DB = path.join(__dirname, '..', 'data', 'db.operations.test.json');

let app;
let server;
let baseUrl;
let adminToken, receptionToken, nurseToken, doctorToken;
let deptA, deptB, emptyDept, doctorA, doctorB;
let queueEntryModel;
let phoneSeq = 0;

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

async function post(token, url, body) {
  const res = await fetch(`${baseUrl}${url}`, { method: 'POST', headers: headers(token), body: body ? JSON.stringify(body) : undefined });
  return res.json();
}

const getOps = (token, query = '') => fetch(`${baseUrl}/api/dashboard/operations${query}`, { headers: headers(token) });

async function newPatient(label) {
  phoneSeq += 1;
  const json = await post(receptionToken, '/api/patients', {
    name: `Ops Patient ${label}`,
    gender: 'male',
    phone: `55577${String(phoneSeq).padStart(5, '0')}`,
  });
  return json.patient.id;
}

async function newToken(departmentId, doctorId, label, priority) {
  const patientId = await newPatient(label);
  const json = await post(receptionToken, '/api/queue/token', { patientId, departmentId, doctorId, ...(priority ? { priority } : {}) });
  return json.entry;
}

before(async () => {
  if (fs.existsSync(TEST_DB)) fs.unlinkSync(TEST_DB);

  const { connectDB } = await import('../config/db.js');
  await connectDB(TEST_DB);

  const userModel = await import('../models/userModel.js');
  const authService = await import('../services/authService.js');
  queueEntryModel = await import('../models/queueEntryModel.js');

  for (const [name, email, role] of [
    ['Ops Admin', 'ops-admin@mediqueue.test', 'admin'],
    ['Ops Reception', 'ops-reception@mediqueue.test', 'receptionist'],
    ['Ops Nurse', 'ops-nurse@mediqueue.test', 'nurse'],
  ]) {
    await userModel.create({ name, email, passwordHash: await authService.hashPassword('Test@123'), role });
  }

  ({ default: app } = await import('../app.js'));
  server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  baseUrl = `http://localhost:${server.address().port}`;

  adminToken = await login('ops-admin@mediqueue.test', 'Test@123');
  receptionToken = await login('ops-reception@mediqueue.test', 'Test@123');
  nurseToken = await login('ops-nurse@mediqueue.test', 'Test@123');

  deptA = (await post(adminToken, '/api/departments', { name: 'Ops Dept A' })).department.id;
  deptB = (await post(adminToken, '/api/departments', { name: 'Ops Dept B' })).department.id;
  emptyDept = (await post(adminToken, '/api/departments', { name: 'Ops Empty Dept' })).department.id;

  doctorA = (await post(adminToken, '/api/doctors', { name: 'Dr. Ops A', email: 'ops-doc-a@mediqueue.test', password: 'DocPass1', departmentId: deptA })).doctor.id;
  doctorB = (await post(adminToken, '/api/doctors', { name: 'Dr. Ops B', email: 'ops-doc-b@mediqueue.test', password: 'DocPass1', departmentId: deptB })).doctor.id;
  doctorToken = await login('ops-doc-a@mediqueue.test', 'DocPass1');
});

after(async () => {
  server.close();
  if (fs.existsSync(TEST_DB)) fs.unlinkSync(TEST_DB);
});

test('unauthenticated request is rejected (401)', async () => {
  const res = await fetch(`${baseUrl}/api/dashboard/operations`);
  assert.equal(res.status, 401);
});

test('doctors are not allowed (403) - they have their own dashboard', async () => {
  assert.equal((await getOps(doctorToken)).status, 403);
});

test('admin, receptionist and nurse can all read it (200)', async () => {
  for (const token of [adminToken, receptionToken, nurseToken]) {
    assert.equal((await getOps(token)).status, 200);
  }
});

test('the admin-only analytics summary is still admin-only (not loosened by this feature)', async () => {
  for (const token of [receptionToken, nurseToken]) {
    const res = await fetch(`${baseUrl}/api/dashboard/summary`, { headers: headers(token) });
    assert.equal(res.status, 403);
  }
});

test('a malformed date is rejected (400)', async () => {
  for (const bad of ['2026/09/30', 'today', '2026-9-3', '30-09-2026']) {
    const res = await getOps(adminToken, `?date=${encodeURIComponent(bad)}`);
    assert.equal(res.status, 400, `expected 400 for ${bad}`);
  }
});

test('quiet day: zero-filled totals, all seven appointment statuses present, only departments with an active doctor listed', async () => {
  const json = await (await getOps(receptionToken)).json();

  assert.deepEqual(json.totals, { waiting: 0, called: 0, inConsultation: 0, completed: 0, skipped: 0, emergencyWaiting: 0 });
  assert.equal(json.appointments.total, 0);
  assert.deepEqual(Object.keys(json.appointments.byStatus).sort(), ['cancelled', 'completed', 'confirmed', 'in_consultation', 'no_show', 'scheduled', 'waiting']);
  assert.ok(Object.values(json.appointments.byStatus).every((n) => n === 0));

  const names = json.departments.map((d) => d.departmentName).sort();
  assert.deepEqual(names, ['Ops Dept A', 'Ops Dept B']);
  assert.ok(!names.includes('Ops Empty Dept'), 'a department with no doctor and no activity must not be listed');

  const a = json.departments.find((d) => d.departmentName === 'Ops Dept A');
  assert.equal(a.activeDoctors, 1);
  assert.equal(a.waiting, 0);
  assert.equal(a.nextToken, null);
  assert.equal(a.longestWaitMinutes, null);
});

test('live counts are accurate, and "next token" follows the priority-aware queue order', async () => {
  // Dept A: build every status.
  const e1 = await newToken(deptA, doctorA, 'A1'); // A-001 normal, stays waiting
  const e2 = await newToken(deptA, doctorA, 'A2', 'emergency'); // E-002 emergency, stays waiting
  const e3 = await newToken(deptA, doctorA, 'A3');
  const e4 = await newToken(deptA, doctorA, 'A4');
  const e5 = await newToken(deptA, doctorA, 'A5');
  const e6 = await newToken(deptA, doctorA, 'A6');

  await post(receptionToken, `/api/queue/${e3.id}/call`);
  await post(receptionToken, `/api/queue/${e3.id}/start`);
  await post(receptionToken, `/api/queue/${e3.id}/complete`); // completed

  await post(receptionToken, `/api/queue/${e4.id}/call`);
  await post(receptionToken, `/api/queue/${e4.id}/start`); // in consultation

  await post(receptionToken, `/api/queue/${e5.id}/call`); // called

  await post(receptionToken, `/api/queue/${e6.id}/call`);
  await post(receptionToken, `/api/queue/${e6.id}/skip`); // skipped

  // Dept B: three ordinary waiting patients, NO emergency.
  await newToken(deptB, doctorB, 'B1');
  await newToken(deptB, doctorB, 'B2');
  await newToken(deptB, doctorB, 'B3');

  // Make the first (normal) patient in Dept A look like they've waited ~42 minutes.
  await queueEntryModel.update(e1.id, { createdAt: new Date(Date.now() - 42 * 60000).toISOString() });

  const json = await (await getOps(nurseToken)).json();

  assert.deepEqual(json.totals, { waiting: 5, called: 1, inConsultation: 1, completed: 1, skipped: 1, emergencyWaiting: 1 });

  const a = json.departments.find((d) => d.departmentName === 'Ops Dept A');
  assert.deepEqual(
    { waiting: a.waiting, called: a.called, inConsultation: a.inConsultation, completed: a.completed, skipped: a.skipped, emergencyWaiting: a.emergencyWaiting },
    { waiting: 2, called: 1, inConsultation: 1, completed: 1, skipped: 1, emergencyWaiting: 1 }
  );

  // The emergency patient (E-002) arrived AFTER the normal one (A-001) but is served first.
  assert.equal(e1.token, 'A-001');
  assert.equal(e2.token, 'E-002');
  assert.equal(a.nextToken, 'E-002');

  // Longest wait is real elapsed time of the oldest waiting patient (~42 min).
  assert.ok(a.longestWaitMinutes >= 42 && a.longestWaitMinutes <= 43, `expected ~42, got ${a.longestWaitMinutes}`);

  const b = json.departments.find((d) => d.departmentName === 'Ops Dept B');
  assert.equal(b.waiting, 3);
  assert.equal(b.emergencyWaiting, 0);
  assert.equal(b.nextToken, 'A-001');
});

test('departments are ordered emergencies-first, even though Dept B has the longer queue', async () => {
  const json = await (await getOps(receptionToken)).json();
  const order = json.departments.map((d) => d.departmentName);
  assert.equal(order[0], 'Ops Dept A'); // 1 emergency, 2 waiting
  assert.equal(order[1], 'Ops Dept B'); // 0 emergency, 3 waiting
});

test('the response contains no patient names or contact details', async () => {
  const text = JSON.stringify(await (await getOps(receptionToken)).json());
  assert.ok(!text.includes('Ops Patient'), 'patient names must not appear');
  assert.ok(!/55577\d{5}/.test(text), 'patient phone numbers must not appear');
});

test('appointment counts by status, using the ?date= override', async () => {
  const patientId = await newPatient('Appt');
  const date = '2031-01-15';

  const first = await post(receptionToken, '/api/appointments', { patientId, doctorId: doctorA, departmentId: deptA, date, timeSlot: '09:00' });
  const second = await post(receptionToken, '/api/appointments', { patientId, doctorId: doctorA, departmentId: deptA, date, timeSlot: '09:30' });
  await post(receptionToken, '/api/appointments', { patientId, doctorId: doctorA, departmentId: deptA, date, timeSlot: '10:00' });
  await fetch(`${baseUrl}/api/appointments/${second.appointment.id}`, { method: 'PUT', headers: headers(receptionToken), body: JSON.stringify({ status: 'confirmed' }) });
  await fetch(`${baseUrl}/api/appointments/${first.appointment.id}`, { method: 'PUT', headers: headers(receptionToken), body: JSON.stringify({ status: 'cancelled' }) });

  const json = await (await getOps(receptionToken, `?date=${date}`)).json();
  assert.equal(json.date, date);
  assert.equal(json.appointments.total, 3);
  assert.equal(json.appointments.byStatus.scheduled, 1);
  assert.equal(json.appointments.byStatus.confirmed, 1);
  assert.equal(json.appointments.byStatus.cancelled, 1);

  // Nothing bleeds across dates: today's live queue counts are not in that day's totals.
  assert.equal(json.totals.waiting, 0);
});

test('longest wait is null for a non-today date (elapsed time would be meaningless)', async () => {
  const patientId = await newPatient('Past');
  await queueEntryModel.create({ patientId, departmentId: deptA, doctorId: doctorA, date: '2020-01-01' });

  const json = await (await getOps(adminToken, '?date=2020-01-01')).json();
  const a = json.departments.find((d) => d.departmentName === 'Ops Dept A');
  assert.equal(a.waiting, 1);
  assert.equal(a.longestWaitMinutes, null);
});
