import * as auditLogModel from '../models/auditLogModel.js';
import { asyncHandler } from '../middleware/errorHandler.js';

export const listAuditLogs = asyncHandler(async (req, res) => {
  const { userId, action, entity, date } = req.query;
  const logs = await auditLogModel.findAll({ userId, action, entity, date });
  res.json({ success: true, count: logs.length, logs });
});

export const listFilterOptions = asyncHandler(async (req, res) => {
  const options = await auditLogModel.listDistinctActionsAndEntities();
  res.json({ success: true, ...options });
});
