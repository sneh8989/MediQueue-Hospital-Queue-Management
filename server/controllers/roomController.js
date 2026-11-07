import * as roomModel from '../models/roomModel.js';
import * as departmentModel from '../models/departmentModel.js';
import * as doctorModel from '../models/doctorModel.js';
import * as auditLogModel from '../models/auditLogModel.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import AppError from '../utils/AppError.js';

async function attachRefs(room) {
  const [department, doctor] = await Promise.all([
    room.departmentId ? departmentModel.findById(room.departmentId) : null,
    room.doctorId ? doctorModel.findById(room.doctorId) : null,
  ]);
  return {
    ...room,
    departmentName: department?.name || null,
    doctorName: doctor?.name || null,
  };
}

export const listRooms = asyncHandler(async (req, res) => {
  const { departmentId, status } = req.query;
  const rooms = await roomModel.findAll({ departmentId, status });
  const withRefs = await Promise.all(rooms.map(attachRefs));
  res.json({ success: true, count: withRefs.length, rooms: withRefs });
});

export const getRoom = asyncHandler(async (req, res) => {
  const room = await roomModel.findById(req.params.id);
  if (!room) throw new AppError('Room not found', 404);
  res.json({ success: true, room: await attachRefs(room) });
});

export const createRoom = asyncHandler(async (req, res) => {
  const existing = await roomModel.findByNumber(req.body.number);
  if (existing) {
    throw new AppError('A room with this number already exists', 409);
  }

  const department = await departmentModel.findById(req.body.departmentId);
  if (!department) {
    throw new AppError('The selected department does not exist', 400);
  }

  const room = await roomModel.create(req.body);

  await auditLogModel.record({
    userId: req.user.sub,
    userName: req.user.email,
    action: 'room_created',
    entity: 'room',
    entityId: room.id,
    description: `Created room ${room.number} in ${department.name}`,
  });

  res.status(201).json({ success: true, room: await attachRefs(room) });
});

export const updateRoom = asyncHandler(async (req, res) => {
  const existing = await roomModel.findById(req.params.id);
  if (!existing) throw new AppError('Room not found', 404);

  const room = await roomModel.update(req.params.id, req.body);

  await auditLogModel.record({
    userId: req.user.sub,
    userName: req.user.email,
    action: 'room_updated',
    entity: 'room',
    entityId: room.id,
    description: `Updated room ${room.number}`,
  });

  res.json({ success: true, room: await attachRefs(room) });
});

export const deleteRoom = asyncHandler(async (req, res) => {
  const existing = await roomModel.findById(req.params.id);
  if (!existing) throw new AppError('Room not found', 404);

  await roomModel.remove(req.params.id);

  await auditLogModel.record({
    userId: req.user.sub,
    userName: req.user.email,
    action: 'room_deleted',
    entity: 'room',
    entityId: req.params.id,
    description: `Deleted room ${existing.number}`,
  });

  res.json({ success: true, message: 'Room deleted' });
});
