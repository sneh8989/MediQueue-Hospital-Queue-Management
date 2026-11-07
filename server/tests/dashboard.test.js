import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

process.env.NODE_ENV = 'test';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TEST_DB = path.join(__dirname, '..', 'data', 'db.dashboard.test.json');

let app;
let server;
let baseUrl;
let adminToken, receptionToken;
let deptId, doctorId;

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
    name: 'Dash Admin',
    email: 'dash-admin@mediqueue.test',
    passwordHash: await authService.hashPassword('Test@123'),
    role: 'admin',
  });
  await userModel.create({
    name: 'Dash Reception',
    email: 'dash-reception@mediqueue.test',
    passwordHash: await authService.hashPassword('Test@123'),
    role: 'receptionist',
  });

  ({ default: app } = await import('../app.js'));
  server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  baseUrl = `http://localhost:${server.address().port}`;

  adminToken = await login('dash-admin@mediqueue.test', 'Test@123');
  receptionToken = await login('dash-reception@mediqueue.test', 'Test@123');

  const deptRes = await fetch(`${baseUrl}/api/departments`, {
    method: 'POST',
    headers: headers(adminToken),
    body: JSON.stringify({ name: 'Dashboard Test Dept' }),
  });
  deptId = (await deptRes.json()).department.id;

  const docRes = await fetch(`${baseUrl}/api/doctors`, {
    method: 'POST',
    headers: headers(adminToken),
    body: JSON.stringify({
      name: 'Dr. Dashboard Tester',
      email: 'dash-doctor@mediqueue.test',
      password: 'DocPass1',
      departmentId: deptId,
    }),
  });
  doctorId = (await docRes.json()).doctor.id;
});

after(async () => {
  server.close();
  if (fs.existsSync(TEST_DB)) fs.unlinkSync(TEST_DB);
});

test('non-admin is forbidden from viewing the dashboard summary (403)', async () => {
  const res = await fetch(`${baseUrl}/api/dashboard/summary`, { headers: headers(receptionToken) });
  assert.equal(res.status, 403);
});

test('unauthenticated request is rejected (401)', async () => {
  const res = await fetch(`${baseUrl}/api/dashboard/summary`);
  assert.equal(res.status, 401);
});

test('dashboard summary reflects real seeded activity accurately', async () => {
  const p1Res = await fetch(`${baseUrl}/api/patients`, {
    method: 'POST',
    headers: headers(receptionToken),
    body: JSON.stringify({ name: 'Dashboard Patient One', gender: 'male', phone: '5550001111' }),
  });
  const p1 = (await p1Res.json()).patient.id;

  const p2Res = await fetch(`${baseUrl}/api/patients`, {
    method: 'POST',
    headers: headers(receptionToken),
    body: JSON.stringify({ name: 'Dashboard Patient Two', gender: 'female', phone: '5550002222' }),
  });
  const p2 = (await p2Res.json()).patient.id;

  // Entry 1: goes all the way to completed.
  const e1Res = await fetch(`${baseUrl}/api/queue/token`, {
    method: 'POST',
    headers: headers(receptionToken),
    body: JSON.stringify({ patientId: p1, departmentId: deptId, doctorId }),
  });
  const e1 = (await e1Res.json()).entry.id;
  await fetch(`${baseUrl}/api/queue/${e1}/call`, { method: 'POST', headers: headers(receptionToken) });
  await fetch(`${baseUrl}/api/queue/${e1}/start`, { method: 'POST', headers: headers(receptionToken) });
  await fetch(`${baseUrl}/api/queue/${e1}/complete`, { method: 'POST', headers: headers(receptionToken) });

  // Entry 2: emergency, stays waiting.
  await fetch(`${baseUrl}/api/queue/token`, {
    method: 'POST',
    headers: headers(receptionToken),
    body: JSON.stringify({ patientId: p2, departmentId: deptId, doctorId, priority: 'emergency' }),
  });

  const res = await fetch(`${baseUrl}/api/dashboard/summary`, { headers: headers(adminToken) });
  assert.equal(res.status, 200);
  const json = await res.json();

  assert.equal(json.stats.totalPatientsToday, 2);
  assert.equal(json.stats.waitingPatients, 1);
  assert.equal(json.stats.completedConsultations, 1);
  assert.equal(json.stats.emergencyPatients, 1);
  assert.equal(json.stats.patientsInConsultation, 0);

  const deptChart = json.charts.patientsByDepartment.find((d) => d.department === 'Dashboard Test Dept');
  assert.equal(deptChart.count, 2);

  const workload = json.charts.doctorWorkload.find((w) => w.doctor === 'Dr. Dashboard Tester');
  assert.equal(workload.count, 1);

  const queueWaiting = json.charts.queueByStatus.find((q) => q.status === 'waiting');
  const queueCompleted = json.charts.queueByStatus.find((q) => q.status === 'completed');
  assert.equal(queueWaiting.count, 1);
  assert.equal(queueCompleted.count, 1);
});

test('dashboard summary accepts a ?date= override', async () => {
  const res = await fetch(`${baseUrl}/api/dashboard/summary?date=2020-01-01`, { headers: headers(adminToken) });
  assert.equal(res.status, 200);
  const json = await res.json();
  assert.equal(json.date, '2020-01-01');
  assert.equal(json.stats.totalPatientsToday, 0, 'no data exists for this arbitrary past date');
});
