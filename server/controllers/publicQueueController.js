import * as queueEntryModel from '../models/queueEntryModel.js';
import * as doctorModel from '../models/doctorModel.js';
import * as departmentModel from '../models/departmentModel.js';
import * as roomModel from '../models/roomModel.js';
import { getDB } from '../config/db.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import AppError from '../utils/AppError.js';

/**
 * PUBLIC QUEUE ENDPOINTS
 * ----------------------
 * These are intentionally unauthenticated, because they power:
 *  - the hospital TV display screen (runs unattended, no one logs in), and
 *  - the patient-facing tracking page reached by scanning a QR code / token
 *    link, which a patient opens on their own phone without an account.
 *
 * Per the master spec (section 13: "Do not expose sensitive patient
 * information in the QR URL" / "Use a secure queue/token identifier"):
 *  - The only identifier ever placed in a URL is the queue entry's opaque
 *    UUID (`id`) - never a patient ID, name, or phone number.
 *  - The JSON these endpoints return is deliberately a *reduced projection*:
 *    no patientName, patientCode, or patientPhone are included anywhere in
 *    this file, even though the authenticated `/api/queue` endpoints do
 *    include them for staff. A patient scanning their own QR code only
 *    needs to see their token, status, and wait time - not confirmation of
 *    who they are, and definitely nothing about any other patient.
 *  - The display screen additionally never reveals which specific queue
 *    entry belongs to which token beyond the token string itself - tokens
 *    are not personally identifying on their own.
 */

async function getAvgConsultationMinutes(doctorId) {
  const doctor = await doctorModel.findById(doctorId);
  if (doctor?.avgConsultationMinutes) return doctor.avgConsultationMinutes;
  const db = getDB();
  return db.data.hospitalSettings.averageConsultationMinutes || 5;
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

/**
 * GET /api/public/queue/:id - for the patient tracking page. Returns only
 * non-identifying queue/appointment info for a single entry.
 */
export const getPublicQueueEntry = asyncHandler(async (req, res) => {
  const entry = await queueEntryModel.findById(req.params.id);
  if (!entry) throw new AppError('Queue entry not found', 404);

  const doctor = await doctorModel.findById(entry.doctorId);
  const department = await departmentModel.findById(entry.departmentId);
  const room = doctor?.roomId ? await roomModel.findById(doctor.roomId) : null;
  const patientsAhead = await queueEntryModel.getPatientsAhead(entry);
  const avgMinutes = await getAvgConsultationMinutes(entry.doctorId);

  // "Now serving" for this entry's department, so the patient can see how
  // close the current token is to their own, without seeing anyone else's info.
  const nowServing = await queueEntryModel.findAll({
    departmentId: entry.departmentId,
    status: 'called',
    date: entry.date,
  });
  const inProgress = await queueEntryModel.findAll({
    departmentId: entry.departmentId,
    status: 'in_consultation',
    date: entry.date,
  });
  const currentToken = nowServing[0]?.token || inProgress[0]?.token || null;

  res.json({
    success: true,
    entry: {
      token: entry.token,
      status: entry.status,
      priority: entry.priority,
      date: entry.date,
      doctorName: doctor?.name || null,
      departmentName: department?.name || null,
      roomNumber: room?.number || null,
      patientsAhead,
      estimatedWaitMinutes: patientsAhead !== null ? patientsAhead * avgMinutes : null,
      currentToken,
    },
  });
});

/**
 * GET /api/public/queue?departmentId= - for the hospital TV display
 * screen. Shows current/next token, doctor, room, and waiting count for a
 * department - no patient-identifying information at all.
 */
export const getPublicQueueBoard = asyncHandler(async (req, res) => {
  const { departmentId } = req.query;
  if (!departmentId) throw new AppError('departmentId is required', 400);

  const department = await departmentModel.findById(departmentId);
  if (!department) throw new AppError('Department not found', 404);

  const date = todayISO();
  const [waiting, called, inConsultation] = await Promise.all([
    queueEntryModel.getOrderedWaitingQueue(departmentId, date),
    queueEntryModel.findAll({ departmentId, status: 'called', date }),
    queueEntryModel.findAll({ departmentId, status: 'in_consultation', date }),
  ]);

  // "Current token" is whichever is actively being called or seen; "next"
  // is the next one waiting in priority order.
  const current = called[0] || inConsultation[0] || null;
  const next = waiting[0] || null;

  async function annotate(entry) {
    if (!entry) return null;
    const doctor = await doctorModel.findById(entry.doctorId);
    const room = doctor?.roomId ? await roomModel.findById(doctor.roomId) : null;
    return {
      token: entry.token,
      doctorName: doctor?.name || null,
      roomNumber: room?.number || null,
    };
  }

  res.json({
    success: true,
    departmentName: department.name,
    currentToken: await annotate(current),
    nextToken: await annotate(next),
    waitingCount: waiting.length,
  });
});
