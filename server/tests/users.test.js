import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

process.env.NODE_ENV = 'test';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TEST_DB = path.join(__dirname, '..', 'data', 'db.users.test.json');

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
  return { status: res.status, json: await res.json() };
}

before(async () => {
  if (fs.existsSync(TEST_DB)) fs.unlinkSync(TEST_DB);

  const { connectDB } = await import('../config/db.js');
  await connectDB(TEST_DB);

  const userModel = await import('../models/userModel.js');
  const authService = await import('../services/authService.js');

  await userModel.create({
    name: 'Users Test Admin',
    email: 'users-admin@mediqueue.test',
    passwordHash: await authService.hashPassword('Test@123'),
    role: 'admin',
  });
  await userModel.create({
    name: 'Users Test Reception',
    email: 'users-reception@mediqueue.test',
    passwordHash: await authService.hashPassword('Test@123'),
    role: 'receptionist',
  });

  ({ default: app } = await import('../app.js'));
  server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  baseUrl = `http://localhost:${server.address().port}`;

  adminToken = (await login('users-admin@mediqueue.test', 'Test@123')).json.token;
  receptionToken = (await login('users-reception@mediqueue.test', 'Test@123')).json.token;
});

after(async () => {
  server.close();
  if (fs.existsSync(TEST_DB)) fs.unlinkSync(TEST_DB);
});

test('non-admin cannot list users (403)', async () => {
  const res = await fetch(`${baseUrl}/api/users`, { headers: headers(receptionToken) });
  assert.equal(res.status, 403);
});

test('unauthenticated request is rejected (401)', async () => {
  const res = await fetch(`${baseUrl}/api/users`);
  assert.equal(res.status, 401);
});

test('creating a user with role=doctor is rejected by validation (400)', async () => {
  const res = await fetch(`${baseUrl}/api/users`, {
    method: 'POST',
    headers: headers(adminToken),
    body: JSON.stringify({ name: 'X', email: 'blocked-doc@mediqueue.test', password: 'password1', role: 'doctor' }),
  });
  assert.equal(res.status, 400);
});

test('creating a user with a weak password fails validation (400)', async () => {
  const res = await fetch(`${baseUrl}/api/users`, {
    method: 'POST',
    headers: headers(adminToken),
    body: JSON.stringify({ name: 'Weak', email: 'weak@mediqueue.test', password: '123', role: 'nurse' }),
  });
  assert.equal(res.status, 400);
});

let createdUserId;

test('admin creates a new nurse account without a passwordHash leaking in the response', async () => {
  const res = await fetch(`${baseUrl}/api/users`, {
    method: 'POST',
    headers: headers(adminToken),
    body: JSON.stringify({ name: 'Test Created Nurse', email: 'created-nurse@mediqueue.test', password: 'NursePass1', role: 'nurse' }),
  });
  assert.equal(res.status, 201);
  const json = await res.json();
  assert.equal(json.user.role, 'nurse');
  assert.ok(!('passwordHash' in json.user));
  createdUserId = json.user.id;
});

test('duplicate email is rejected (409)', async () => {
  const res = await fetch(`${baseUrl}/api/users`, {
    method: 'POST',
    headers: headers(adminToken),
    body: JSON.stringify({ name: 'Dup', email: 'created-nurse@mediqueue.test', password: 'password1', role: 'nurse' }),
  });
  assert.equal(res.status, 409);
});

test('the newly created account can log in', async () => {
  const res = await login('created-nurse@mediqueue.test', 'NursePass1');
  assert.equal(res.status, 200);
  assert.equal(res.json.user.role, 'nurse');
});

test('GET /api/users list never includes passwordHash for any user', async () => {
  const res = await fetch(`${baseUrl}/api/users`, { headers: headers(adminToken) });
  const json = await res.json();
  assert.ok(json.users.every((u) => !('passwordHash' in u)));
});

test('admin deactivates the account, and it can no longer log in', async () => {
  const res = await fetch(`${baseUrl}/api/users/${createdUserId}`, {
    method: 'PUT',
    headers: headers(adminToken),
    body: JSON.stringify({ isActive: false }),
  });
  assert.equal(res.status, 200);
  const json = await res.json();
  assert.equal(json.user.isActive, false);

  const loginRes = await login('created-nurse@mediqueue.test', 'NursePass1');
  assert.equal(loginRes.status, 403);
});

test('reactivating the account restores login access', async () => {
  await fetch(`${baseUrl}/api/users/${createdUserId}`, {
    method: 'PUT',
    headers: headers(adminToken),
    body: JSON.stringify({ isActive: true }),
  });
  const loginRes = await login('created-nurse@mediqueue.test', 'NursePass1');
  assert.equal(loginRes.status, 200);
});

test('admin resets the password; old password stops working and new one works', async () => {
  const resetRes = await fetch(`${baseUrl}/api/users/${createdUserId}/reset-password`, {
    method: 'PUT',
    headers: headers(adminToken),
    body: JSON.stringify({ password: 'BrandNewPass1' }),
  });
  assert.equal(resetRes.status, 200);

  const oldLogin = await login('created-nurse@mediqueue.test', 'NursePass1');
  assert.equal(oldLogin.status, 401);

  const newLogin = await login('created-nurse@mediqueue.test', 'BrandNewPass1');
  assert.equal(newLogin.status, 200);
});

test('resetting to a weak password fails validation (400)', async () => {
  const res = await fetch(`${baseUrl}/api/users/${createdUserId}/reset-password`, {
    method: 'PUT',
    headers: headers(adminToken),
    body: JSON.stringify({ password: '123' }),
  });
  assert.equal(res.status, 400);
});

test('a doctor\'s role cannot be changed away from doctor through this endpoint (400)', async () => {
  const deptRes = await fetch(`${baseUrl}/api/departments`, {
    method: 'POST',
    headers: headers(adminToken),
    body: JSON.stringify({ name: 'Users Test Dept' }),
  });
  const dept = (await deptRes.json()).department;

  const docRes = await fetch(`${baseUrl}/api/doctors`, {
    method: 'POST',
    headers: headers(adminToken),
    body: JSON.stringify({
      name: 'Dr. Users Test',
      email: 'users-test-doctor@mediqueue.test',
      password: 'DocPass1',
      departmentId: dept.id,
    }),
  });
  const doctor = (await docRes.json()).doctor;

  const listRes = await fetch(`${baseUrl}/api/users`, { headers: headers(adminToken) });
  const doctorUser = (await listRes.json()).users.find((u) => u.id === doctor.userId);
  assert.ok(doctorUser);

  const res = await fetch(`${baseUrl}/api/users/${doctorUser.id}`, {
    method: 'PUT',
    headers: headers(adminToken),
    body: JSON.stringify({ role: 'nurse' }),
  });
  assert.equal(res.status, 400);
});

test('GET /api/users/:id returns 404 for unknown id', async () => {
  const res = await fetch(`${baseUrl}/api/users/does-not-exist`, { headers: headers(adminToken) });
  assert.equal(res.status, 404);
});

test('non-admin cannot reset anyone\'s password (403)', async () => {
  const res = await fetch(`${baseUrl}/api/users/${createdUserId}/reset-password`, {
    method: 'PUT',
    headers: headers(receptionToken),
    body: JSON.stringify({ password: 'SomeNewPass1' }),
  });
  assert.equal(res.status, 403);
});
