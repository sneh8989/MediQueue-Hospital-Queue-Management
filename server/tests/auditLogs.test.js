import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

process.env.NODE_ENV = 'test';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TEST_DB = path.join(__dirname, '..', 'data', 'db.auditlogs.test.json');

let app;
let server;
let baseUrl;
let adminToken, receptionToken;

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
    name: 'Audit Admin',
    email: 'audit-admin@mediqueue.test',
    passwordHash: await authService.hashPassword('Test@123'),
    role: 'admin',
  });
  await userModel.create({
    name: 'Audit Reception',
    email: 'audit-reception@mediqueue.test',
    passwordHash: await authService.hashPassword('Test@123'),
    role: 'receptionist',
  });

  ({ default: app } = await import('../app.js'));
  server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  baseUrl = `http://localhost:${server.address().port}`;

  adminToken = await login('audit-admin@mediqueue.test', 'Test@123');
  receptionToken = await login('audit-reception@mediqueue.test', 'Test@123');

  // Generate a handful of known audit-log-producing actions.
  await fetch(`${baseUrl}/api/departments`, {
    method: 'POST',
    headers: headers(adminToken),
    body: JSON.stringify({ name: 'Audit Test Dept' }),
  });
  await fetch(`${baseUrl}/api/patients`, {
    method: 'POST',
    headers: headers(receptionToken),
    body: JSON.stringify({ name: 'Audit Test Patient', gender: 'male', phone: '5559991111' }),
  });
});

after(async () => {
  server.close();
  if (fs.existsSync(TEST_DB)) fs.unlinkSync(TEST_DB);
});

test('non-admin is forbidden from viewing audit logs (403)', async () => {
  const res = await fetch(`${baseUrl}/api/audit-logs`, { headers: headers(receptionToken) });
  assert.equal(res.status, 403);
});

test('unauthenticated request is rejected (401)', async () => {
  const res = await fetch(`${baseUrl}/api/audit-logs`);
  assert.equal(res.status, 401);
});

test('admin sees audit log entries including logins and the seeded actions, most recent first', async () => {
  const res = await fetch(`${baseUrl}/api/audit-logs`, { headers: headers(adminToken) });
  assert.equal(res.status, 200);
  const json = await res.json();
  assert.ok(json.count >= 4, 'expect at least the 2 logins + 2 seeded create actions');

  const actions = json.logs.map((l) => l.action);
  assert.ok(actions.includes('department_created'));
  assert.ok(actions.includes('patient_created'));
  assert.ok(actions.includes('login'));

  // Most recent first: the last action performed (patient_created) should
  // appear before the department creation that happened earlier.
  const patientIdx = actions.indexOf('patient_created');
  const deptIdx = actions.indexOf('department_created');
  assert.ok(patientIdx < deptIdx, 'more recent entries should sort first');
});

test('filtering by entity returns only matching entries', async () => {
  const res = await fetch(`${baseUrl}/api/audit-logs?entity=department`, { headers: headers(adminToken) });
  const json = await res.json();
  assert.equal(json.count, 1);
  assert.equal(json.logs[0].action, 'department_created');
});

test('filtering by action returns only matching entries', async () => {
  const res = await fetch(`${baseUrl}/api/audit-logs?action=patient_created`, { headers: headers(adminToken) });
  const json = await res.json();
  assert.equal(json.count, 1);
  assert.equal(json.logs[0].entity, 'patient');
});

test('filtering by a date with no matching entries returns an empty set', async () => {
  const res = await fetch(`${baseUrl}/api/audit-logs?date=2020-01-01`, { headers: headers(adminToken) });
  const json = await res.json();
  assert.equal(json.count, 0);
});

test('filtering by userId scopes to that user\'s own actions', async () => {
  const meRes = await fetch(`${baseUrl}/api/auth/me`, { headers: headers(receptionToken) });
  const receptionUserId = (await meRes.json()).user.id;

  const res = await fetch(`${baseUrl}/api/audit-logs?userId=${receptionUserId}`, { headers: headers(adminToken) });
  const json = await res.json();
  assert.ok(json.logs.every((l) => l.userId === receptionUserId));
  assert.ok(json.logs.some((l) => l.action === 'patient_created'));
});

test('GET /api/audit-logs/filter-options lists distinct actions and entities seen so far', async () => {
  const res = await fetch(`${baseUrl}/api/audit-logs/filter-options`, { headers: headers(adminToken) });
  assert.equal(res.status, 200);
  const json = await res.json();
  assert.ok(json.actions.includes('department_created'));
  assert.ok(json.actions.includes('patient_created'));
  assert.ok(json.entities.includes('department'));
  assert.ok(json.entities.includes('patient'));
});

test('non-admin is forbidden from filter-options too (403)', async () => {
  const res = await fetch(`${baseUrl}/api/audit-logs/filter-options`, { headers: headers(receptionToken) });
  assert.equal(res.status, 403);
});
