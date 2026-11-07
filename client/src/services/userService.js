import api from './api';

export async function listUsers() {
  const { data } = await api.get('/users');
  return data.users;
}

export async function createUser(payload) {
  const { data } = await api.post('/users', payload);
  return data.user;
}

export async function updateUser(id, payload) {
  const { data } = await api.put(`/users/${id}`, payload);
  return data.user;
}

export async function resetPassword(id, password) {
  const { data } = await api.put(`/users/${id}/reset-password`, { password });
  return data;
}
