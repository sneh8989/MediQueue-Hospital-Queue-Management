import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

process.env.NODE_ENV = 'test';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TEST_DB = path.join(__dirname, '..', 'data', 'db.publicqueue.test.json');

let app;
let server;
let baseUrl;
let adminToken, receptionToken;
let deptId, doctorId, roomId, patientId;

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
    name: 'PubQ Admin',
    email: 'pubq-admin@mediqueue.test',
    passwordHash: await authService.hashPassword('Test@123'),
    role: 'admin',
  });
  await userModel.create({
    name: 'PubQ Reception',
    email: 'pubq-reception@mediqueue.test',
    passwordHash: await authService.hashPassword('Test@123'),
    role: 'receptionist',
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

  adminToken = await login('pubq-admin@mediqueue.test', 'Test@123');
  receptionToken = await login('pubq-reception@mediqueue.test', 'Test@123');

  const deptRes = await fetch(`${baseUrl}/api/departments`, {
    method: 'POST',
    headers: headers(adminToken),
    body: JSON.stringify({ name: 'Public Queue Test Dept' }),
  });
  deptId = (await deptRes.json()).department.id;

  const roomRes = await fetch(`${baseUrl}/api/rooms`, {
    method: 'POST',
    headers: headers(adminToken),
    body: JSON.stringify({ number: '501', departmentId: deptId }),
  });
  roomId = (await roomRes.json()).room.id;

  const docRes = await fetch(`${baseUrl}/api/doctors`, {
    method: 'POST',
    headers: headers(adminToken),
    body: JSON.stringify({
      name: 'Dr. Public Queue',
      email: 'pubq-doctor@mediqueue.test',
      password: 'DocPass1',
      departmentId: deptId,
      roomId,
    }),
  });
  doctorId = (await docRes.json()).doctor.id;

  const patRes = await fetch(`${baseUrl}/api/patients`, {
    method: 'POST',
    headers: headers(receptionToken),
    body: JSON.stringify({ name: 'Public Queue Patient', gender: 'male', phone: '5554440000' }),
  });
  patientId = (await patRes.json()).patient.id;
});

after(async () => {
  server.close();
  if (fs.existsSync(TEST_DB)) fs.unlinkSync(TEST_DB);
});

test('GET /api/public/queue/:id works with NO Authorization header', async () => {
  const tokenRes = await fetch(`${baseUrl}/api/queue/token`, {
    method: 'POST',
    headers: headers(receptionToken),
    body: JSON.stringify({ patientId, departmentId: deptId, doctorId }),
  });
  const entryId = (await tokenRes.json()).entry.id;

  const res = await fetch(`${baseUrl}/api/public/queue/${entryId}`);
  assert.equal(res.status, 200);
  const json = await res.json();
  assert.equal(json.entry.token, 'A-001');
  assert.equal(json.entry.status, 'waiting');
  assert.equal(json.entry.roomNumber, '501');
});

test('public queue entry projection never includes patient name, code, or phone', async () => {
  const tokenRes = await fetch(`${baseUrl}/api/queue/token`, {
    method: 'POST',
    headers: headers(receptionToken),
    body: JSON.stringify({ patientId, departmentId: deptId, doctorId }),
  });
  const entryId = (await tokenRes.json()).entry.id;

  const res = await fetch(`${baseUrl}/api/public/queue/${entryId}`);
  const json = await res.json();
  const keys = Object.keys(json.entry);
  assert.ok(!keys.includes('patientName'), 'patientName must never appear in the public projection');
  assert.ok(!keys.includes('patientCode'), 'patientCode must never appear in the public projection');
  assert.ok(!keys.includes('patientPhone'), 'patientPhone must never appear in the public projection');
  assert.ok(!keys.includes('patientId'), 'patientId must never appear in the public projection');
});

test('GET /api/public/queue/:id returns 404 for unknown id, no auth needed to see that either', async () => {
  const res = await fetch(`${baseUrl}/api/public/queue/does-not-exist`);
  assert.equal(res.status, 404);
});

test('GET /api/public/queue requires departmentId (400), no auth needed', async () => {
  const res = await fetch(`${baseUrl}/api/public/queue`);
  assert.equal(res.status, 400);
});

test('GET /api/public/queue?departmentId= works with no auth and shows waiting count + next token, no patient info', async () => {
  const res = await fetch(`${baseUrl}/api/public/queue?departmentId=${deptId}`);
  assert.equal(res.status, 200);
  const json = await res.json();
  assert.equal(json.departmentName, 'Public Queue Test Dept');
  assert.ok(json.waitingCount >= 1);
  assert.ok(json.nextToken === null || typeof json.nextToken.token === 'string');
  assert.equal(JSON.stringify(json).includes('Public Queue Patient'), false, 'patient name must not appear anywhere in the board response');
});

test('calling a token moves it from nextToken to currentToken on the public board', async () => {
  // Call the currently-waiting entry.
  const boardBefore = await fetch(`${baseUrl}/api/public/queue?departmentId=${deptId}`).then((r) => r.json());
  const nextTok = boardBefore.nextToken?.token;
  assert.ok(nextTok, 'expected a waiting token before calling');

  // Find it via the authenticated endpoint to get its id to call it.
  const queueRes = await fetch(`${baseUrl}/api/queue?departmentId=${deptId}`, { headers: headers(adminToken) });
  const queueJson = await queueRes.json();
  const waitingEntry = queueJson.waiting.find((e) => e.token === nextTok);
  assert.ok(waitingEntry);

  await fetch(`${baseUrl}/api/queue/${waitingEntry.id}/call`, { method: 'POST', headers: headers(receptionToken) });

  const boardAfter = await fetch(`${baseUrl}/api/public/queue?departmentId=${deptId}`).then((r) => r.json());
  assert.equal(boardAfter.currentToken.token, nextTok);
});
