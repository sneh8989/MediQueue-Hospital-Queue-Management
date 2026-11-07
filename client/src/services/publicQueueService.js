import axios from 'axios';

// Public queue endpoints are deliberately unauthenticated (see
// server/controllers/publicQueueController.js), so this uses a plain axios
// instance rather than the shared api.js - we never want to attach a JWT
// here, and we never want the 401-redirect-to-login interceptor to fire on
// a page a patient might be viewing with no account at all.
const publicApi = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  headers: { 'Content-Type': 'application/json' },
});

export async function getPublicQueueBoard(departmentId) {
  const { data } = await publicApi.get('/public/queue', { params: { departmentId } });
  return data;
}

export async function getPublicQueueEntry(id) {
  const { data } = await publicApi.get(`/public/queue/${id}`);
  return data.entry;
}
