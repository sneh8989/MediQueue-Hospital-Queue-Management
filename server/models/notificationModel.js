import { getDB } from '../config/db.js';
import { generateId, nowISO } from '../utils/id.js';

/**
 * Notification shape: { id, userId, type, message, read, createdAt }
 *
 * Per the master spec (section 23): in-app notifications only for this
 * project - no SMS/email is ever sent or faked. `userId` is always a
 * STAFF user's id, never a patient's - patients don't have login
 * accounts in this system (see docs/DATABASE.md's users/doctors split
 * note from Phase 4), so there is no inbox for them to receive
 * notifications into. See notificationService.js for which staff member
 * gets notified for which event.
 */

export async function findAllForUser(userId, { unreadOnly = false } = {}) {
  const db = getDB();
  let results = db.data.notifications.filter((n) => n.userId === userId);
  if (unreadOnly) results = results.filter((n) => !n.read);
  return [...results].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function countUnread(userId) {
  const db = getDB();
  return db.data.notifications.filter((n) => n.userId === userId && !n.read).length;
}

export async function findById(id) {
  const db = getDB();
  return db.data.notifications.find((n) => n.id === id) || null;
}

export async function create({ userId, type, message }) {
  const db = getDB();
  const notification = {
    id: generateId(),
    userId,
    type,
    message,
    read: false,
    createdAt: nowISO(),
  };
  db.data.notifications.push(notification);
  await db.write();
  return notification;
}

export async function markRead(id) {
  const db = getDB();
  const notification = db.data.notifications.find((n) => n.id === id);
  if (!notification) return null;
  notification.read = true;
  await db.write();
  return notification;
}

export async function markAllRead(userId) {
  const db = getDB();
  let count = 0;
  for (const n of db.data.notifications) {
    if (n.userId === userId && !n.read) {
      n.read = true;
      count++;
    }
  }
  if (count > 0) await db.write();
  return count;
}
