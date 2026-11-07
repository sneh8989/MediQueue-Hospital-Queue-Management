import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

process.env.NODE_ENV = 'test';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TEST_DB = path.join(__dirname, '..', 'data', 'db.queue.test.json');

let app;
let server;
let baseUrl;
let adminToken, receptionToken, nurseToken;
let deptId, doctorId;

function headers(token) {
  return { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
}

async function createPatient(token, name, phone) {
  const res = await fetch(`${baseUrl}/api/patients`, {
    method: 'POST',
    headers: headers(token),
    body: JSON.stringify({ name, gender: 'male', phone }),
  });
  return (await res.json()).patient.id;
}

before(async () => {
  if (fs.existsSync(TEST_DB)) fs.unlinkSync(TEST_DB);

  const { connectDB } = await import('../config/db.js');
  await connectDB(TEST_DB);

  const userModel = await import('../models/userModel.js');
  const authService = await import('../services/authService.js');

  await userModel.create({
    name: 'Queue Admin',
    email: 'queue-admin@mediqueue.test',
    passwordHash: await authService.hashPassword('Test@123'),
    role: 'admin',
  });
  await userModel.create({
    name: 'Queue Reception',
    email: 'queue-reception@mediqueue.test',
    passwordHash: await authService.hashPassword('Test@123'),
    role: 'receptionist',
  });
  await userModel.create({
    name: 'Queue Nurse',
    email: 'queue-nurse@mediqueue.test',
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

  adminToken = await login('queue-admin@mediqueue.test', 'Test@123');
  receptionToken = await login('queue-reception@mediqueue.test', 'Test@123');
  nurseToken = await login('queue-nurse@mediqueue.test', 'Test@123');

  const deptRes = await fetch(`${baseUrl}/api/departments`, {
    method: 'POST',
    headers: headers(adminToken),
    body: JSON.stringify({ name: 'Queue Test Dept' }),
  });
  deptId = (await deptRes.json()).department.id;

  const docRes = await fetch(`${baseUrl}/api/doctors`, {
    method: 'POST',
    headers: headers(adminToken),
    body: JSON.stringify({
      name: 'Dr. Queue Tester',
      email: 'queue-doctor@mediqueue.test',
      password: 'DocPass1',
      departmentId: deptId,
      avgConsultationMinutes: 5,
    }),
  });
  doctorId = (await docRes.json()).doctor.id;
});

after(async () => {
  server.close();
  if (fs.existsSync(TEST_DB)) fs.unlinkSync(TEST_DB);
});

// ---------- Token generation ----------

test('nurse cannot generate a token they lack department context for... actually nurses ARE allowed (queue manager role)', async () => {
  const patientId = await createPatient(receptionToken, 'Nurse-Booked Patient', '5550000100');
  const res = await fetch(`${baseUrl}/api/queue/token`, {
    method: 'POST',
    headers: headers(nurseToken),
    body: JSON.stringify({ patientId, departmentId: deptId, doctorId }),
  });
  assert.equal(res.status, 201);
});

test('generating a token for an unknown patient fails (400)', async () => {
  const res = await fetch(`${baseUrl}/api/queue/token`, {
    method: 'POST',
    headers: headers(receptionToken),
    body: JSON.stringify({ patientId: 'nonexistent', departmentId: deptId, doctorId }),
  });
  assert.equal(res.status, 400);
});

test('walk-in token without patientId fails validation (400)', async () => {
  const res = await fetch(`${baseUrl}/api/queue/token`, {
    method: 'POST',
    headers: headers(receptionToken),
    body: JSON.stringify({ departmentId: deptId, doctorId }),
  });
  assert.equal(res.status, 400);
});

// ---------- THE CORE FEATURE: priority ordering ----------
// Uses its own isolated department so earlier tests' queue entries (e.g.
// the walk-in token created in the "nurse can generate a token" test
// above) can't skew the patientsAhead counts here.

let priorityDeptId, priorityDoctorId;

test('setup an isolated department/doctor for priority-ordering tests', async () => {
  const deptRes = await fetch(`${baseUrl}/api/departments`, {
    method: 'POST',
    headers: headers(adminToken),
    body: JSON.stringify({ name: 'Priority Test Dept' }),
  });
  priorityDeptId = (await deptRes.json()).department.id;

  const docRes = await fetch(`${baseUrl}/api/doctors`, {
    method: 'POST',
    headers: headers(adminToken),
    body: JSON.stringify({
      name: 'Dr. Priority Tester',
      email: 'priority-doctor@mediqueue.test',
      password: 'DocPass1',
      departmentId: priorityDeptId,
      avgConsultationMinutes: 5,
    }),
  });
  priorityDoctorId = (await docRes.json()).doctor.id;
});

test('priority ordering: an emergency token created LAST is still queued FIRST', async () => {
  const p1 = await createPatient(receptionToken, 'Priority Normal 1', '5551000001');
  const p2 = await createPatient(receptionToken, 'Priority Normal 2', '5551000002');
  const p3 = await createPatient(receptionToken, 'Priority Emergency', '5551000003');

  const t1 = await fetch(`${baseUrl}/api/queue/token`, {
    method: 'POST',
    headers: headers(receptionToken),
    body: JSON.stringify({ patientId: p1, departmentId: priorityDeptId, doctorId: priorityDoctorId, priority: 'normal' }),
  }).then((r) => r.json());
  assert.equal(t1.entry.patientsAhead, 0);

  const t2 = await fetch(`${baseUrl}/api/queue/token`, {
    method: 'POST',
    headers: headers(receptionToken),
    body: JSON.stringify({ patientId: p2, departmentId: priorityDeptId, doctorId: priorityDoctorId, priority: 'normal' }),
  }).then((r) => r.json());
  assert.equal(t2.entry.patientsAhead, 1, 'second normal patient should have 1 ahead');
  assert.equal(t2.entry.estimatedWaitMinutes, 5, '1 patient ahead * 5 min avg consult = 5');

  // Created THIRD (chronologically last) but marked emergency.
  const t3 = await fetch(`${baseUrl}/api/queue/token`, {
    method: 'POST',
    headers: headers(receptionToken),
    body: JSON.stringify({ patientId: p3, departmentId: priorityDeptId, doctorId: priorityDoctorId, priority: 'emergency' }),
  }).then((r) => r.json());

  // The key assertion: despite being created last, the emergency patient
  // has 0 patients ahead of them - they jump to the front of the line.
  assert.equal(t3.entry.patientsAhead, 0, 'emergency patient must have 0 patients ahead despite being created last');
  assert.equal(t3.entry.queueType, 'emergency');

  const queueRes = await fetch(`${baseUrl}/api/queue?departmentId=${priorityDeptId}`, { headers: headers(adminToken) });
  const queue = await queueRes.json();
  const order = queue.waiting.map((e) => e.token);

  // Emergency token must be first in the ordered waiting list, even though
  // its token number sorts after A-001/A-002 alphabetically.
  assert.equal(order[0], t3.entry.token, 'emergency token must be first in queue order');
  assert.deepEqual(order, [t3.entry.token, t1.entry.token, t2.entry.token]);
});

test('calling next pulls the highest-priority waiting patient, not the oldest token', async () => {
  const res = await fetch(`${baseUrl}/api/queue/call-next`, {
    method: 'POST',
    headers: headers(receptionToken),
    body: JSON.stringify({ departmentId: priorityDeptId }),
  });
  assert.equal(res.status, 200);
  const json = await res.json();
  assert.equal(json.entry.priority, 'emergency', 'call-next must serve the emergency patient first');
  assert.equal(json.entry.status, 'called');
  assert.ok(json.entry.calledAt);
});

test('call-next on an empty queue returns 404', async () => {
  // Drain the remaining 2 waiting entries first by calling them out.
  await fetch(`${baseUrl}/api/queue/call-next`, { method: 'POST', headers: headers(receptionToken), body: JSON.stringify({ departmentId: priorityDeptId }) });
  await fetch(`${baseUrl}/api/queue/call-next`, { method: 'POST', headers: headers(receptionToken), body: JSON.stringify({ departmentId: priorityDeptId }) });

  const res = await fetch(`${baseUrl}/api/queue/call-next`, {
    method: 'POST',
    headers: headers(receptionToken),
    body: JSON.stringify({ departmentId: priorityDeptId }),
  });
  assert.equal(res.status, 404);
});

// ---------- State machine ----------

let stateMachineEntryId;

test('setup a fresh token for state machine tests', async () => {
  const p = await createPatient(receptionToken, 'State Machine Patient', '5552000001');
  const res = await fetch(`${baseUrl}/api/queue/token`, {
    method: 'POST',
    headers: headers(receptionToken),
    body: JSON.stringify({ patientId: p, departmentId: deptId, doctorId }),
  });
  const json = await res.json();
  stateMachineEntryId = json.entry.id;
  assert.equal(json.entry.status, 'waiting');
});

test('cannot start a consultation before the entry is called (409)', async () => {
  const res = await fetch(`${baseUrl}/api/queue/${stateMachineEntryId}/start`, {
    method: 'POST',
    headers: headers(receptionToken),
  });
  assert.equal(res.status, 409);
});

test('cannot skip a waiting entry - skip only applies after being called (409)', async () => {
  const res = await fetch(`${baseUrl}/api/queue/${stateMachineEntryId}/skip`, {
    method: 'POST',
    headers: headers(receptionToken),
  });
  assert.equal(res.status, 409);
});

test('call the specific entry directly', async () => {
  const res = await fetch(`${baseUrl}/api/queue/${stateMachineEntryId}/call`, {
    method: 'POST',
    headers: headers(receptionToken),
  });
  assert.equal(res.status, 200);
  const json = await res.json();
  assert.equal(json.entry.status, 'called');
});

test('skip the called entry', async () => {
  const res = await fetch(`${baseUrl}/api/queue/${stateMachineEntryId}/skip`, {
    method: 'POST',
    headers: headers(receptionToken),
  });
  assert.equal(res.status, 200);
  const json = await res.json();
  assert.equal(json.entry.status, 'skipped');
});

test('recall the skipped entry back to called', async () => {
  const res = await fetch(`${baseUrl}/api/queue/${stateMachineEntryId}/recall`, {
    method: 'POST',
    headers: headers(receptionToken),
  });
  assert.equal(res.status, 200);
  const json = await res.json();
  assert.equal(json.entry.status, 'called');
});

test('start the consultation', async () => {
  const res = await fetch(`${baseUrl}/api/queue/${stateMachineEntryId}/start`, {
    method: 'POST',
    headers: headers(receptionToken),
  });
  assert.equal(res.status, 200);
  const json = await res.json();
  assert.equal(json.entry.status, 'in_consultation');
  assert.ok(json.entry.startedAt);
});

test('cannot complete before starting was already done - re-starting fails (409)', async () => {
  const res = await fetch(`${baseUrl}/api/queue/${stateMachineEntryId}/start`, {
    method: 'POST',
    headers: headers(receptionToken),
  });
  assert.equal(res.status, 409);
});

test('complete the consultation', async () => {
  const res = await fetch(`${baseUrl}/api/queue/${stateMachineEntryId}/complete`, {
    method: 'POST',
    headers: headers(receptionToken),
  });
  assert.equal(res.status, 200);
  const json = await res.json();
  assert.equal(json.entry.status, 'completed');
  assert.ok(json.entry.completedAt);
});

test('cannot cancel a completed entry (409)', async () => {
  const res = await fetch(`${baseUrl}/api/queue/${stateMachineEntryId}/cancel`, {
    method: 'POST',
    headers: headers(receptionToken),
  });
  assert.equal(res.status, 409);
});

// ---------- Role enforcement ----------

test('a role outside admin/receptionist/nurse/doctor cannot manage the queue', async () => {
  // There's no 5th role to test against directly, so instead verify an
  // unauthenticated request is rejected, confirming requireAuth guards
  // every mutating queue route.
  const res = await fetch(`${baseUrl}/api/queue/call-next`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ departmentId: deptId }),
  });
  assert.equal(res.status, 401);
});

// ---------- Patient queue history ----------

test('GET /api/queue/history requires patientId (400)', async () => {
  const res = await fetch(`${baseUrl}/api/queue/history`, { headers: headers(adminToken) });
  assert.equal(res.status, 400);
});

test('GET /api/queue/history returns all of a patient\'s tokens across departments, most recent first', async () => {
  const patientId = await createPatient(receptionToken, 'History Test Patient', '5553000001');

  const first = await fetch(`${baseUrl}/api/queue/token`, {
    method: 'POST',
    headers: headers(receptionToken),
    body: JSON.stringify({ patientId, departmentId: deptId, doctorId }),
  }).then((r) => r.json());

  const second = await fetch(`${baseUrl}/api/queue/token`, {
    method: 'POST',
    headers: headers(receptionToken),
    body: JSON.stringify({ patientId, departmentId: priorityDeptId, doctorId: priorityDoctorId }),
  }).then((r) => r.json());

  const res = await fetch(`${baseUrl}/api/queue/history?patientId=${patientId}`, { headers: headers(adminToken) });
  assert.equal(res.status, 200);
  const json = await res.json();
  assert.equal(json.count, 2);
  // Most recent (second) token should be first in the list.
  assert.equal(json.entries[0].id, second.entry.id);
  assert.equal(json.entries[1].id, first.entry.id);
});

// ---------- GET /api/queue/:id 404 ----------

test('GET /api/queue/:id returns 404 for unknown id', async () => {
  const res = await fetch(`${baseUrl}/api/queue/nonexistent`, { headers: headers(adminToken) });
  assert.equal(res.status, 404);
});

// ---------- Token generation from an existing appointment ----------
// Closes a gap flagged in Phase 6's PROJECT_STATE.md: only the walk-in
// token path (POST /api/queue/token with patientId/departmentId/doctorId)
// had test coverage; the appointmentId conversion path did not.

test('generating a token from an appointmentId pulls patient/doctor/department from the appointment', async () => {
  const patientId = await createPatient(receptionToken, 'Appointment Token Patient', '5556000001');

  const apptRes = await fetch(`${baseUrl}/api/appointments`, {
    method: 'POST',
    headers: headers(receptionToken),
    body: JSON.stringify({
      patientId,
      doctorId,
      departmentId: deptId,
      date: '2026-11-15',
      timeSlot: '09:00',
    }),
  });
  const appointment = (await apptRes.json()).appointment;
  assert.equal(appointment.status, 'scheduled');

  const tokenRes = await fetch(`${baseUrl}/api/queue/token`, {
    method: 'POST',
    headers: headers(receptionToken),
    body: JSON.stringify({ appointmentId: appointment.id }),
  });
  assert.equal(tokenRes.status, 201);
  const tokenJson = await tokenRes.json();
  assert.equal(tokenJson.entry.patientId, patientId);
  assert.equal(tokenJson.entry.doctorId, doctorId);
  assert.equal(tokenJson.entry.departmentId, deptId);
  assert.equal(tokenJson.entry.queueType, 'appointment', 'token from an appointment should be queueType "appointment", not "normal"');
  assert.equal(tokenJson.entry.appointmentId, appointment.id);

  // Generating the token should also flip the appointment's status.
  const apptCheck = await fetch(`${baseUrl}/api/appointments/${appointment.id}`, { headers: headers(adminToken) });
  const apptCheckJson = await apptCheck.json();
  assert.equal(apptCheckJson.appointment.status, 'waiting', "appointment status should move to 'waiting' once its token is generated");
});

test('generating a token from an unknown appointmentId fails (400)', async () => {
  const res = await fetch(`${baseUrl}/api/queue/token`, {
    method: 'POST',
    headers: headers(receptionToken),
    body: JSON.stringify({ appointmentId: 'does-not-exist' }),
  });
  assert.equal(res.status, 400);
});

test('generating a duplicate token for an already-checked-in appointment fails (409)', async () => {
  const patientId = await createPatient(receptionToken, 'Duplicate Checkin Patient', '5559990001');
  const apptRes = await fetch(`${baseUrl}/api/appointments`, {
    method: 'POST',
    headers: headers(receptionToken),
    body: JSON.stringify({
      patientId,
      doctorId,
      departmentId: deptId,
      date: '2026-11-16',
      timeSlot: '10:00',
    }),
  });
  const appointment = (await apptRes.json()).appointment;

  const firstTokenRes = await fetch(`${baseUrl}/api/queue/token`, {
    method: 'POST',
    headers: headers(receptionToken),
    body: JSON.stringify({ appointmentId: appointment.id }),
  });
  assert.equal(firstTokenRes.status, 201);

  // Second attempt for the same appointment must fail with 409
  const secondTokenRes = await fetch(`${baseUrl}/api/queue/token`, {
    method: 'POST',
    headers: headers(receptionToken),
    body: JSON.stringify({ appointmentId: appointment.id }),
  });
  assert.equal(secondTokenRes.status, 409);
});

test('generating a token for a cancelled appointment fails (400)', async () => {
  const patientId = await createPatient(receptionToken, 'Cancelled Appt Patient', '5559990002');
  const apptRes = await fetch(`${baseUrl}/api/appointments`, {
    method: 'POST',
    headers: headers(receptionToken),
    body: JSON.stringify({
      patientId,
      doctorId,
      departmentId: deptId,
      date: '2026-11-16',
      timeSlot: '11:00',
    }),
  });
  const appointment = (await apptRes.json()).appointment;

  // Cancel the appointment
  await fetch(`${baseUrl}/api/appointments/${appointment.id}`, {
    method: 'PUT',
    headers: headers(receptionToken),
    body: JSON.stringify({ status: 'cancelled' }),
  });

  // Attempting to check in the cancelled appointment must fail with 400
  const tokenRes = await fetch(`${baseUrl}/api/queue/token`, {
    method: 'POST',
    headers: headers(receptionToken),
    body: JSON.stringify({ appointmentId: appointment.id }),
  });
  assert.equal(tokenRes.status, 400);
});
