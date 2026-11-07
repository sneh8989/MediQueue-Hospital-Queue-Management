import api from './api';

export async function listDoctors(params = {}) {
  const { data } = await api.get('/doctors', { params });
  return data.doctors;
}

export async function getMyDoctorProfile() {
  const { data } = await api.get('/doctors/me');
  return data.doctor;
}

export async function getDoctor(id) {
  const { data } = await api.get(`/doctors/${id}`);
  return data.doctor;
}

export async function createDoctor(payload) {
  const { data } = await api.post('/doctors', payload);
  return data.doctor;
}

export async function updateDoctor(id, payload) {
  const { data } = await api.put(`/doctors/${id}`, payload);
  return data.doctor;
}

export async function deactivateDoctor(id) {
  const { data } = await api.delete(`/doctors/${id}`);
  return data.doctor;
}
