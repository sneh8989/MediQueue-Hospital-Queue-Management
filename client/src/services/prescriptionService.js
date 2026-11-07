import api from './api';

export async function listPrescriptions(params = {}) {
  const { data } = await api.get('/prescriptions', { params });
  return data.prescriptions;
}

export async function getPrescription(id) {
  const { data } = await api.get(`/prescriptions/${id}`);
  return data.prescription;
}

export async function createPrescription(payload) {
  const { data } = await api.post('/prescriptions', payload);
  return data.prescription;
}

export async function updatePrescription(id, payload) {
  const { data } = await api.put(`/prescriptions/${id}`, payload);
  return data.prescription;
}
