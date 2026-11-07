import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

process.env.NODE_ENV = 'test';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TEST_DB = path.join(__dirname, '..', 'data', 'db.reports.test.json');

let app;
let server;
let baseUrl;
let adminToken, receptionToken;
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

before(async () => {
  if (fs.existsSync(TEST_DB)) fs.unlinkSync(TEST_DB);

  const { connectDB } = await import('../config/db.js');
  await connectDB(TEST_DB);

  const userModel = await import('../models/userModel.js');
  const authService = await import('../services/authService.js');

  await userModel.create({
    name: 'Report Admin',
    email: 'report-admin@mediqueue.test',
    passwordHash: await authService.hashPassword('Test@123'),
    role: 'admin',
  });
  await userModel.create({
    name: 'Report Reception',
    email: 'report-reception@mediqueue.test',
    passwordHash: await authService.hashPassword('Test@123'),
    role: 'receptionist',
  });

  ({ default: app } = await import('../app.js'));
  server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  baseUrl = `http://localhost:${server.address().port}`;

  adminToken = await login('report-admin@mediqueue.test', 'Test@123');
  receptionToken = await login('report-reception@mediqueue.test', 'Test@123');

  const deptRes = await fetch(`${baseUrl}/api/departments`, {
    method: 'POST',
    headers: headers(adminToken),
    body: JSON.stringify({ name: 'Report Test Dept' }),
  });
  deptId = (await deptRes.json()).department.id;

  const docRes = await fetch(`${baseUrl}/api/doctors`, {
    method: 'POST',
    headers: headers(adminToken),
    body: JSON.stringify({
      name: 'Dr. Report Tester',
      email: 'report-doctor@mediqueue.test',
      password: 'DocPass1',
      departmentId: deptId,
    }),
  });
  doctorId = (await docRes.json()).doctor.id;

  const patRes = await fetch(`${baseUrl}/api/patients`, {
    method: 'POST',
    headers: headers(receptionToken),
    body: JSON.stringify({ name: 'Report Test Patient', gender: 'male', phone: '5551230000' }),
  });
  patientId = (await patRes.json()).patient.id;

  // One emergency entry, taken all the way to completed.
  const entryRes = await fetch(`${baseUrl}/api/queue/token`, {
    method: 'POST',
    headers: headers(receptionToken),
    body: JSON.stringify({ patientId, departmentId: deptId, doctorId, priority: 'emergency' }),
  });
  const entryId = (await entryRes.json()).entry.id;
  await fetch(`${baseUrl}/api/queue/${entryId}/call`, { method: 'POST', headers: headers(receptionToken) });
  await fetch(`${baseUrl}/api/queue/${entryId}/start`, { method: 'POST', headers: headers(receptionToken) });
  await fetch(`${baseUrl}/api/queue/${entryId}/complete`, { method: 'POST', headers: headers(receptionToken) });
});

after(async () => {
  server.close();
  if (fs.existsSync(TEST_DB)) fs.unlinkSync(TEST_DB);
});

test('non-admin is forbidden from all report endpoints (403)', async () => {
  const res = await fetch(`${baseUrl}/api/reports/daily-patient`, { headers: headers(receptionToken) });
  assert.equal(res.status, 403);
});

test('unauthenticated request is rejected (401)', async () => {
  const res = await fetch(`${baseUrl}/api/reports/daily-patient`);
  assert.equal(res.status, 401);
});

test('unknown report type returns 400 with the list of valid types', async () => {
  const res = await fetch(`${baseUrl}/api/reports/not-a-real-type`, { headers: headers(adminToken) });
  assert.equal(res.status, 400);
  const json = await res.json();
  assert.match(json.message, /Unknown report type/);
});

test('GET /api/reports/types lists all 8 report types', async () => {
  const res = await fetch(`${baseUrl}/api/reports/types`, { headers: headers(adminToken) });
  assert.equal(res.status, 200);
  const json = await res.json();
  assert.equal(json.reportTypes.length, 8);
});

test('daily-patient report includes the seeded patient', async () => {
  const res = await fetch(`${baseUrl}/api/reports/daily-patient`, { headers: headers(adminToken) });
  const json = await res.json();
  assert.equal(json.count, 1);
  assert.ok(json.rows[0].includes('Report Test Patient'));
});

test('department report shows correct completed/emergency counts', async () => {
  const res = await fetch(`${baseUrl}/api/reports/department`, { headers: headers(adminToken) });
  const json = await res.json();
  const row = json.rows.find((r) => r[0] === 'Report Test Dept');
  assert.ok(row);
  const [, total, completed, waiting, emergency] = row;
  assert.equal(total, 1);
  assert.equal(completed, 1);
  assert.equal(waiting, 0);
  assert.equal(emergency, 1);
});

test('doctor-performance report shows the doctor with 1 completed patient', async () => {
  const res = await fetch(`${baseUrl}/api/reports/doctor-performance?doctorId=${doctorId}`, { headers: headers(adminToken) });
  const json = await res.json();
  assert.equal(json.count, 1);
  const [name, total, completed] = json.rows[0];
  assert.equal(name, 'Dr. Report Tester');
  assert.equal(total, 1);
  assert.equal(completed, 1);
});

test('emergency report includes the seeded emergency token', async () => {
  const res = await fetch(`${baseUrl}/api/reports/emergency`, { headers: headers(adminToken) });
  const json = await res.json();
  assert.equal(json.count, 1);
  assert.equal(json.rows[0][0], 'E-001');
});

test('waiting-time report includes an entry with a computed wait time', async () => {
  const res = await fetch(`${baseUrl}/api/reports/waiting-time?departmentId=${deptId}`, { headers: headers(adminToken) });
  const json = await res.json();
  assert.equal(json.count, 1);
  assert.match(json.rows[0][3], /min$/);
});

test('queue-performance report shows a 100% completion rate for this department today', async () => {
  const res = await fetch(`${baseUrl}/api/reports/queue-performance?departmentId=${deptId}`, { headers: headers(adminToken) });
  const json = await res.json();
  const row = json.rows.find((r) => r[0] === 'Report Test Dept');
  assert.equal(row[4], '100%');
});

test('no-show report returns an empty result set when there are no no-shows', async () => {
  const res = await fetch(`${baseUrl}/api/reports/no-show`, { headers: headers(adminToken) });
  const json = await res.json();
  assert.equal(json.count, 0);
});

test('a report for an arbitrary past date with no data returns an empty result set, not an error', async () => {
  const res = await fetch(`${baseUrl}/api/reports/daily-patient?date=2020-01-01`, { headers: headers(adminToken) });
  assert.equal(res.status, 200);
  const json = await res.json();
  assert.equal(json.count, 0);
});
