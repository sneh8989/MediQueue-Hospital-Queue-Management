import { getDB } from '../config/db.js';
import { generateId, nowISO } from '../utils/id.js';

/**
 * AuditLog shape:
 * { id, userId, userName, action, entity, entityId, description, createdAt }
 */
export async function record({ userId, userName, action, entity = null, entityId = null, description = '' }) {
  const db = getDB();
  const entry = {
    id: generateId(),
    userId,
    userName,
    action,
    entity,
    entityId,
    description,
    createdAt: nowISO(),
  };
  db.data.auditLogs.push(entry);
  await db.write();
  return entry;
}

export async function findAll({ userId, action, entity, date, limit = 200 } = {}) {
  const db = getDB();
  let results = db.data.auditLogs;
  if (userId) results = results.filter((l) => l.userId === userId);
  if (action) results = results.filter((l) => l.action === action);
  if (entity) results = results.filter((l) => l.entity === entity);
  if (date) results = results.filter((l) => l.createdAt.slice(0, 10) === date);
  return [...results].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, limit);
}

// Distinct action/entity values seen so far, for populating filter
// dropdowns without hardcoding a list that could drift from reality.
export async function listDistinctActionsAndEntities() {
  const db = getDB();
  const actions = [...new Set(db.data.auditLogs.map((l) => l.action))].sort();
  const entities = [...new Set(db.data.auditLogs.map((l) => l.entity).filter(Boolean))].sort();
  return { actions, entities };
}
