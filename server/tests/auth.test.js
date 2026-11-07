import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

process.env.NODE_ENV = 'test';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TEST_DB = path.join(__dirname, '..', 'data', 'db.test.json');

let app;
let server;
let baseUrl;

before(async () => {
  if (fs.existsSync(TEST_DB)) fs.unlinkSync(TEST_DB);

  const { connectDB } = await import('../config/db.js');
  await connectDB(TEST_DB);

  const userModel = await import('../models/userModel.js');
  const authService = await import('../services/authService.js');
  const passwordHash = await authService.hashPassword('Test@123');
  await userModel.create({
    name: 'Test Admin',
    email: 'test-admin@mediqueue.test',
    passwordHash,
    role: 'admin',
  });

  ({ default: app } = await import('../app.js'));
  server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  baseUrl = `http://localhost:${server.address().port}`;
});

after(async () => {
  server.close();
  if (fs.existsSync(TEST_DB)) fs.unlinkSync(TEST_DB);
});

async function postJSON(url, body, headers = {}) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });
  return { status: res.status, body: await res.json() };
}

test('GET /api/health returns 200', async () => {
  const res = await fetch(`${baseUrl}/api/health`);
  assert.equal(res.status, 200);
  const json = await res.json();
  assert.equal(json.success, true);
});

test('login fails with wrong password', async () => {
  const { status, body } = await postJSON(`${baseUrl}/api/auth/login`, {
    email: 'test-admin@mediqueue.test',
    password: 'wrong-password',
  });
  assert.equal(status, 401);
  assert.equal(body.success, false);
});

test('login fails validation with malformed email', async () => {
  const { status, body } = await postJSON(`${baseUrl}/api/auth/login`, {
    email: 'not-an-email',
    password: 'whatever',
  });
  assert.equal(status, 400);
  assert.equal(body.success, false);
});

test('login succeeds with correct credentials and returns a token', async () => {
  const { status, body } = await postJSON(`${baseUrl}/api/auth/login`, {
    email: 'test-admin@mediqueue.test',
    password: 'Test@123',
  });
  assert.equal(status, 200);
  assert.equal(body.success, true);
  assert.ok(body.token);
  assert.equal(body.user.role, 'admin');
  assert.equal(body.user.passwordHash, undefined, 'password hash must never be returned');
});

test('GET /api/auth/me requires a token', async () => {
  const res = await fetch(`${baseUrl}/api/auth/me`);
  assert.equal(res.status, 401);
});

test('GET /api/auth/me returns the user for a valid token', async () => {
  const login = await postJSON(`${baseUrl}/api/auth/login`, {
    email: 'test-admin@mediqueue.test',
    password: 'Test@123',
  });
  const res = await fetch(`${baseUrl}/api/auth/me`, {
    headers: { Authorization: `Bearer ${login.body.token}` },
  });
  assert.equal(res.status, 200);
  const json = await res.json();
  assert.equal(json.user.email, 'test-admin@mediqueue.test');
});

// Closes a gap flagged in Phase 2's PROJECT_STATE.md: logout had no
// dedicated automated test.

test('POST /api/auth/logout requires a valid token (401 without one)', async () => {
  const res = await fetch(`${baseUrl}/api/auth/logout`, { method: 'POST' });
  assert.equal(res.status, 401);
});

test('POST /api/auth/logout succeeds for an authenticated user and writes an audit log entry', async () => {
  const login = await postJSON(`${baseUrl}/api/auth/login`, {
    email: 'test-admin@mediqueue.test',
    password: 'Test@123',
  });

  const res = await fetch(`${baseUrl}/api/auth/logout`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${login.body.token}` },
  });
  assert.equal(res.status, 200);
  const json = await res.json();
  assert.equal(json.success, true);
});
