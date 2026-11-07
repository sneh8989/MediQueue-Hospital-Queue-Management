import api from './api';

export async function listRooms(params = {}) {
  const { data } = await api.get('/rooms', { params });
  return data.rooms;
}

export async function getRoom(id) {
  const { data } = await api.get(`/rooms/${id}`);
  return data.room;
}

export async function createRoom(payload) {
  const { data } = await api.post('/rooms', payload);
  return data.room;
}

export async function updateRoom(id, payload) {
  const { data } = await api.put(`/rooms/${id}`, payload);
  return data.room;
}

export async function deleteRoom(id) {
  const { data } = await api.delete(`/rooms/${id}`);
  return data;
}
