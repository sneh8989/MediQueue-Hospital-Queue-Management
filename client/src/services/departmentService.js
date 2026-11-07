import api from './api';

export async function listDepartments(params = {}) {
  const { data } = await api.get('/departments', { params });
  return data.departments;
}

export async function getDepartment(id) {
  const { data } = await api.get(`/departments/${id}`);
  return data.department;
}

export async function createDepartment(payload) {
  const { data } = await api.post('/departments', payload);
  return data.department;
}

export async function updateDepartment(id, payload) {
  const { data } = await api.put(`/departments/${id}`, payload);
  return data.department;
}

export async function deactivateDepartment(id) {
  const { data } = await api.delete(`/departments/${id}`);
  return data.department;
}
