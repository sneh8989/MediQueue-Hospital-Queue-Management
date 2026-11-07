import { getDB } from '../config/db.js';
import * as auditLogModel from '../models/auditLogModel.js';
import { asyncHandler } from '../middleware/errorHandler.js';

/**
 * Hospital-wide settings.
 *
 * Only settings the rest of the system genuinely honours are exposed here.
 * Today that is exactly one: `averageConsultationMinutes` - the fallback
 * used by the queue engine (queueController) and the public tracking page
 * (publicQueueController) to estimate a wait when a doctor has no personal
 * `avgConsultationMinutes` of their own.
 *
 * `queueTokenPrefixes` also lives inside `hospitalSettings`, but it is
 * deliberately NOT exposed: token prefixes are fixed constants in
 * queueEntryModel.js, so an editable prefix here would silently change
 * nothing. Exposing a control that does nothing is worse than not having
 * the control.
 */

const DEFAULT_AVERAGE_CONSULTATION_MINUTES = 5;

function toPublicSettings(settings) {
  return {
    averageConsultationMinutes: settings?.averageConsultationMinutes ?? DEFAULT_AVERAGE_CONSULTATION_MINUTES,
  };
}

export const getSettings = asyncHandler(async (req, res) => {
  const db = getDB();
  res.json({ success: true, settings: toPublicSettings(db.data.hospitalSettings) });
});

export const updateSettings = asyncHandler(async (req, res) => {
  const db = getDB();
  const previous = toPublicSettings(db.data.hospitalSettings).averageConsultationMinutes;
  const next = req.body.averageConsultationMinutes;

  // Nothing changed: skip the write and, importantly, the audit entry -
  // an audit log full of no-op "changes" is noise.
  if (next === previous) {
    return res.json({ success: true, settings: { averageConsultationMinutes: previous } });
  }

  db.data.hospitalSettings.averageConsultationMinutes = next;
  await db.write();

  await auditLogModel.record({
    userId: req.user.sub,
    userName: req.user.email,
    action: 'settings_updated',
    entity: 'settings',
    entityId: null,
    description: `Changed default consultation time from ${previous} to ${next} minutes`,
  });

  res.json({ success: true, settings: toPublicSettings(db.data.hospitalSettings) });
});
