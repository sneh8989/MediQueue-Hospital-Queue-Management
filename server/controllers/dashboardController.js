import { getDB } from '../config/db.js';
import { asyncHandler } from '../middleware/errorHandler.js';

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function isToday(isoTimestamp, date) {
  return isoTimestamp && isoTimestamp.slice(0, 10) === date;
}

function average(numbers) {
  if (numbers.length === 0) return 0;
  return Math.round(numbers.reduce((sum, n) => sum + n, 0) / numbers.length);
}

function minutesBetween(startISO, endISO) {
  return (new Date(endISO).getTime() - new Date(startISO).getTime()) / 60000;
}

/**
 * GET /api/dashboard/summary - a single aggregating endpoint for the admin
 * dashboard, rather than the client firing N parallel per-department
 * queue calls. Chosen because some of the stats (average wait time,
 * patients-by-hour, doctor workload) need to scan every queue entry for
 * the day regardless of department, which is naturally a server-side
 * computation - see docs/ARCHITECTURE.md for the reasoning.
 */
export const getDashboardSummary = asyncHandler(async (req, res) => {
  const db = getDB();
  const date = req.query.date || todayISO();

  const patientsToday = db.data.patients.filter((p) => isToday(p.createdAt, date));
  const appointmentsToday = db.data.appointments.filter((a) => a.date === date);
  const queueEntriesToday = db.data.queueEntries.filter((e) => e.date === date);

  const waiting = queueEntriesToday.filter((e) => e.status === 'waiting');
  const inConsultation = queueEntriesToday.filter((e) => e.status === 'in_consultation');
  const completed = queueEntriesToday.filter((e) => e.status === 'completed');
  const emergency = queueEntriesToday.filter((e) => e.queueType === 'emergency');

  // Average waiting time: time from token creation to being called, for
  // every entry today that has actually been called.
  const waitTimes = queueEntriesToday
    .filter((e) => e.calledAt)
    .map((e) => minutesBetween(e.createdAt, e.calledAt));
  const averageWaitingMinutes = average(waitTimes);

  // Average consultation time: time from start to completion.
  const consultationTimes = completed
    .filter((e) => e.startedAt && e.completedAt)
    .map((e) => minutesBetween(e.startedAt, e.completedAt));
  const averageConsultationMinutes = average(consultationTimes);

  // Patients by department (today's queue entries, any status).
  const byDepartment = {};
  for (const entry of queueEntriesToday) {
    const dept = db.data.departments.find((d) => d.id === entry.departmentId);
    const name = dept?.name || 'Unknown';
    byDepartment[name] = (byDepartment[name] || 0) + 1;
  }
  const patientsByDepartment = Object.entries(byDepartment).map(([department, count]) => ({ department, count }));

  // Patients by hour of day (based on token creation time).
  const byHour = {};
  for (const entry of queueEntriesToday) {
    const hour = new Date(entry.createdAt).getHours();
    byHour[hour] = (byHour[hour] || 0) + 1;
  }
  const patientsByHour = Array.from({ length: 24 }, (_, hour) => ({ hour, count: byHour[hour] || 0 })).filter(
    (h) => h.count > 0
  );

  // Appointment status breakdown for today.
  const appointmentStatusCounts = {};
  for (const appt of appointmentsToday) {
    appointmentStatusCounts[appt.status] = (appointmentStatusCounts[appt.status] || 0) + 1;
  }
  const appointmentsByStatus = Object.entries(appointmentStatusCounts).map(([status, count]) => ({ status, count }));

  // Queue status breakdown for today.
  const queueStatusCounts = {};
  for (const entry of queueEntriesToday) {
    queueStatusCounts[entry.status] = (queueStatusCounts[entry.status] || 0) + 1;
  }
  const queueByStatus = Object.entries(queueStatusCounts).map(([status, count]) => ({ status, count }));

  // Doctor workload: completed consultations today, per doctor.
  const workload = {};
  for (const entry of completed) {
    const doctor = db.data.doctors.find((d) => d.id === entry.doctorId);
    const name = doctor?.name || 'Unknown';
    workload[name] = (workload[name] || 0) + 1;
  }
  const doctorWorkload = Object.entries(workload)
    .map(([doctor, count]) => ({ doctor, count }))
    .sort((a, b) => b.count - a.count);

  res.json({
    success: true,
    date,
    stats: {
      totalPatientsToday: patientsToday.length,
      totalAppointmentsToday: appointmentsToday.length,
      waitingPatients: waiting.length,
      patientsInConsultation: inConsultation.length,
      completedConsultations: completed.length,
      emergencyPatients: emergency.length,
      averageWaitingMinutes,
      averageConsultationMinutes,
    },
    charts: {
      patientsByDepartment,
      patientsByHour,
      appointmentsByStatus,
      queueByStatus,
      doctorWorkload,
    },
  });
});
