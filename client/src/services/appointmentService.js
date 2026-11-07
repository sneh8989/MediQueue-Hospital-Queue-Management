import api from './api';

export async function listAppointments(params = {}) {
  const { data } = await api.get('/appointments', { params });
  return data.appointments;
}

export async function listTodayAppointments() {
  const { data } = await api.get('/appointments/today');
  return data.appointments;
}

export async function getAppointment(id) {
  const { data } = await api.get(`/appointments/${id}`);
  return data.appointment;
}

export async function createAppointment(payload) {
  const { data } = await api.post('/appointments', payload);
  return data.appointment;
}

export async function updateAppointment(id, payload) {
  const { data } = await api.put(`/appointments/${id}`, payload);
  return data.appointment;
}
