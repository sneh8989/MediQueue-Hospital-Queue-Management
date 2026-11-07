import api from './api';

export async function getSettings() {
  const { data } = await api.get('/settings');
  return data.settings;
}

export async function updateSettings(payload) {
  const { data } = await api.put('/settings', payload);
  return data.settings;
}
