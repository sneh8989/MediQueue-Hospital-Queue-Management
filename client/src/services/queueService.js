import api from './api';

export async function getQueue(departmentId, date) {
  const { data } = await api.get('/queue', { params: { departmentId, date } });
  return data;
}

export async function getPatientQueueHistory(patientId) {
  const { data } = await api.get('/queue/history', { params: { patientId } });
  return data.entries;
}

export async function getQueueEntry(id) {
  const { data } = await api.get(`/queue/${id}`);
  return data.entry;
}

export async function generateToken(payload) {
  const { data } = await api.post('/queue/token', payload);
  return data.entry;
}

export async function callNext(departmentId) {
  const { data } = await api.post('/queue/call-next', { departmentId });
  return data.entry;
}

export async function callSpecific(id) {
  const { data } = await api.post(`/queue/${id}/call`);
  return data.entry;
}

export async function skip(id) {
  const { data } = await api.post(`/queue/${id}/skip`);
  return data.entry;
}

export async function recall(id) {
  const { data } = await api.post(`/queue/${id}/recall`);
  return data.entry;
}

export async function start(id) {
  const { data } = await api.post(`/queue/${id}/start`);
  return data.entry;
}

export async function complete(id) {
  const { data } = await api.post(`/queue/${id}/complete`);
  return data.entry;
}

export async function cancel(id) {
  const { data } = await api.post(`/queue/${id}/cancel`);
  return data.entry;
}

export async function markNoShow(id) {
  const { data } = await api.post(`/queue/${id}/no-show`);
  return data.entry;
}
