import api from './api';

export async function listNotifications(unreadOnly = false) {
  const { data } = await api.get('/notifications', { params: unreadOnly ? { unreadOnly: true } : {} });
  return data.notifications;
}

export async function getUnreadCount() {
  const { data } = await api.get('/notifications/unread-count');
  return data.count;
}

export async function markAsRead(id) {
  const { data } = await api.put(`/notifications/${id}/read`);
  return data.notification;
}

export async function markAllAsRead() {
  const { data } = await api.put('/notifications/read-all');
  return data.markedCount;
}
