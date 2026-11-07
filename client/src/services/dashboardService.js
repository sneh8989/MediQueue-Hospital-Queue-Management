import api from './api';

export async function getDashboardSummary(date) {
  const { data } = await api.get('/dashboard/summary', { params: date ? { date } : {} });
  return data;
}

// Live front-line snapshot for receptionists and nurses (no analytics).
export async function getOperationsSummary(date) {
  const { data } = await api.get('/dashboard/operations', { params: date ? { date } : {} });
  return data;
}
