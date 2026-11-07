import api from './api';

export async function listPatients(params = {}) {
  const { data } = await api.get('/patients', { params });
  return data.patients;
}

export async function getPatient(id) {
  const { data } = await api.get(`/patients/${id}`);
  return data.patient;
}

export async function createPatient(payload) {
  const { data } = await api.post('/patients', payload);
  return data.patient;
}

export async function updatePatient(id, payload) {
  const { data } = await api.put(`/patients/${id}`, payload);
  return data.patient;
}
