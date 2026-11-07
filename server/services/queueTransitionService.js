import * as queueEntryModel from '../models/queueEntryModel.js';
import * as auditLogModel from '../models/auditLogModel.js';
import * as patientModel from '../models/patientModel.js';
import * as notificationService from './notificationService.js';
import AppError from '../utils/AppError.js';

/**
 * Shared queue state-machine transition logic, extracted so it can be
 * called both from queueController's HTTP handlers AND from
 * consultationController (completing a consultation also completes the
 * underlying queue entry - see docs/QUEUE_LOGIC.md "Implementation
 * status" and consultationController.js for why this isn't duplicated
 * inline in two places).
 */

function assertTransition(entry, from, action) {
  const allowed = Array.isArray(from) ? from : [from];
  if (!allowed.includes(entry.status)) {
    throw new AppError(
      `Cannot ${action} a queue entry that is currently "${entry.status}" (expected: ${allowed.join(' or ')})`,
      409
    );
  }
}

/**
 * Transitions a queue entry and writes the matching audit log entry.
 * Throws AppError (404/409) on invalid id or invalid starting state.
 * Also fires the matching in-app notification to the assigned doctor
 * (Phase 12) - one central place so every entry point into a transition
 * (queue board buttons, consultation "Save & Complete") gets the same
 * notification behavior for free.
 */
export async function transitionQueueEntry({ id, from, to, action, timestampField, actor }) {
  const entry = await queueEntryModel.findById(id);
  if (!entry) throw new AppError('Queue entry not found', 404);

  assertTransition(entry, from, action);

  const updates = { status: to };
  if (timestampField) updates[timestampField] = new Date().toISOString();

  const updated = await queueEntryModel.update(entry.id, updates);

  await auditLogModel.record({
    userId: actor.sub,
    userName: actor.email,
    action: `token_${action}`,
    entity: 'queueEntry',
    entityId: entry.id,
    description: `Token ${entry.token}: ${action.replace('_', ' ')}`,
  });

  if (action === 'call') {
    await notificationService.notifyTokenCalled(entry.doctorId, entry.token);
  } else if (action === 'complete') {
    const patient = await patientModel.findById(entry.patientId);
    await notificationService.notifyConsultationCompleted(entry.doctorId, patient?.name || 'patient');
  } else if (['skip', 'recall', 'cancel', 'no_show'].includes(action)) {
    await notificationService.notifyQueueUpdated(entry.doctorId, entry.token, action);
  }

  return updated;
}

export async function completeQueueEntry(id, actor) {
  return transitionQueueEntry({
    id,
    from: 'in_consultation',
    to: 'completed',
    action: 'complete',
    timestampField: 'completedAt',
    actor,
  });
}
