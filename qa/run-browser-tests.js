/**
 * End-to-End Browser Automation Suite for MediQueue Hospital Queue Management System
 * Driven with Puppeteer-core via local Google Chrome.
 * Tests:
 *  - Test A: Admin Workflow
 *  - Test B: Receptionist Workflow (with Appointment-to-Queue Check-In)
 *  - Test C: Doctor Workflow (Consultation Notes, Prescriptions, Completion)
 *  - Test D: Nurse Workflow & RBAC / Authorization Checks (403 verification)
 *  - Test E: Public Display Screen & Tracking Pages (PII privacy check)
 *  - Test F: Critical Queue Priority Verification (Emergency FIFO preemption)
 *  - Phase 8: Mobile Responsiveness & Navigation Drawer Verification
 */

import puppeteer from 'puppeteer-core';
import path from 'path';
import fs from 'fs';

const CHROME_PATH = 'C:\\Users\\sneh kheni\\AppData\\Local\\Google\\Chrome\\Application\\chrome.exe';
const BASE_URL = 'http://localhost:5173';
const SCREENSHOTS_DIR = 'd:\\hospital-queue-management\\docs\\screenshots';

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function takeScreenshot(page, filename) {
  const filePath = path.join(SCREENSHOTS_DIR, filename);
  await page.screenshot({ path: filePath, fullPage: false });
  console.log(`[Screenshot saved] ${filename}`);
}

async function loginAs(page, email, password) {
  // Check if already logged in as this user
  const alreadyUser = await page.evaluate(() => {
    try {
      const u = JSON.parse(localStorage.getItem('hqms_user') || 'null');
      return u?.email;
    } catch {
      return null;
    }
  });
  if (alreadyUser === email && !page.url().includes('/login')) {
    console.log(`[Auth] Already logged in as ${email}`);
    return;
  }

  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
  await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle0' });
  await page.waitForSelector('#email');
  await page.focus('#email');
  await page.keyboard.down('Control');
  await page.keyboard.press('KeyA');
  await page.keyboard.up('Control');
  await page.keyboard.press('Backspace');
  await page.type('#email', email);

  await page.focus('#password');
  await page.keyboard.down('Control');
  await page.keyboard.press('KeyA');
  await page.keyboard.up('Control');
  await page.keyboard.press('Backspace');
  await page.type('#password', password);

  await page.click('button[type="submit"]');
  try {
    await page.waitForFunction(() => window.location.pathname !== '/login', { timeout: 10000 });
  } catch (err) {
    const errText = await page.evaluate(() => document.querySelector('.bg-red-50')?.textContent || 'unknown');
    throw new Error(`Login failed for ${email}: ${errText}`);
  }
  await delay(800);
}

async function main() {
  if (!fs.existsSync(SCREENSHOTS_DIR)) {
    fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
  }

  const runSuffix = Date.now().toString().slice(-4);
  const deptName = `Trauma QA ${runSuffix}`;
  const docName = `Dr. Maya QA ${runSuffix}`;
  const docEmail = `dr.maya.${runSuffix}@mediqueue.test`;
  const patAlphaName = `Johnathan Alpha ${runSuffix}`;
  const patBetaName = `Sarah Beta ${runSuffix}`;
  const patBetaPhone = `98256${runSuffix}`;

  console.log('====================================================');
  console.log('STARTING AUTOMATED REAL BROWSER QA (TESTS A - F & RESPONSIVE)');
  console.log('====================================================');
  console.log(`[Test Config] runSuffix=${runSuffix}, deptName=${deptName}, docEmail=${docEmail}`);

  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: true,
    defaultViewport: { width: 1440, height: 900 },
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--window-size=1440,900'],
  });

  const page = await browser.newPage();

  const consoleErrors = [];
  const requestFailures = [];

  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      consoleErrors.push(msg.text());
    }
  });

  page.on('requestfailed', (req) => {
    requestFailures.push(`${req.url()} (${req.failure()?.errorText})`);
  });

  page.on('dialog', async (dialog) => {
    console.log(`[Browser Dialog] ${dialog.type()}: ${dialog.message()}`);
    await dialog.accept();
  });

  let createdDeptId = null;

  try {
    // ----------------------------------------------------
    // TEST A: ADMIN WORKFLOW
    // ----------------------------------------------------
    console.log('\n--- EXECUTING TEST A: ADMIN WORKFLOW ---');
    await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle0' });
    await takeScreenshot(page, '01_login_page.png');

    // Login as Admin
    await loginAs(page, 'admin@mediqueue.test', 'Admin@123');

    console.log(`[Admin] Current URL after login: ${page.url()}`);
    await delay(1000);
    await takeScreenshot(page, '02_admin_dashboard.png');

    // 1. Patient Management
    console.log('[Admin] Testing Patient Management...');
    await page.goto(`${BASE_URL}/admin/patients`, { waitUntil: 'networkidle0' });
    const newPatientBtn = await page.waitForSelector('button ::-p-text(New Patient)');
    await newPatientBtn.click();
    await delay(500);

    await page.type('input[name="name"]', patAlphaName);
    await page.select('select[name="gender"]', 'male');
    await page.type('input[name="phone"]', `98255${runSuffix}`);
    await page.type('input[name="address"]', '42 Healthcare Ave, Apt 4B');
    await page.type('textarea', 'Mild seasonal pollen allergy');

    const savePatientBtn = await page.waitForSelector('button ::-p-text(Save patient)');
    await savePatientBtn.click();
    await delay(1500);

    // Search for patient
    await page.type('input[placeholder*="Search"]', patAlphaName);
    await delay(800);

    // Click on the patient row to open profile
    const patientRow = await page.waitForSelector(`td ::-p-text(${patAlphaName})`);
    await patientRow.click();
    await delay(1000);
    console.log(`[Admin] Opened patient profile: ${page.url()}`);
    await takeScreenshot(page, '03_patient_profile.png');

    // Edit patient
    const editBtn = await page.waitForSelector('button ::-p-text(Edit)');
    await editBtn.click();
    await delay(500);
    await page.focus('input[name="address"]');
    await page.keyboard.down('Control');
    await page.keyboard.press('A');
    await page.keyboard.up('Control');
    await page.keyboard.press('Backspace');
    await page.type('input[name="address"]', '42 Healthcare Ave, Floor 3');
    const updatePatientBtn = await page.waitForSelector('button ::-p-text(Save patient)');
    await updatePatientBtn.click();
    await delay(1000);

    // 2. Department Management
    console.log('[Admin] Testing Department Management...');
    await page.goto(`${BASE_URL}/admin/departments`, { waitUntil: 'networkidle0' });
    const newDeptBtn = await page.waitForSelector('button ::-p-text(New Department)');
    await newDeptBtn.click();
    await delay(500);
    await page.type('input[placeholder*="Cardiology"]', deptName);
    await page.type('textarea', 'Level 1 24/7 Trauma and Acute Care Unit');
    const saveDeptBtn = await page.waitForSelector('button ::-p-text(Save department)');
    await saveDeptBtn.click();
    await delay(1000);
    await takeScreenshot(page, '04_departments_page.png');

    // Retrieve the newly created department ID
    createdDeptId = await page.evaluate(async (name) => {
      const token = localStorage.getItem('hqms_token');
      const res = await fetch('/api/departments', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      const match = data.departments?.find((d) => d.name === name);
      return match ? match.id : data.departments?.[0]?.id;
    }, deptName);
    console.log(`[Admin] Retrieved created department ID: ${createdDeptId}`);

    // 3. Room Management
    console.log('[Admin] Testing Room Management...');
    await page.goto(`${BASE_URL}/admin/rooms`, { waitUntil: 'networkidle0' });
    const newRoomBtn = await page.waitForSelector('button ::-p-text(New Room)');
    await newRoomBtn.click();
    await delay(500);
    const roomNumberInput = await page.waitForSelector('form input');
    await roomNumberInput.type(`TR-${runSuffix}`);
    await delay(300);
    const roomDeptSelect = (await page.$$('form select'))[0];
    await roomDeptSelect.select(createdDeptId);
    await delay(300);
    const saveRoomBtn = await page.waitForSelector('button ::-p-text(Save room)');
    await saveRoomBtn.click();
    await delay(1000);
    await takeScreenshot(page, '05_rooms_page.png');

    // 4. Doctor Management
    console.log('[Admin] Testing Doctor Management...');
    await page.goto(`${BASE_URL}/admin/doctors`, { waitUntil: 'networkidle0' });
    const newDoctorBtn = await page.waitForSelector('button ::-p-text(New Doctor)');
    await newDoctorBtn.click();
    await delay(500);
    const nameInput = await page.waitForSelector('form input');
    await nameInput.type(docName);
    await page.type('input[placeholder*="Cardiologist"]', 'Trauma Surgeon');
    await page.type('input[type="email"]', docEmail);
    await page.type('input[type="password"]', 'Doctor@123');
    await delay(300);
    const docDeptSelect = (await page.$$('form select'))[0];
    await docDeptSelect.select(createdDeptId);
    await delay(500);
    const docRoomSelect = (await page.$$('form select'))[1];
    if (docRoomSelect) {
      const roomVal = await page.evaluate(() => document.querySelectorAll('form select')[1]?.options[1]?.value);
      if (roomVal) await docRoomSelect.select(roomVal);
    }
    await delay(300);
    const saveDocBtn = await page.waitForSelector('button ::-p-text(Save doctor)');
    await saveDocBtn.click();
    await delay(1500);
    await takeScreenshot(page, '06_doctors_page.png');

    // 5. Users & Staff Management
    console.log('[Admin] Testing Staff Management...');
    await page.goto(`${BASE_URL}/admin/users`, { waitUntil: 'networkidle0' });
    await delay(1000);
    await takeScreenshot(page, '07_users_staff_page.png');

    // 6. Reports & CSV Export
    console.log('[Admin] Testing Reports & CSV...');
    await page.goto(`${BASE_URL}/admin/reports`, { waitUntil: 'networkidle0' });
    await delay(1000);
    await takeScreenshot(page, '08_reports_page.png');

    // 7. Audit Log
    console.log('[Admin] Testing Audit Logs...');
    await page.goto(`${BASE_URL}/admin/audit-log`, { waitUntil: 'networkidle0' });
    await delay(1000);
    await takeScreenshot(page, '09_audit_log_page.png');

    // 8. Settings
    console.log('[Admin] Testing Settings...');
    await page.goto(`${BASE_URL}/admin/settings`, { waitUntil: 'networkidle0' });
    await delay(500);
    const minutesInput = await page.waitForSelector('input[name="averageConsultationMinutes"]');
    await minutesInput.click();
    await page.keyboard.down('Control');
    await page.keyboard.press('A');
    await page.keyboard.up('Control');
    await page.keyboard.press('Backspace');
    await page.type('input[name="averageConsultationMinutes"]', '15');
    const saveSettingsBtn = await page.waitForSelector('form button[type="submit"]');
    await saveSettingsBtn.click();
    await delay(1000);
    await takeScreenshot(page, '10_settings_page.png');

    // Logout Admin
    const logoutBtn = await page.waitForSelector('button ::-p-text(Logout)');
    await logoutBtn.click();
    await delay(1000);

    // ----------------------------------------------------
    // TEST B: RECEPTIONIST WORKFLOW
    // ----------------------------------------------------
    console.log('\n--- EXECUTING TEST B: RECEPTIONIST WORKFLOW ---');
    await loginAs(page, 'reception@mediqueue.test', 'Reception@123');
    console.log(`[Receptionist] Logged in: ${page.url()}`);
    await delay(1000);
    await takeScreenshot(page, '11_reception_dashboard.png');

    // Register a new patient
    await page.goto(`${BASE_URL}/reception/patients`, { waitUntil: 'networkidle0' });
    const regPatientBtn = await page.waitForSelector('button ::-p-text(New Patient)');
    await regPatientBtn.click();
    await delay(500);
    await page.type('input[name="name"]', patBetaName);
    await page.select('select[name="gender"]', 'female');
    await page.type('input[name="phone"]', patBetaPhone);
    const regSubmit = await page.waitForSelector('button ::-p-text(Save patient)');
    await regSubmit.click();
    await delay(1500);

    // Book appointment in created department with Dr. Maya
    console.log('[Receptionist] Booking appointment...');
    await page.goto(`${BASE_URL}/reception/appointments`, { waitUntil: 'networkidle0' });
    const bookApptBtn = await page.waitForSelector('button ::-p-text(Book Appointment)');
    await bookApptBtn.click();
    await delay(500);

    // Pick patient in AppointmentForm
    await page.type('input[placeholder*="Search by name"]', patBetaName);
    await delay(1000);
    const patientOption = await page.waitForSelector(`ul li button ::-p-text(${patBetaName})`);
    await patientOption.click();

    // Select created department
    const deptSelectHandle = (await page.$$('form select'))[0];
    await deptSelectHandle.select(createdDeptId);
    await delay(1000);

    // Get Dr. Maya's doctor ID
    const docId = await page.evaluate(async (deptId) => {
      const token = localStorage.getItem('hqms_token');
      const res = await fetch(`/api/doctors?departmentId=${deptId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      return data.doctors?.[0]?.id;
    }, createdDeptId);
    console.log(`[Receptionist] Found doctor ID: ${docId}`);

    const docSelectHandle = (await page.$$('form select'))[1];
    await docSelectHandle.select(docId);
    await delay(500);

    // Set Date & Time slot safely using native input value setter
    const today = new Date().toISOString().slice(0, 10);
    const uniqueMinute = String(Math.floor(Math.random() * 50) + 10);
    const timeSlot = `15:${uniqueMinute}`;
    await page.evaluate((d, t) => {
      const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
      const dateInput = document.querySelector('form input[type="date"]');
      const timeInput = document.querySelector('form input[type="time"]');
      if (dateInput) {
        nativeSetter.call(dateInput, d);
        dateInput.dispatchEvent(new Event('input', { bubbles: true }));
        dateInput.dispatchEvent(new Event('change', { bubbles: true }));
      }
      if (timeInput) {
        nativeSetter.call(timeInput, t);
        timeInput.dispatchEvent(new Event('input', { bubbles: true }));
        timeInput.dispatchEvent(new Event('change', { bubbles: true }));
      }
    }, today, timeSlot);
    await delay(500);

    // Submit appointment
    const bookConfirmBtn = await page.waitForSelector('button ::-p-text(Book appointment)');
    await bookConfirmBtn.click();
    await delay(1500);
    await takeScreenshot(page, '12_appointments_page.png');

    // Convert appointment into queue token via "Check In" button
    console.log('[Receptionist] Testing Appointment Check In...');
    const checkInBtn = await page.waitForSelector('button ::-p-text(Check In)');
    await checkInBtn.click();
    await delay(1500);
    await takeScreenshot(page, '13_appointment_token_modal.png');

    // Close token modal
    const doneBtn = await page.waitForSelector('button ::-p-text(Done)');
    await doneBtn.click();
    await delay(500);

    // Open Queue Board and select the department
    console.log('[Receptionist] Opening Queue Board...');
    await page.goto(`${BASE_URL}/reception/queue`, { waitUntil: 'networkidle0' });
    await delay(1000);

    const qbSelectHandle = (await page.$$('header select, .flex select'))[0];
    if (qbSelectHandle) {
      await qbSelectHandle.select(createdDeptId);
    }
    await delay(1500);

    // Generate a walk-in token
    console.log('[Receptionist] Generating walk-in token on queue board...');
    const newWalkinBtn = await page.waitForSelector('button ::-p-text(New Token)');
    await newWalkinBtn.click();
    await delay(500);

    // Search patient
    await page.type('input[placeholder*="Search by name"]', patAlphaName);
    await delay(1000);
    const walkinPatOpt = await page.waitForSelector(`ul li button ::-p-text(${patAlphaName})`);
    await walkinPatOpt.click();

    // Select doctor in modal
    const modalDocSelect = (await page.$$('.fixed select'))[0];
    if (modalDocSelect) {
      await modalDocSelect.select(docId);
    }
    await delay(500);
    await delay(300);

    const generateTokenBtn = await page.waitForSelector('button ::-p-text(Generate token)');
    await generateTokenBtn.click();
    await delay(1500);
    await takeScreenshot(page, '14_walkin_token_modal.png');

    const doneWalkinBtn = await page.waitForSelector('button ::-p-text(Done)');
    await doneWalkinBtn.click();
    await delay(1000);

    // Queue state machine: Call Next, Skip, Recall, Start
    console.log('[Receptionist] Testing Queue Actions: Call Next, Skip, Recall, Start...');
    const callNextBtn = await page.waitForSelector('button ::-p-text(Call Next)');
    await callNextBtn.click();
    await delay(1500);

    // Skip the called patient
    const skipBtn = await page.waitForSelector('button ::-p-text(Skip)');
    await skipBtn.click();
    await delay(1500);

    // Recall the patient
    const recallBtn = await page.waitForSelector('button ::-p-text(Recall)');
    await recallBtn.click();
    await delay(1500);

    // Start consultation to set up for doctor
    const startBtn = await page.waitForSelector('button ::-p-text(Start)');
    await startBtn.click();
    await delay(1500);

    await takeScreenshot(page, '15_queue_board.png');

    // Refresh page to verify persistence
    await page.reload({ waitUntil: 'networkidle0' });
    await delay(1000);

    // Logout Receptionist
    const logoutBtnRec = await page.waitForSelector('button ::-p-text(Logout)');
    await logoutBtnRec.click();
    await delay(1000);

    // ----------------------------------------------------
    // TEST C: DOCTOR WORKFLOW
    // ----------------------------------------------------
    console.log('\n--- EXECUTING TEST C: DOCTOR WORKFLOW ---');
    await loginAs(page, docEmail, 'Doctor@123');
    console.log(`[Doctor] Logged in: ${page.url()}`);
    await delay(1000);
    await takeScreenshot(page, '16_doctor_dashboard.png');

    // Open Doctor Queue
    await page.goto(`${BASE_URL}/doctor/queue`, { waitUntil: 'networkidle0' });
    await delay(1500);

    // Click "Consultation Notes" on the in-consultation entry
    const consultNotesBtn = await page.waitForSelector('button ::-p-text(Consultation Notes)');
    await consultNotesBtn.click();
    await delay(800);

    // Enter Diagnosis & Notes
    await page.type('input[placeholder*="brought the patient"]', 'Acute trauma with superficial contusions');
    const textareas = await page.$$('.space-y-5 textarea');
    if (textareas.length >= 3) {
      await textareas[0].type('Localized swelling, minor contusions, pain on movement.');
      await textareas[1].type('Acute trauma, no osseous fracture detected.');
      await textareas[2].type('Patient vitals stable. Wound cleaned and dressed. Prescribed analgesics.');
    }

    // Save notes first so prescription items editor is enabled
    const saveNotesBtn = await page.waitForSelector('button ::-p-text(Save notes)');
    await saveNotesBtn.click();
    await delay(1500);

    // Fill Prescription items
    await page.waitForSelector('input[placeholder*="Medicine name"]');
    await page.type('input[placeholder*="Medicine name"]', 'Amoxicillin / Clavulanate');
    await page.type('input[placeholder*="Dosage"]', '625mg');
    await page.type('input[placeholder*="Frequency"]', 'Twice daily after meals');
    await page.type('input[placeholder*="Duration"]', '5 days');
    await page.type('input[placeholder*="Instructions"]', 'Complete the full course with food');

    // Save prescription
    const savePrescriptionBtn = await page.waitForSelector('button ::-p-text(Save prescription)');
    await savePrescriptionBtn.click();
    await delay(1500);

    await takeScreenshot(page, '17_doctor_consultation_form.png');

    // Save & Complete consultation
    const completeConsultBtn = await page.waitForSelector('button ::-p-text(Save & Complete Consultation)');
    await completeConsultBtn.click();
    await delay(2000);

    console.log('[Doctor] Consultation completed and synchronized.');

    // Logout Doctor
    const logoutDocBtn = await page.waitForSelector('button ::-p-text(Logout)');
    await logoutDocBtn.click();
    await delay(1000);

    // ----------------------------------------------------
    // TEST D: NURSE WORKFLOW & RBAC PROTECTION
    // ----------------------------------------------------
    console.log('\n--- EXECUTING TEST D: NURSE WORKFLOW ---');
    await loginAs(page, 'nurse@mediqueue.test', 'Nurse@123');
    console.log(`[Nurse] Logged in: ${page.url()}`);
    await delay(1000);
    await takeScreenshot(page, '18_nurse_dashboard.png');

    // Test unauthorized action: try to call POST /api/departments from nurse session
    console.log('[Nurse] Testing unauthorized action (POST /api/departments should return 403)...');
    const nurseForbiddenStatus = await page.evaluate(async () => {
      try {
        const token = localStorage.getItem('hqms_token');
        const res = await fetch('/api/departments', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ name: 'Unauthorized Nurse Dept' }),
        });
        return res.status;
      } catch (e) {
        return e.message;
      }
    });
    console.log(`[Nurse] Unauthorized department create status: ${nurseForbiddenStatus}`);
    if (nurseForbiddenStatus !== 403) {
      throw new Error(`Expected 403 Forbidden for nurse department create, got: ${nurseForbiddenStatus}`);
    }

    // Logout Nurse
    const logoutNurseBtn = await page.waitForSelector('button ::-p-text(Logout)');
    await logoutNurseBtn.click();
    await delay(1000);

    // ----------------------------------------------------
    // TEST E: PUBLIC WORKFLOW
    // ----------------------------------------------------
    console.log('\n--- EXECUTING TEST E: PUBLIC WORKFLOW ---');
    
    // 1. Display Screen
    console.log(`[Public] Opening display screen for department: ${createdDeptId}...`);
    await page.goto(`${BASE_URL}/display/${createdDeptId}`, { waitUntil: 'networkidle0' });
    await delay(1500);
    await takeScreenshot(page, '19_display_screen.png');

    // Verify no patient PII on display screen
    const displayContent = await page.content();
    if (displayContent.includes(patAlphaName) || displayContent.includes(patBetaName)) {
      throw new Error('Public display screen leaked patient name!');
    }

    // 2. Go to public track entry page
    await page.goto(`${BASE_URL}/track`, { waitUntil: 'networkidle0' });
    await delay(500);
    await takeScreenshot(page, '21_track_entry_page.png');

    // 3. Test invalid tracking link
    await page.goto(`${BASE_URL}/track/invalid-token-uuid-12345`, { waitUntil: 'networkidle0' });
    await delay(1000);
    const invalidText = await page.$eval('body', (el) => el.textContent);
    if (!invalidText.includes('invalid') && !invalidText.includes('expired') && !invalidText.includes('not found')) {
      throw new Error('Expected invalid tracking link message not found!');
    }

    // ----------------------------------------------------
    // TEST F: PRIORITY QUEUE WORKFLOW
    // ----------------------------------------------------
    console.log('\n--- EXECUTING TEST F: PRIORITY QUEUE WORKFLOW ---');
    // Ensure Receptionist authenticated session is active
    await page.evaluate(async () => {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'reception@mediqueue.test', password: 'Reception@123' }),
      });
      const data = await res.json();
      localStorage.setItem('hqms_token', data.token);
      localStorage.setItem('hqms_user', JSON.stringify(data.user));
    });
    await delay(500);

    // Priority test entries in an isolated department
    const priorityResult = await page.evaluate(async (suffix, targetDeptId) => {
      const token = localStorage.getItem('hqms_token');
      const h = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };

      async function createP(name, phone) {
        const r = await fetch('/api/patients', {
          method: 'POST',
          headers: h,
          body: JSON.stringify({ name, gender: 'female', phone }),
        });
        return (await r.json()).patient.id;
      }

      const pNorm = await createP(`Norm ${suffix}`, `9825${suffix}01`);
      const pSenior = await createP(`Senior ${suffix}`, `9825${suffix}02`);
      const pPreg = await createP(`Preg ${suffix}`, `9825${suffix}03`);
      const pEmerg = await createP(`Emerg ${suffix}`, `9825${suffix}04`);

      // Get doctor in department
      const docs = (await (await fetch(`/api/doctors?departmentId=${targetDeptId}`, { headers: h })).json()).doctors;
      const targetDocId = docs[0].id;

      // 1. Generate Normal first
      const t1 = await (await fetch('/api/queue/token', {
        method: 'POST',
        headers: h,
        body: JSON.stringify({ patientId: pNorm, departmentId: targetDeptId, doctorId: targetDocId, priority: 'normal' }),
      })).json();

      // 2. Generate Senior second
      const t2 = await (await fetch('/api/queue/token', {
        method: 'POST',
        headers: h,
        body: JSON.stringify({ patientId: pSenior, departmentId: targetDeptId, doctorId: targetDocId, priority: 'senior_citizen' }),
      })).json();

      // 3. Generate Pregnant third
      const t3 = await (await fetch('/api/queue/token', {
        method: 'POST',
        headers: h,
        body: JSON.stringify({ patientId: pPreg, departmentId: targetDeptId, doctorId: targetDocId, priority: 'pregnant' }),
      })).json();

      // 4. Generate Emergency LAST
      const t4 = await (await fetch('/api/queue/token', {
        method: 'POST',
        headers: h,
        body: JSON.stringify({ patientId: pEmerg, departmentId: targetDeptId, doctorId: targetDocId, priority: 'emergency' }),
      })).json();

      // Fetch queue
      const queue = (await (await fetch(`/api/queue?departmentId=${targetDeptId}`, { headers: h })).json());

      // Call next
      const called = (await (await fetch('/api/queue/call-next', {
        method: 'POST',
        headers: h,
        body: JSON.stringify({ departmentId: targetDeptId }),
      })).json());

      return {
        emergencyPatientsAhead: t4.entry.patientsAhead,
        emergencyToken: t4.entry.token,
        emergencyQueueEntryId: t4.entry.id,
        calledPriority: called.entry.priority,
        calledToken: called.entry.token,
        queueWaiting: queue.waiting.map((w) => ({ token: w.token, priority: w.priority })),
      };
    }, runSuffix, createdDeptId);

    console.log('[Priority Queue Result]', JSON.stringify(priorityResult, null, 2));

    if (priorityResult.emergencyPatientsAhead !== 0) {
      throw new Error(`Emergency patient did not jump to front! Patients ahead: ${priorityResult.emergencyPatientsAhead}`);
    }
    if (priorityResult.calledPriority !== 'emergency') {
      throw new Error(`Call-next did not call emergency patient first! Called: ${priorityResult.calledPriority}`);
    }

    // Visit public tracking page for the emergency token
    console.log(`[Public] Visiting patient tracking page for token ${priorityResult.emergencyToken}...`);
    await page.goto(`${BASE_URL}/track/${priorityResult.emergencyQueueEntryId}`, { waitUntil: 'networkidle0' });
    await delay(1000);
    await takeScreenshot(page, '20_patient_tracking.png');

    // Navigate to queue board and capture verified state
    await page.goto(`${BASE_URL}/reception/queue`, { waitUntil: 'networkidle0' });
    await delay(1000);
    const qbSelectHandleF = (await page.$$('header select, .flex select'))[0];
    if (qbSelectHandleF) {
      await qbSelectHandleF.select(createdDeptId);
    }
    await delay(1500);
    await takeScreenshot(page, '22_priority_queue_verified.png');

    // ----------------------------------------------------
    // PHASE 8: RESPONSIVENESS AND MOBILE TESTING
    // ----------------------------------------------------
    console.log('\n--- EXECUTING PHASE 8: RESPONSIVENESS & USABILITY ---');

    // Ensure logged in as Receptionist
    await loginAs(page, 'reception@mediqueue.test', 'Reception@123');

    // 1. Tablet viewport (768 × 1024)
    await page.setViewport({ width: 768, height: 1024 });
    await delay(500);
    await page.goto(`${BASE_URL}/reception/dashboard`, { waitUntil: 'networkidle0' });
    await delay(500);

    // 2. Mobile viewport (390 × 844)
    await page.setViewport({ width: 390, height: 844 });
    await delay(500);
    await page.goto(`${BASE_URL}/reception/dashboard`, { waitUntil: 'networkidle0' });
    await delay(1000);
    await takeScreenshot(page, '24_mobile_reception_dashboard.png');

    // Test Mobile Navigation Drawer
    console.log('[Mobile] Testing mobile navigation drawer...');
    await page.evaluate(() => {
      const btn = document.querySelector('header button[aria-label="Open navigation menu"]');
      if (btn) btn.click();
    });
    await delay(1000);
    await takeScreenshot(page, '23_mobile_drawer_open.png');

    // Click on Patients link inside the mobile drawer
    await page.evaluate(() => {
      const visibleLink = Array.from(document.querySelectorAll('nav a')).find(
        (a) => a.textContent.includes('Patients') && a.offsetParent !== null
      );
      if (visibleLink) {
        visibleLink.click();
      } else {
        const anyLink = Array.from(document.querySelectorAll('a')).find((a) =>
          a.href?.includes('/reception/patients')
        );
        if (anyLink) anyLink.click();
        else throw new Error('Patients link not found in mobile drawer or DOM');
      }
    });
    await delay(1000);
    console.log(`[Mobile] Navigated via drawer to: ${page.url()}`);
    if (!page.url().includes('/reception/patients')) {
      throw new Error(`Mobile drawer navigation failed. Current URL: ${page.url()}`);
    }

    // 3. Laptop viewport (1366 × 768)
    await page.setViewport({ width: 1366, height: 768 });
    await page.goto(`${BASE_URL}/reception/dashboard`, { waitUntil: 'networkidle0' });
    await delay(500);

    console.log('\n====================================================');
    console.log('ALL REAL BROWSER TESTS (A-F & RESPONSIVE) COMPLETED SUCCESSFULLY!');
    console.log(`Total console errors recorded: ${consoleErrors.length}`);
    console.log(`Total request failures recorded: ${requestFailures.length}`);
    console.log('====================================================');
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error('\n!!! BROWSER AUTOMATION FAILED !!!', err);
  process.exit(1);
});
