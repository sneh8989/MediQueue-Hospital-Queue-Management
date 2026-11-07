import api from './api';

export async function listConsultations(params = {}) {
  const { data } = await api.get('/consultations', { params });
  return data.consultations;
}

export async function getConsultation(id) {
  const { data } = await api.get(`/consultations/${id}`);
  return data.consultation;
}

export async function createConsultation(payload) {
  const { data } = await api.post('/consultations', payload);
  return data.consultation;
}

export async function updateConsultation(id, payload) {
  const { data } = await api.put(`/consultations/${id}`, payload);
  return data.consultation;
}
