import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

process.env.NODE_ENV = 'test';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TEST_DB = path.join(__dirname, '..', 'data', 'db.settings.test.json');

let app;
let server;
let baseUrl;
let adminToken, receptionToken, nurseToken;
let deptId, doctorId, doctorModel;

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

const putSettings = (token, body) =>
  fetch(`${baseUrl}/api/settings`, { method: 'PUT', headers: headers(token), body: JSON.stringify(body) });

const getSettings = (token) => fetch(`${baseUrl}/api/settings`, { headers: headers(token) });

before(async () => {
  if (fs.existsSync(TEST_DB)) fs.unlinkSync(TEST_DB);

  const { connectDB } = await import('../config/db.js');
  await connectDB(TEST_DB);

  const userModel = await import('../models/userModel.js');
  const authService = await import('../services/authService.js');
  doctorModel = await import('../models/doctorModel.js');

  for (const [name, email, role] of [
    ['Settings Admin', 'settings-admin@mediqueue.test', 'admin'],
    ['Settings Reception', 'settings-reception@mediqueue.test', 'receptionist'],
    ['Settings Nurse', 'settings-nurse@mediqueue.test', 'nurse'],
  ]) {
    await userModel.create({ name, email, passwordHash: await authService.hashPassword('Test@123'), role });
  }

  ({ default: app } = await import('../app.js'));
  server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  baseUrl = `http://localhost:${server.address().port}`;

  adminToken = await login('settings-admin@mediqueue.test', 'Test@123');
  receptionToken = await login('settings-reception@mediqueue.test', 'Test@123');
  nurseToken = await login('settings-nurse@mediqueue.test', 'Test@123');

  const deptRes = await fetch(`${baseUrl}/api/departments`, {
    method: 'POST',
    headers: headers(adminToken),
    body: JSON.stringify({ name: 'Settings Test Dept' }),
  });
  deptId = (await deptRes.json()).department.id;

  const docRes = await fetch(`${baseUrl}/api/doctors`, {
    method: 'POST',
    headers: headers(adminToken),
    body: JSON.stringify({
      name: 'Dr. Settings Tester',
      email: 'settings-doctor@mediqueue.test',
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

test('GET /api/settings without a token is rejected (401)', async () => {
  const res = await fetch(`${baseUrl}/api/settings`);
  assert.equal(res.status, 401);
});

test('receptionist and nurse cannot read or change settings (403)', async () => {
  for (const token of [receptionToken, nurseToken]) {
    assert.equal((await getSettings(token)).status, 403);
    assert.equal((await putSettings(token, { averageConsultationMinutes: 9 })).status, 403);
  }
});

test('admin reads the default settings', async () => {
  const res = await getSettings(adminToken);
  assert.equal(res.status, 200);
  const json = await res.json();
  assert.equal(json.settings.averageConsultationMinutes, 5);
});

test('settings response never exposes queueTokenPrefixes (they are not editable, so not offered)', async () => {
  const json = await (await getSettings(adminToken)).json();
  assert.equal('queueTokenPrefixes' in json.settings, false);
});

test('a PUT that tries to smuggle in queueTokenPrefixes changes nothing', async () => {
  const res = await putSettings(adminToken, {
    averageConsultationMinutes: 5,
    queueTokenPrefixes: { normal: 'Z', appointment: 'Z', emergency: 'Z' },
  });
  assert.equal(res.status, 200);
  const { getDB } = await import('../config/db.js');
  assert.deepEqual(getDB().data.hospitalSettings.queueTokenPrefixes, { normal: 'A', appointment: 'B', emergency: 'E' });
});

test('rejects missing, zero, too-large, fractional and non-numeric values (400) and leaves the setting alone', async () => {
  for (const bad of [{}, { averageConsultationMinutes: 0 }, { averageConsultationMinutes: 121 }, { averageConsultationMinutes: 5.5 }, { averageConsultationMinutes: 'abc' }, { averageConsultationMinutes: -3 }]) {
    const res = await putSettings(adminToken, bad);
    assert.equal(res.status, 400, `expected 400 for ${JSON.stringify(bad)}`);
  }
  const json = await (await getSettings(adminToken)).json();
  assert.equal(json.settings.averageConsultationMinutes, 5);
});

test('admin updates the default consultation time and it persists', async () => {
  const res = await putSettings(adminToken, { averageConsultationMinutes: 8 });
  assert.equal(res.status, 200);
  assert.equal((await res.json()).settings.averageConsultationMinutes, 8);

  const json = await (await getSettings(adminToken)).json();
  assert.equal(json.settings.averageConsultationMinutes, 8);
});

test('a numeric string is accepted and stored as a real number', async () => {
  const res = await putSettings(adminToken, { averageConsultationMinutes: '10' });
  assert.equal(res.status, 200);
  assert.strictEqual((await res.json()).settings.averageConsultationMinutes, 10);
});

test('changing the setting writes exactly one audit entry; re-saving the same value writes none', async () => {
  const before = await (await fetch(`${baseUrl}/api/audit-logs?action=settings_updated`, { headers: headers(adminToken) })).json();

  await putSettings(adminToken, { averageConsultationMinutes: 12 });
  const afterChange = await (await fetch(`${baseUrl}/api/audit-logs?action=settings_updated`, { headers: headers(adminToken) })).json();
  assert.equal(afterChange.logs.length, before.logs.length + 1);
  assert.equal(afterChange.logs[0].entity, 'settings');
  assert.match(afterChange.logs[0].description, /from 10 to 12 minutes/);
  assert.equal(afterChange.logs[0].userName, 'settings-admin@mediqueue.test');

  await putSettings(adminToken, { averageConsultationMinutes: 12 });
  const afterNoop = await (await fetch(`${baseUrl}/api/audit-logs?action=settings_updated`, { headers: headers(adminToken) })).json();
  assert.equal(afterNoop.logs.length, afterChange.logs.length);
});

// The most important test in this file: proves the setting is not decorative.
// A doctor with no personal average must have wait estimates driven by the
// hospital-wide default - both on the staff queue and the public tracking page.
test('the setting genuinely drives wait estimates for a doctor with no personal average', async () => {
  await doctorModel.update(doctorId, { avgConsultationMinutes: null });

  const makePatient = async (n) => {
    const res = await fetch(`${baseUrl}/api/patients`, {
      method: 'POST',
      headers: headers(receptionToken),
      body: JSON.stringify({ name: `Settings Patient ${n}`, gender: 'female', phone: `55599900${n}0` }),
    });
    return (await res.json()).patient.id;
  };
  const makeToken = async (patientId) => {
    const res = await fetch(`${baseUrl}/api/queue/token`, {
      method: 'POST',
      headers: headers(receptionToken),
      body: JSON.stringify({ patientId, departmentId: deptId, doctorId }),
    });
    return (await res.json()).entry;
  };

  await makeToken(await makePatient(1));
  const second = await makeToken(await makePatient(2)); // one patient ahead

  await putSettings(adminToken, { averageConsultationMinutes: 7 });
  let pub = await (await fetch(`${baseUrl}/api/public/queue/${second.id}`)).json();
  assert.equal(pub.entry.patientsAhead, 1);
  assert.equal(pub.entry.estimatedWaitMinutes, 7);

  await putSettings(adminToken, { averageConsultationMinutes: 20 });
  pub = await (await fetch(`${baseUrl}/api/public/queue/${second.id}`)).json();
  assert.equal(pub.entry.estimatedWaitMinutes, 20);

  const staff = await (await fetch(`${baseUrl}/api/queue/${second.id}`, { headers: headers(receptionToken) })).json();
  assert.equal(staff.entry.estimatedWaitMinutes, 20);
});

test('a doctor WITH a personal average is not affected by the hospital-wide default', async () => {
  await doctorModel.update(doctorId, { avgConsultationMinutes: 3 });
  await putSettings(adminToken, { averageConsultationMinutes: 45 });

  const res = await fetch(`${baseUrl}/api/queue?departmentId=${deptId}`, { headers: headers(receptionToken) });
  const json = await res.json();
  const waiting = json.waiting.find((e) => e.patientsAhead === 1);
  assert.equal(waiting.estimatedWaitMinutes, 3);
});
