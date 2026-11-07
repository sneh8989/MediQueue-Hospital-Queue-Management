import { getDB } from '../config/db.js';
import * as queueEntryModel from '../models/queueEntryModel.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import AppError from '../utils/AppError.js';

const APPOINTMENT_STATUSES = ['scheduled', 'confirmed', 'waiting', 'in_consultation', 'completed', 'cancelled', 'no_show'];
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function countBy(list, predicate) {
  return list.filter(predicate).length;
}

/**
 * GET /api/dashboard/operations - a live, front-line snapshot of the day
 * for the roles that run the queue but aren't admins (receptionist, nurse).
 *
 * This is a SEPARATE endpoint from GET /api/dashboard/summary on purpose:
 * that one is admin-only (and pinned to admin-only by tests) because it
 * carries analytics - averages, hourly charts, per-doctor workload. Front-
 * line staff don't need analytics; they need "what is happening right now,
 * and where do I need to look?". So this returns only live counts and, per
 * department, who is next and how long the longest-waiting patient has
 * been waiting. It contains no patient names or contact details.
 *
 * Departments are limited to those that have an active doctor or any queue
 * activity on the requested date - the seed hospital has 20+ departments
 * and listing empty ones would bury the busy ones. Ordering puts
 * emergencies first, then the longest queues, so the top of the list is
 * always where attention is needed.
 */
export const getOperationsSummary = asyncHandler(async (req, res) => {
  const date = req.query.date || todayISO();
  if (!DATE_PATTERN.test(date)) {
    throw new AppError('date must be in YYYY-MM-DD format', 400);
  }
  const isToday = date === todayISO();

  const db = getDB();
  const entries = db.data.queueEntries.filter((e) => e.date === date);
  const appointments = db.data.appointments.filter((a) => a.date === date);

  const isEmergencyWaiting = (e) => e.status === 'waiting' && e.priority === 'emergency';

  const totals = {
    waiting: countBy(entries, (e) => e.status === 'waiting'),
    called: countBy(entries, (e) => e.status === 'called'),
    inConsultation: countBy(entries, (e) => e.status === 'in_consultation'),
    completed: countBy(entries, (e) => e.status === 'completed'),
    skipped: countBy(entries, (e) => e.status === 'skipped'),
    emergencyWaiting: countBy(entries, isEmergencyWaiting),
  };

  // Every status is present (zero-filled) so the client never has to guard
  // against a missing key.
  const byStatus = Object.fromEntries(APPOINTMENT_STATUSES.map((s) => [s, 0]));
  for (const appt of appointments) {
    if (byStatus[appt.status] !== undefined) byStatus[appt.status] += 1;
  }

  const now = Date.now();
  const departments = [];

  for (const dept of db.data.departments.filter((d) => d.isActive)) {
    const deptEntries = entries.filter((e) => e.departmentId === dept.id);
    const activeDoctors = countBy(db.data.doctors, (d) => d.isActive && d.departmentId === dept.id);
    if (activeDoctors === 0 && deptEntries.length === 0) continue;

    // Same priority-aware ordering the queue board uses - so "next token"
    // here always matches who "Call next" would actually call.
    const ordered = await queueEntryModel.getOrderedWaitingQueue(dept.id, date);

    let longestWaitMinutes = null;
    if (isToday && ordered.length > 0) {
      const oldest = Math.min(...ordered.map((e) => new Date(e.createdAt).getTime()));
      longestWaitMinutes = Math.max(0, Math.round((now - oldest) / 60000));
    }

    departments.push({
      departmentId: dept.id,
      departmentName: dept.name,
      activeDoctors,
      waiting: ordered.length,
      called: countBy(deptEntries, (e) => e.status === 'called'),
      inConsultation: countBy(deptEntries, (e) => e.status === 'in_consultation'),
      completed: countBy(deptEntries, (e) => e.status === 'completed'),
      skipped: countBy(deptEntries, (e) => e.status === 'skipped'),
      emergencyWaiting: countBy(deptEntries, isEmergencyWaiting),
      nextToken: ordered[0]?.token ?? null,
      longestWaitMinutes,
    });
  }

  departments.sort(
    (a, b) =>
      b.emergencyWaiting - a.emergencyWaiting ||
      b.waiting - a.waiting ||
      a.departmentName.localeCompare(b.departmentName)
  );

  res.json({
    success: true,
    date,
    totals,
    appointments: { total: appointments.length, byStatus },
    departments,
  });
});
