import { getDB } from '../config/db.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import AppError from '../utils/AppError.js';

/**
 * REPORTS
 * -------
 * One flexible endpoint (GET /api/reports/:type) rather than 8 bespoke
 * routes, since every report the spec asks for is really a different
 * filtered/grouped view over data that already has full CRUD APIs
 * (patients, appointments, queueEntries). Each report function returns a
 * uniform { columns, rows } shape so the client can render ANY report
 * through one generic table component and build CSV export generically
 * too, rather than needing bespoke UI per report type. See
 * docs/ARCHITECTURE.md "Reports architecture" for the full reasoning.
 */

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function minutesBetween(startISO, endISO) {
  return Math.round((new Date(endISO).getTime() - new Date(startISO).getTime()) / 60000);
}

function lookup(collection, id) {
  return collection.find((r) => r.id === id) || null;
}

// ---------- Individual report builders ----------
// Each takes (db, filters) and returns { columns, rows }.

function dailyPatientReport(db, { date }) {
  const patients = db.data.patients.filter((p) => p.createdAt.slice(0, 10) === date);
  return {
    columns: ['Patient Code', 'Name', 'Gender', 'Phone', 'Registered At'],
    rows: patients.map((p) => [p.patientCode, p.name, p.gender, p.phone, p.createdAt]),
  };
}

function departmentReport(db, { date, departmentId }) {
  let departments = db.data.departments;
  if (departmentId) departments = departments.filter((d) => d.id === departmentId);

  const rows = departments.map((dept) => {
    const entries = db.data.queueEntries.filter((e) => e.departmentId === dept.id && e.date === date);
    const completed = entries.filter((e) => e.status === 'completed').length;
    const waiting = entries.filter((e) => e.status === 'waiting').length;
    const emergency = entries.filter((e) => e.queueType === 'emergency').length;
    return [dept.name, entries.length, completed, waiting, emergency];
  });

  return { columns: ['Department', 'Total Patients', 'Completed', 'Waiting', 'Emergency'], rows };
}

function doctorPerformanceReport(db, { date, doctorId }) {
  let doctors = db.data.doctors;
  if (doctorId) doctors = doctors.filter((d) => d.id === doctorId);

  const rows = doctors.map((doc) => {
    const entries = db.data.queueEntries.filter((e) => e.doctorId === doc.id && e.date === date);
    const completed = entries.filter((e) => e.status === 'completed' && e.startedAt && e.completedAt);
    const avgMinutes = completed.length
      ? Math.round(completed.reduce((sum, e) => sum + minutesBetween(e.startedAt, e.completedAt), 0) / completed.length)
      : 0;
    return [doc.name, entries.length, completed.length, `${avgMinutes} min`];
  });

  return { columns: ['Doctor', 'Total Patients', 'Completed', 'Avg. Consultation Time'], rows };
}

function waitingTimeReport(db, { date, departmentId, doctorId }) {
  let entries = db.data.queueEntries.filter((e) => e.date === date && e.calledAt);
  if (departmentId) entries = entries.filter((e) => e.departmentId === departmentId);
  if (doctorId) entries = entries.filter((e) => e.doctorId === doctorId);

  const rows = entries.map((e) => {
    const doctor = lookup(db.data.doctors, e.doctorId);
    const waitMinutes = minutesBetween(e.createdAt, e.calledAt);
    return [e.token, doctor?.name || '—', e.priority, `${waitMinutes} min`];
  });

  return { columns: ['Token', 'Doctor', 'Priority', 'Waiting Time'], rows };
}

function appointmentReport(db, { date, departmentId, doctorId, status }) {
  let appts = db.data.appointments.filter((a) => a.date === date);
  if (departmentId) appts = appts.filter((a) => a.departmentId === departmentId);
  if (doctorId) appts = appts.filter((a) => a.doctorId === doctorId);
  if (status) appts = appts.filter((a) => a.status === status);

  const rows = appts.map((a) => {
    const patient = lookup(db.data.patients, a.patientId);
    const doctor = lookup(db.data.doctors, a.doctorId);
    return [a.timeSlot, patient?.name || '—', doctor?.name || '—', a.status];
  });

  return { columns: ['Time', 'Patient', 'Doctor', 'Status'], rows };
}

function queuePerformanceReport(db, { date, departmentId }) {
  let departments = db.data.departments;
  if (departmentId) departments = departments.filter((d) => d.id === departmentId);

  const rows = departments.map((dept) => {
    const entries = db.data.queueEntries.filter((e) => e.departmentId === dept.id && e.date === date);
    const completed = entries.filter((e) => e.status === 'completed').length;
    const cancelled = entries.filter((e) => e.status === 'cancelled' || e.status === 'no_show').length;
    const completionRate = entries.length ? Math.round((completed / entries.length) * 100) : 0;
    return [dept.name, entries.length, completed, cancelled, `${completionRate}%`];
  });

  return { columns: ['Department', 'Total Tokens', 'Completed', 'Cancelled/No-show', 'Completion Rate'], rows };
}

function emergencyReport(db, { date, departmentId }) {
  let entries = db.data.queueEntries.filter((e) => e.date === date && e.queueType === 'emergency');
  if (departmentId) entries = entries.filter((e) => e.departmentId === departmentId);

  const rows = entries.map((e) => {
    const patient = lookup(db.data.patients, e.patientId);
    const doctor = lookup(db.data.doctors, e.doctorId);
    const waitMinutes = e.calledAt ? minutesBetween(e.createdAt, e.calledAt) : null;
    return [e.token, patient?.name || '—', doctor?.name || '—', e.status, waitMinutes !== null ? `${waitMinutes} min` : '—'];
  });

  return { columns: ['Token', 'Patient', 'Doctor', 'Status', 'Waiting Time'], rows };
}

function noShowReport(db, { date, departmentId, doctorId }) {
  let appts = db.data.appointments.filter((a) => a.date === date && a.status === 'no_show');
  if (departmentId) appts = appts.filter((a) => a.departmentId === departmentId);
  if (doctorId) appts = appts.filter((a) => a.doctorId === doctorId);

  const rows = appts.map((a) => {
    const patient = lookup(db.data.patients, a.patientId);
    const doctor = lookup(db.data.doctors, a.doctorId);
    return [a.timeSlot, patient?.name || '—', patient?.phone || '—', doctor?.name || '—'];
  });

  return { columns: ['Scheduled Time', 'Patient', 'Phone', 'Doctor'], rows };
}

const REPORT_BUILDERS = {
  'daily-patient': dailyPatientReport,
  department: departmentReport,
  'doctor-performance': doctorPerformanceReport,
  'waiting-time': waitingTimeReport,
  appointment: appointmentReport,
  'queue-performance': queuePerformanceReport,
  emergency: emergencyReport,
  'no-show': noShowReport,
};

export const REPORT_TYPES = Object.keys(REPORT_BUILDERS);

export const getReport = asyncHandler(async (req, res) => {
  const { type } = req.params;
  const builder = REPORT_BUILDERS[type];
  if (!builder) {
    throw new AppError(`Unknown report type "${type}". Valid types: ${REPORT_TYPES.join(', ')}`, 400);
  }

  const db = getDB();
  const filters = {
    date: req.query.date || todayISO(),
    departmentId: req.query.departmentId || null,
    doctorId: req.query.doctorId || null,
    status: req.query.status || null,
  };

  const { columns, rows } = builder(db, filters);

  res.json({ success: true, reportType: type, filters, columns, rows, count: rows.length });
});

export const listReportTypes = asyncHandler(async (req, res) => {
  res.json({
    success: true,
    reportTypes: [
      { key: 'daily-patient', label: 'Daily Patient Report' },
      { key: 'department', label: 'Department Report' },
      { key: 'doctor-performance', label: 'Doctor Performance Report' },
      { key: 'waiting-time', label: 'Waiting Time Report' },
      { key: 'appointment', label: 'Appointment Report' },
      { key: 'queue-performance', label: 'Queue Performance Report' },
      { key: 'emergency', label: 'Emergency Patient Report' },
      { key: 'no-show', label: 'No-Show Report' },
    ],
  });
});
