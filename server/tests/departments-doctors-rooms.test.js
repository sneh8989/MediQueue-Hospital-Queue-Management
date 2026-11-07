import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

process.env.NODE_ENV = 'test';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TEST_DB = path.join(__dirname, '..', 'data', 'db.hospital.test.json');

let app;
let server;
let baseUrl;
let adminToken;
let nurseToken;

before(async () => {
  if (fs.existsSync(TEST_DB)) fs.unlinkSync(TEST_DB);

  const { connectDB } = await import('../config/db.js');
  await connectDB(TEST_DB);

  const userModel = await import('../models/userModel.js');
  const authService = await import('../services/authService.js');

  await userModel.create({
    name: 'Test Admin 2',
    email: 'test-admin2@mediqueue.test',
    passwordHash: await authService.hashPassword('Test@123'),
    role: 'admin',
  });
  await userModel.create({
    name: 'Test Nurse',
    email: 'test-nurse@mediqueue.test',
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

  adminToken = await login('test-admin2@mediqueue.test', 'Test@123');
  nurseToken = await login('test-nurse@mediqueue.test', 'Test@123');
});

after(async () => {
  server.close();
  if (fs.existsSync(TEST_DB)) fs.unlinkSync(TEST_DB);
});

function headers(token) {
  return { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
}

// ---------- Departments ----------

let deptId;

test('nurse cannot create a department (403)', async () => {
  const res = await fetch(`${baseUrl}/api/departments`, {
    method: 'POST',
    headers: headers(nurseToken),
    body: JSON.stringify({ name: 'Cardiology' }),
  });
  assert.equal(res.status, 403);
});

test('admin creates a department', async () => {
  const res = await fetch(`${baseUrl}/api/departments`, {
    method: 'POST',
    headers: headers(adminToken),
    body: JSON.stringify({ name: 'Cardiology', description: 'Heart care' }),
  });
  assert.equal(res.status, 201);
  const json = await res.json();
  assert.equal(json.department.name, 'Cardiology');
  deptId = json.department.id;
});

test('creating a duplicate department name fails (409)', async () => {
  const res = await fetch(`${baseUrl}/api/departments`, {
    method: 'POST',
    headers: headers(adminToken),
    body: JSON.stringify({ name: 'Cardiology' }),
  });
  assert.equal(res.status, 409);
});

test('any authenticated role can list departments', async () => {
  const res = await fetch(`${baseUrl}/api/departments`, { headers: headers(nurseToken) });
  assert.equal(res.status, 200);
  const json = await res.json();
  assert.equal(json.count, 1);
});

test('deactivated departments are excluded from default list', async () => {
  const res = await fetch(`${baseUrl}/api/departments/${deptId}`, {
    method: 'DELETE',
    headers: headers(adminToken),
  });
  assert.equal(res.status, 200);

  const listRes = await fetch(`${baseUrl}/api/departments`, { headers: headers(nurseToken) });
  const listJson = await listRes.json();
  assert.equal(listJson.count, 0, 'deactivated department should not show by default');

  // Recreate for the rest of the suite (rooms/doctors need an active department)
  const recreate = await fetch(`${baseUrl}/api/departments`, {
    method: 'POST',
    headers: headers(adminToken),
    body: JSON.stringify({ name: 'General Medicine' }),
  });
  deptId = (await recreate.json()).department.id;
});

// ---------- Rooms ----------

let roomId;

test('nurse cannot create a room (403)', async () => {
  const res = await fetch(`${baseUrl}/api/rooms`, {
    method: 'POST',
    headers: headers(nurseToken),
    body: JSON.stringify({ number: '101', departmentId: deptId }),
  });
  assert.equal(res.status, 403);
});

test('admin creates a room, defaults to available status', async () => {
  const res = await fetch(`${baseUrl}/api/rooms`, {
    method: 'POST',
    headers: headers(adminToken),
    body: JSON.stringify({ number: '204', departmentId: deptId }),
  });
  assert.equal(res.status, 201);
  const json = await res.json();
  assert.equal(json.room.status, 'available');
  assert.equal(json.room.departmentName, 'General Medicine');
  roomId = json.room.id;
});

test('room creation rejects unknown department (400)', async () => {
  const res = await fetch(`${baseUrl}/api/rooms`, {
    method: 'POST',
    headers: headers(adminToken),
    body: JSON.stringify({ number: '999', departmentId: 'nonexistent' }),
  });
  assert.equal(res.status, 400);
});

test('duplicate room number fails (409)', async () => {
  const res = await fetch(`${baseUrl}/api/rooms`, {
    method: 'POST',
    headers: headers(adminToken),
    body: JSON.stringify({ number: '204', departmentId: deptId }),
  });
  assert.equal(res.status, 409);
});

// ---------- Doctors ----------

let doctorId;

test('nurse cannot create a doctor (403)', async () => {
  const res = await fetch(`${baseUrl}/api/doctors`, {
    method: 'POST',
    headers: headers(nurseToken),
    body: JSON.stringify({ name: 'Blocked', email: 'blocked@mediqueue.test', password: 'password1', departmentId: deptId }),
  });
  assert.equal(res.status, 403);
});

test('creating a doctor without email/password fails validation (400)', async () => {
  const res = await fetch(`${baseUrl}/api/doctors`, {
    method: 'POST',
    headers: headers(adminToken),
    body: JSON.stringify({ name: 'No Login', departmentId: deptId }),
  });
  assert.equal(res.status, 400);
});

test('admin creates a doctor with a new login and assigns a room; room becomes occupied', async () => {
  const res = await fetch(`${baseUrl}/api/doctors`, {
    method: 'POST',
    headers: headers(adminToken),
    body: JSON.stringify({
      name: 'Dr. Test Physician',
      email: 'test-physician@mediqueue.test',
      password: 'DoctorPass1',
      departmentId: deptId,
      roomId: roomId,
      avgConsultationMinutes: 8,
    }),
  });
  assert.equal(res.status, 201);
  const json = await res.json();
  assert.equal(json.doctor.avgConsultationMinutes, 8);
  assert.ok(json.doctor.userId, 'doctor should be linked to a new user account');
  doctorId = json.doctor.id;

  const roomRes = await fetch(`${baseUrl}/api/rooms/${roomId}`, { headers: headers(adminToken) });
  const roomJson = await roomRes.json();
  assert.equal(roomJson.room.status, 'occupied');
  assert.equal(roomJson.room.doctorId, doctorId);
});

test('the newly created doctor can log in with their own credentials', async () => {
  const res = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'test-physician@mediqueue.test', password: 'DoctorPass1' }),
  });
  assert.equal(res.status, 200);
  const json = await res.json();
  assert.equal(json.user.role, 'doctor');
});

test('GET /api/doctors/me resolves the logged-in doctor\'s own profile', async () => {
  const loginRes = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'test-physician@mediqueue.test', password: 'DoctorPass1' }),
  });
  const { token } = await loginRes.json();

  const res = await fetch(`${baseUrl}/api/doctors/me`, { headers: headers(token) });
  assert.equal(res.status, 200);
  const json = await res.json();
  assert.equal(json.doctor.name, 'Dr. Test Physician');
  assert.equal(json.doctor.departmentName, 'General Medicine');
});

test('GET /api/doctors/me is forbidden for non-doctor roles (403)', async () => {
  const res = await fetch(`${baseUrl}/api/doctors/me`, { headers: headers(adminToken) });
  assert.equal(res.status, 403);
});

test('creating a doctor with a duplicate email fails (409)', async () => {
  const res = await fetch(`${baseUrl}/api/doctors`, {
    method: 'POST',
    headers: headers(adminToken),
    body: JSON.stringify({
      name: 'Dr. Duplicate',
      email: 'test-physician@mediqueue.test',
      password: 'AnotherPass1',
      departmentId: deptId,
    }),
  });
  assert.equal(res.status, 409);
});

test('unassigning a doctor from their room frees the room back to available', async () => {
  const res = await fetch(`${baseUrl}/api/doctors/${doctorId}`, {
    method: 'PUT',
    headers: headers(adminToken),
    body: JSON.stringify({ roomId: null }),
  });
  assert.equal(res.status, 200);

  const roomRes = await fetch(`${baseUrl}/api/rooms/${roomId}`, { headers: headers(adminToken) });
  const roomJson = await roomRes.json();
  assert.equal(roomJson.room.status, 'available');
  assert.equal(roomJson.room.doctorId, null);
});

test('any authenticated role can list doctors, filtered by department', async () => {
  const res = await fetch(`${baseUrl}/api/doctors?departmentId=${deptId}`, { headers: headers(nurseToken) });
  assert.equal(res.status, 200);
  const json = await res.json();
  assert.equal(json.count, 1);
  assert.equal(json.doctors[0].id, doctorId);
});

test('deactivating a doctor removes them from the default list', async () => {
  const res = await fetch(`${baseUrl}/api/doctors/${doctorId}`, { method: 'DELETE', headers: headers(adminToken) });
  assert.equal(res.status, 200);

  const listRes = await fetch(`${baseUrl}/api/doctors`, { headers: headers(nurseToken) });
  const listJson = await listRes.json();
  assert.equal(listJson.count, 0);
});
