import api from './api';

export async function listAuditLogs(params = {}) {
  const { data } = await api.get('/audit-logs', { params });
  return data.logs;
}

export async function getFilterOptions() {
  const { data } = await api.get('/audit-logs/filter-options');
  return { actions: data.actions, entities: data.entities };
}
