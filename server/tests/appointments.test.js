import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

process.env.NODE_ENV = 'test';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TEST_DB = path.join(__dirname, '..', 'data', 'db.appointments.test.json');

let app;
let server;
let baseUrl;
let adminToken, receptionToken, nurseToken, doctorToken;
let deptId, doctorId, patientId;

function headers(token) {
  return { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
}

before(async () => {
  if (fs.existsSync(TEST_DB)) fs.unlinkSync(TEST_DB);

  const { connectDB } = await import('../config/db.js');
  await connectDB(TEST_DB);

  const userModel = await import('../models/userModel.js');
  const authService = await import('../services/authService.js');

  await userModel.create({
    name: 'Apt Admin',
    email: 'apt-admin@mediqueue.test',
    passwordHash: await authService.hashPassword('Test@123'),
    role: 'admin',
  });
  await userModel.create({
    name: 'Apt Reception',
    email: 'apt-reception@mediqueue.test',
    passwordHash: await authService.hashPassword('Test@123'),
    role: 'receptionist',
  });
  await userModel.create({
    name: 'Apt Nurse',
    email: 'apt-nurse@mediqueue.test',
    passwordHash: await authService.hashPassword('Test@123'),
    role: 'nurse',
  });

  ({ default: app } = await import('../app.js'));
  server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  baseUrl = `http://localhost:${server.address().port}`;

  async function login(email, password) {
    const res = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    return (await res.json()).token;
  }

  adminToken = await login('apt-admin@mediqueue.test', 'Test@123');
  receptionToken = await login('apt-reception@mediqueue.test', 'Test@123');
  nurseToken = await login('apt-nurse@mediqueue.test', 'Test@123');

  const deptRes = await fetch(`${baseUrl}/api/departments`, {
    method: 'POST',
    headers: headers(adminToken),
    body: JSON.stringify({ name: 'Pediatrics' }),
  });
  deptId = (await deptRes.json()).department.id;

  const docRes = await fetch(`${baseUrl}/api/doctors`, {
    method: 'POST',
    headers: headers(adminToken),
    body: JSON.stringify({
      name: 'Dr. Appointment Tester',
      email: 'apt-doctor@mediqueue.test',
      password: 'DocPass1',
      departmentId: deptId,
    }),
  });
  doctorId = (await docRes.json()).doctor.id;
  doctorToken = await login('apt-doctor@mediqueue.test', 'DocPass1');

  const patRes = await fetch(`${baseUrl}/api/patients`, {
    method: 'POST',
    headers: headers(receptionToken),
    body: JSON.stringify({ name: 'Appointment Patient', gender: 'female', phone: '5557778888' }),
  });
  patientId = (await patRes.json()).patient.id;
});

after(async () => {
  server.close();
  if (fs.existsSync(TEST_DB)) fs.unlinkSync(TEST_DB);
});

function baseAppointment(overrides = {}) {
  return {
    patientId,
    doctorId,
    departmentId: deptId,
    date: '2026-10-01',
    timeSlot: '09:00',
    ...overrides,
  };
}

let appointmentId;

test('nurse cannot create an appointment (403)', async () => {
  const res = await fetch(`${baseUrl}/api/appointments`, {
    method: 'POST',
    headers: headers(nurseToken),
    body: JSON.stringify(baseAppointment()),
  });
  assert.equal(res.status, 403);
});

test('creating with an unknown patient fails (400)', async () => {
  const res = await fetch(`${baseUrl}/api/appointments`, {
    method: 'POST',
    headers: headers(receptionToken),
    body: JSON.stringify(baseAppointment({ patientId: 'does-not-exist' })),
  });
  assert.equal(res.status, 400);
});

test('creating with an invalid time slot format fails validation (400)', async () => {
  const res = await fetch(`${baseUrl}/api/appointments`, {
    method: 'POST',
    headers: headers(receptionToken),
    body: JSON.stringify(baseAppointment({ timeSlot: '9am' })),
  });
  assert.equal(res.status, 400);
});

test('receptionist creates an appointment, defaults to scheduled status', async () => {
  const res = await fetch(`${baseUrl}/api/appointments`, {
    method: 'POST',
    headers: headers(receptionToken),
    body: JSON.stringify(baseAppointment()),
  });
  assert.equal(res.status, 201);
  const json = await res.json();
  assert.equal(json.appointment.status, 'scheduled');
  assert.equal(json.appointment.patientName, 'Appointment Patient');
  assert.equal(json.appointment.doctorName, 'Dr. Appointment Tester');
  appointmentId = json.appointment.id;
});

test('a conflicting appointment (same doctor+date+timeSlot) is rejected (409)', async () => {
  const res = await fetch(`${baseUrl}/api/appointments`, {
    method: 'POST',
    headers: headers(receptionToken),
    body: JSON.stringify(baseAppointment()),
  });
  assert.equal(res.status, 409);
});

test('a different time slot on the same day/doctor is allowed', async () => {
  const res = await fetch(`${baseUrl}/api/appointments`, {
    method: 'POST',
    headers: headers(receptionToken),
    body: JSON.stringify(baseAppointment({ timeSlot: '09:30' })),
  });
  assert.equal(res.status, 201);
});

test('GET /api/appointments filters by patientId', async () => {
  const res = await fetch(`${baseUrl}/api/appointments?patientId=${patientId}`, { headers: headers(adminToken) });
  const json = await res.json();
  assert.equal(json.count, 2);
});

test('GET /api/appointments/today only returns appointments dated today', async () => {
  const res = await fetch(`${baseUrl}/api/appointments/today`, { headers: headers(adminToken) });
  const json = await res.json();
  assert.equal(json.count, 0, 'no appointments were booked for today in this test');
});

test('doctor cannot reassign patientId/date on their own appointment (403)', async () => {
  const res = await fetch(`${baseUrl}/api/appointments/${appointmentId}`, {
    method: 'PUT',
    headers: headers(doctorToken),
    body: JSON.stringify({ date: '2026-10-05' }),
  });
  assert.equal(res.status, 403);
});

test('doctor can update status on their own appointment', async () => {
  const res = await fetch(`${baseUrl}/api/appointments/${appointmentId}`, {
    method: 'PUT',
    headers: headers(doctorToken),
    body: JSON.stringify({ status: 'completed' }),
  });
  assert.equal(res.status, 200);
  const json = await res.json();
  assert.equal(json.appointment.status, 'completed');
});

test('rescheduling to a slot that conflicts with another appointment fails (409)', async () => {
  const res = await fetch(`${baseUrl}/api/appointments/${appointmentId}`, {
    method: 'PUT',
    headers: headers(receptionToken),
    body: JSON.stringify({ timeSlot: '09:30' }),
  });
  assert.equal(res.status, 409);
});

test('receptionist reschedules to a free slot successfully', async () => {
  const res = await fetch(`${baseUrl}/api/appointments/${appointmentId}`, {
    method: 'PUT',
    headers: headers(receptionToken),
    body: JSON.stringify({ date: '2026-10-02', timeSlot: '14:00' }),
  });
  assert.equal(res.status, 200);
  const json = await res.json();
  assert.equal(json.appointment.date, '2026-10-02');
  assert.equal(json.appointment.timeSlot, '14:00');
});

test('cancelling an appointment frees up its original slot for a new booking', async () => {
  const listRes = await fetch(`${baseUrl}/api/appointments?date=2026-10-01`, { headers: headers(adminToken) });
  const list = (await listRes.json()).appointments;
  const secondApt = list.find((a) => a.timeSlot === '09:30');
  assert.ok(secondApt, 'expected the 09:30 appointment to still exist');

  const cancelRes = await fetch(`${baseUrl}/api/appointments/${secondApt.id}`, {
    method: 'PUT',
    headers: headers(receptionToken),
    body: JSON.stringify({ status: 'cancelled' }),
  });
  assert.equal(cancelRes.status, 200);

  const rebookRes = await fetch(`${baseUrl}/api/appointments`, {
    method: 'POST',
    headers: headers(receptionToken),
    body: JSON.stringify(baseAppointment({ timeSlot: '09:30' })),
  });
  assert.equal(rebookRes.status, 201);
});

test('GET /api/appointments/:id returns 404 for unknown id', async () => {
  const res = await fetch(`${baseUrl}/api/appointments/nonexistent`, { headers: headers(adminToken) });
  assert.equal(res.status, 404);
});
