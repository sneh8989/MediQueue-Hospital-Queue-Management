import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

process.env.NODE_ENV = 'test';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TEST_DB = path.join(__dirname, '..', 'data', 'db.patients.test.json');

let app;
let server;
let baseUrl;
let receptionToken;
let doctorToken;

before(async () => {
  if (fs.existsSync(TEST_DB)) fs.unlinkSync(TEST_DB);

  const { connectDB } = await import('../config/db.js');
  await connectDB(TEST_DB);

  const userModel = await import('../models/userModel.js');
  const authService = await import('../services/authService.js');

  const receptionHash = await authService.hashPassword('Test@123');
  await userModel.create({
    name: 'Test Receptionist',
    email: 'test-reception@mediqueue.test',
    passwordHash: receptionHash,
    role: 'receptionist',
  });

  const doctorHash = await authService.hashPassword('Test@123');
  await userModel.create({
    name: 'Test Doctor',
    email: 'test-doctor@mediqueue.test',
    passwordHash: doctorHash,
    role: 'doctor',
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
    const json = await res.json();
    return json.token;
  }

  receptionToken = await login('test-reception@mediqueue.test', 'Test@123');
  doctorToken = await login('test-doctor@mediqueue.test', 'Test@123');
});

after(async () => {
  server.close();
  if (fs.existsSync(TEST_DB)) fs.unlinkSync(TEST_DB);
});

function authHeaders(token) {
  return { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
}

test('POST /api/patients requires authentication', async () => {
  const res = await fetch(`${baseUrl}/api/patients`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'No Auth', gender: 'male', phone: '5550000000' }),
  });
  assert.equal(res.status, 401);
});

test('POST /api/patients rejects doctor role (only admin/receptionist can create)', async () => {
  const res = await fetch(`${baseUrl}/api/patients`, {
    method: 'POST',
    headers: authHeaders(doctorToken),
    body: JSON.stringify({ name: 'Blocked', gender: 'male', phone: '5550000001' }),
  });
  assert.equal(res.status, 403);
});

test('POST /api/patients validates required fields', async () => {
  const res = await fetch(`${baseUrl}/api/patients`, {
    method: 'POST',
    headers: authHeaders(receptionToken),
    body: JSON.stringify({ name: 'Missing Fields' }),
  });
  assert.equal(res.status, 400);
  const json = await res.json();
  assert.equal(json.success, false);
});

let createdPatientId;

test('POST /api/patients creates a patient with auto-generated patientCode', async () => {
  const res = await fetch(`${baseUrl}/api/patients`, {
    method: 'POST',
    headers: authHeaders(receptionToken),
    body: JSON.stringify({
      name: 'Jane Doe',
      gender: 'female',
      phone: '5551112222',
      dob: '1995-03-20',
      bloodGroup: 'A+',
    }),
  });
  assert.equal(res.status, 201);
  const json = await res.json();
  assert.equal(json.success, true);
  assert.equal(json.patient.patientCode, 'P-0001');
  assert.equal(json.patient.name, 'Jane Doe');
  assert.equal(typeof json.patient.age, 'number');
  createdPatientId = json.patient.id;
});

test('GET /api/patients lists patients (any authenticated role)', async () => {
  const res = await fetch(`${baseUrl}/api/patients`, { headers: authHeaders(doctorToken) });
  assert.equal(res.status, 200);
  const json = await res.json();
  assert.equal(json.success, true);
  assert.ok(json.patients.length >= 1);
});

test('GET /api/patients?search= filters by name', async () => {
  const res = await fetch(`${baseUrl}/api/patients?search=Jane`, { headers: authHeaders(receptionToken) });
  const json = await res.json();
  assert.equal(json.count, 1);
  assert.equal(json.patients[0].name, 'Jane Doe');
});

test('GET /api/patients?search= with no matches returns empty array', async () => {
  const res = await fetch(`${baseUrl}/api/patients?search=Nobody`, { headers: authHeaders(receptionToken) });
  const json = await res.json();
  assert.equal(json.count, 0);
});

test('GET /api/patients/:id returns the patient', async () => {
  const res = await fetch(`${baseUrl}/api/patients/${createdPatientId}`, { headers: authHeaders(doctorToken) });
  assert.equal(res.status, 200);
  const json = await res.json();
  assert.equal(json.patient.id, createdPatientId);
});

test('GET /api/patients/:id returns 404 for unknown id', async () => {
  const res = await fetch(`${baseUrl}/api/patients/does-not-exist`, { headers: authHeaders(doctorToken) });
  assert.equal(res.status, 404);
});

test('PUT /api/patients/:id updates the patient and recalculates age from new dob', async () => {
  const res = await fetch(`${baseUrl}/api/patients/${createdPatientId}`, {
    method: 'PUT',
    headers: authHeaders(receptionToken),
    body: JSON.stringify({
      name: 'Jane Doe',
      gender: 'female',
      phone: '5551112222',
      address: '456 Oak Ave',
      dob: '2000-01-01',
    }),
  });
  assert.equal(res.status, 200);
  const json = await res.json();
  assert.equal(json.patient.address, '456 Oak Ave');
  assert.ok(json.patient.age < 30, 'age should recalculate from the new dob');
});

test('PUT /api/patients/:id rejects doctor role', async () => {
  const res = await fetch(`${baseUrl}/api/patients/${createdPatientId}`, {
    method: 'PUT',
    headers: authHeaders(doctorToken),
    body: JSON.stringify({ name: 'Jane Doe', gender: 'female', phone: '5551112222' }),
  });
  assert.equal(res.status, 403);
});

test('second created patient gets the next sequential patientCode', async () => {
  const res = await fetch(`${baseUrl}/api/patients`, {
    method: 'POST',
    headers: authHeaders(receptionToken),
    body: JSON.stringify({ name: 'Second Patient', gender: 'male', phone: '5559998888' }),
  });
  const json = await res.json();
  assert.equal(json.patient.patientCode, 'P-0002');
});
