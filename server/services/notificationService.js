import * as notificationModel from '../models/notificationModel.js';
import * as doctorModel from '../models/doctorModel.js';

/**
 * Thin wrappers around notificationModel.create(), one per event type the
 * spec lists (section 23), so the calling controller doesn't need to know
 * who the recipient should be - it just says "this thing happened."
 *
 * DESIGN DECISION: every notification here targets the assigned DOCTOR's
 * user account. Patients have no login (see notificationModel.js), so
 * they can't receive in-app notifications at all - the patient-facing
 * equivalent of "your appointment was confirmed" is the live /track page
 * from Phase 7, not a notification inbox. Reception/admin could
 * reasonably also want some of these, but scoping to "the doctor whose
 * queue/appointment this affects" is the one recipient every event type
 * unambiguously has, so that's what's implemented. Broadening to other
 * roles is a natural extension if a concrete need shows up later.
 *
 * Failures here are swallowed (not thrown) - a missing doctor/user link
 * should never block the actual appointment/queue/consultation action
 * that triggered the notification attempt.
 */

async function notifyDoctor(doctorId, type, message) {
  try {
    if (!doctorId) return;
    const doctor = await doctorModel.findById(doctorId);
    if (!doctor?.userId) return;
    await notificationModel.create({ userId: doctor.userId, type, message });
  } catch {
    // Never let a notification failure break the triggering action.
  }
}

export async function notifyTokenGenerated(doctorId, token) {
  await notifyDoctor(doctorId, 'token_generated', `New token ${token} added to your queue.`);
}

export async function notifyTokenCalled(doctorId, token) {
  await notifyDoctor(doctorId, 'token_called', `Token ${token} has been called.`);
}

export async function notifyQueueUpdated(doctorId, token, action) {
  await notifyDoctor(doctorId, 'queue_updated', `Token ${token}: ${action.replace('_', ' ')}.`);
}

export async function notifyAppointmentConfirmed(doctorId, patientName, date, timeSlot) {
  await notifyDoctor(
    doctorId,
    'appointment_confirmed',
    `Appointment with ${patientName} confirmed for ${date} at ${timeSlot}.`
  );
}

export async function notifyAppointmentCancelled(doctorId, patientName, date, timeSlot) {
  await notifyDoctor(
    doctorId,
    'appointment_cancelled',
    `Appointment with ${patientName} on ${date} at ${timeSlot} was cancelled.`
  );
}

export async function notifyConsultationCompleted(doctorId, patientName) {
  await notifyDoctor(doctorId, 'consultation_completed', `Consultation with ${patientName} completed.`);
}
