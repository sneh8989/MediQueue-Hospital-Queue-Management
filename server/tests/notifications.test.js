import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

process.env.NODE_ENV = 'test';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TEST_DB = path.join(__dirname, '..', 'data', 'db.notifications.test.json');

let app;
let server;
let baseUrl;
let adminToken, receptionToken;
let deptId, doctorId, doctorToken, otherDoctorToken, patientId;

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
    name: 'Notif Admin',
    email: 'notif-admin@mediqueue.test',
    passwordHash: await authService.hashPassword('Test@123'),
    role: 'admin',
  });
  await userModel.create({
    name: 'Notif Reception',
    email: 'notif-reception@mediqueue.test',
    passwordHash: await authService.hashPassword('Test@123'),
    role: 'receptionist',
  });

  ({ default: app } = await import('../app.js'));
  server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  baseUrl = `http://localhost:${server.address().port}`;

  adminToken = await login('notif-admin@mediqueue.test', 'Test@123');
  receptionToken = await login('notif-reception@mediqueue.test', 'Test@123');

  const deptRes = await fetch(`${baseUrl}/api/departments`, {
    method: 'POST',
    headers: headers(adminToken),
    body: JSON.stringify({ name: 'Notification Test Dept' }),
  });
  deptId = (await deptRes.json()).department.id;

  const docRes = await fetch(`${baseUrl}/api/doctors`, {
    method: 'POST',
    headers: headers(adminToken),
    body: JSON.stringify({
      name: 'Dr. Notification Tester',
      email: 'notif-doctor@mediqueue.test',
      password: 'DocPass1',
      departmentId: deptId,
    }),
  });
  doctorId = (await docRes.json()).doctor.id;
  doctorToken = await login('notif-doctor@mediqueue.test', 'DocPass1');

  const otherDocRes = await fetch(`${baseUrl}/api/doctors`, {
    method: 'POST',
    headers: headers(adminToken),
    body: JSON.stringify({
      name: 'Dr. Other Notification',
      email: 'notif-other-doctor@mediqueue.test',
      password: 'DocPass1',
      departmentId: deptId,
    }),
  });
  otherDoctorToken = await login('notif-other-doctor@mediqueue.test', 'DocPass1');

  const patRes = await fetch(`${baseUrl}/api/patients`, {
    method: 'POST',
    headers: headers(receptionToken),
    body: JSON.stringify({ name: 'Notification Patient', gender: 'female', phone: '5552340000' }),
  });
  patientId = (await patRes.json()).patient.id;
});

after(async () => {
  server.close();
  if (fs.existsSync(TEST_DB)) fs.unlinkSync(TEST_DB);
});

test('doctor starts with zero notifications', async () => {
  const res = await fetch(`${baseUrl}/api/notifications`, { headers: headers(doctorToken) });
  const json = await res.json();
  assert.equal(json.count, 0);
});

let entryId;

test('generating a token notifies the assigned doctor', async () => {
  const res = await fetch(`${baseUrl}/api/queue/token`, {
    method: 'POST',
    headers: headers(receptionToken),
    body: JSON.stringify({ patientId, departmentId: deptId, doctorId }),
  });
  entryId = (await res.json()).entry.id;

  const notifRes = await fetch(`${baseUrl}/api/notifications`, { headers: headers(doctorToken) });
  const json = await notifRes.json();
  assert.equal(json.count, 1);
  assert.equal(json.notifications[0].type, 'token_generated');
  assert.match(json.notifications[0].message, /A-001/);
  assert.equal(json.notifications[0].read, false);
});

test('a different doctor does not see this doctor\'s notifications', async () => {
  const res = await fetch(`${baseUrl}/api/notifications`, { headers: headers(otherDoctorToken) });
  const json = await res.json();
  assert.equal(json.count, 0);
});

test('calling the token adds a second notification', async () => {
  await fetch(`${baseUrl}/api/queue/${entryId}/call`, { method: 'POST', headers: headers(receptionToken) });

  const res = await fetch(`${baseUrl}/api/notifications`, { headers: headers(doctorToken) });
  const json = await res.json();
  assert.equal(json.count, 2);
  assert.equal(json.notifications[0].type, 'token_called', 'most recent notification should be first');
});

test('GET /api/notifications/unread-count reflects unread notifications', async () => {
  const res = await fetch(`${baseUrl}/api/notifications/unread-count`, { headers: headers(doctorToken) });
  const json = await res.json();
  assert.equal(json.count, 2);
});

let notificationId;

test('marking a notification read updates its state and the unread count', async () => {
  const listRes = await fetch(`${baseUrl}/api/notifications`, { headers: headers(doctorToken) });
  notificationId = (await listRes.json()).notifications[0].id;

  const readRes = await fetch(`${baseUrl}/api/notifications/${notificationId}/read`, {
    method: 'PUT',
    headers: headers(doctorToken),
  });
  assert.equal(readRes.status, 200);
  const readJson = await readRes.json();
  assert.equal(readJson.notification.read, true);

  const countRes = await fetch(`${baseUrl}/api/notifications/unread-count`, { headers: headers(doctorToken) });
  assert.equal((await countRes.json()).count, 1);
});

test('a different doctor cannot mark someone else\'s notification as read (403)', async () => {
  const res = await fetch(`${baseUrl}/api/notifications/${notificationId}/read`, {
    method: 'PUT',
    headers: headers(otherDoctorToken),
  });
  assert.equal(res.status, 403);
});

test('marking a nonexistent notification read returns 404', async () => {
  const res = await fetch(`${baseUrl}/api/notifications/does-not-exist/read`, {
    method: 'PUT',
    headers: headers(doctorToken),
  });
  assert.equal(res.status, 404);
});

test('mark-all-read clears every remaining unread notification for that user only', async () => {
  const res = await fetch(`${baseUrl}/api/notifications/read-all`, { method: 'PUT', headers: headers(doctorToken) });
  assert.equal(res.status, 200);
  const json = await res.json();
  assert.equal(json.markedCount, 1);

  const countRes = await fetch(`${baseUrl}/api/notifications/unread-count`, { headers: headers(doctorToken) });
  assert.equal((await countRes.json()).count, 0);
});

test('completing a consultation notifies the doctor', async () => {
  await fetch(`${baseUrl}/api/queue/${entryId}/start`, { method: 'POST', headers: headers(receptionToken) });
  await fetch(`${baseUrl}/api/queue/${entryId}/complete`, { method: 'POST', headers: headers(receptionToken) });

  const res = await fetch(`${baseUrl}/api/notifications`, { headers: headers(doctorToken) });
  const json = await res.json();
  const completedNotif = json.notifications.find((n) => n.type === 'consultation_completed');
  assert.ok(completedNotif, 'expected a consultation_completed notification');
  assert.match(completedNotif.message, /Notification Patient/);
});

test('confirming an appointment notifies the assigned doctor', async () => {
  const apptRes = await fetch(`${baseUrl}/api/appointments`, {
    method: 'POST',
    headers: headers(receptionToken),
    body: JSON.stringify({ patientId, doctorId, departmentId: deptId, date: '2026-12-01', timeSlot: '10:00' }),
  });
  const appointment = (await apptRes.json()).appointment;

  await fetch(`${baseUrl}/api/appointments/${appointment.id}`, {
    method: 'PUT',
    headers: headers(receptionToken),
    body: JSON.stringify({ status: 'confirmed' }),
  });

  const res = await fetch(`${baseUrl}/api/notifications`, { headers: headers(doctorToken) });
  const json = await res.json();
  const confirmedNotif = json.notifications.find((n) => n.type === 'appointment_confirmed');
  assert.ok(confirmedNotif, 'expected an appointment_confirmed notification');
});

test('cancelling an appointment notifies the assigned doctor', async () => {
  const apptRes = await fetch(`${baseUrl}/api/appointments`, {
    method: 'POST',
    headers: headers(receptionToken),
    body: JSON.stringify({ patientId, doctorId, departmentId: deptId, date: '2026-12-02', timeSlot: '11:00' }),
  });
  const appointment = (await apptRes.json()).appointment;

  await fetch(`${baseUrl}/api/appointments/${appointment.id}`, {
    method: 'PUT',
    headers: headers(receptionToken),
    body: JSON.stringify({ status: 'cancelled' }),
  });

  const res = await fetch(`${baseUrl}/api/notifications`, { headers: headers(doctorToken) });
  const json = await res.json();
  const cancelledNotif = json.notifications.find((n) => n.type === 'appointment_cancelled');
  assert.ok(cancelledNotif, 'expected an appointment_cancelled notification');
});

test('unauthenticated requests to notification endpoints are rejected (401)', async () => {
  const res = await fetch(`${baseUrl}/api/notifications`);
  assert.equal(res.status, 401);
});
