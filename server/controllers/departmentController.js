import * as departmentModel from '../models/departmentModel.js';
import * as auditLogModel from '../models/auditLogModel.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import AppError from '../utils/AppError.js';

export const listDepartments = asyncHandler(async (req, res) => {
  const includeInactive = req.query.includeInactive === 'true' && req.user.role === 'admin';
  const departments = await departmentModel.findAll({ includeInactive });
  res.json({ success: true, count: departments.length, departments });
});

export const getDepartment = asyncHandler(async (req, res) => {
  const department = await departmentModel.findById(req.params.id);
  if (!department) throw new AppError('Department not found', 404);
  res.json({ success: true, department });
});

export const createDepartment = asyncHandler(async (req, res) => {
  const existing = await departmentModel.findByName(req.body.name);
  if (existing) {
    throw new AppError('A department with this name already exists', 409);
  }

  const department = await departmentModel.create(req.body);

  await auditLogModel.record({
    userId: req.user.sub,
    userName: req.user.email,
    action: 'department_created',
    entity: 'department',
    entityId: department.id,
    description: `Created department "${department.name}"`,
  });

  res.status(201).json({ success: true, department });
});

export const updateDepartment = asyncHandler(async (req, res) => {
  const existing = await departmentModel.findById(req.params.id);
  if (!existing) throw new AppError('Department not found', 404);

  const department = await departmentModel.update(req.params.id, req.body);

  await auditLogModel.record({
    userId: req.user.sub,
    userName: req.user.email,
    action: 'department_updated',
    entity: 'department',
    entityId: department.id,
    description: `Updated department "${department.name}"`,
  });

  res.json({ success: true, department });
});

export const deactivateDepartment = asyncHandler(async (req, res) => {
  const existing = await departmentModel.findById(req.params.id);
  if (!existing) throw new AppError('Department not found', 404);

  const department = await departmentModel.deactivate(req.params.id);

  await auditLogModel.record({
    userId: req.user.sub,
    userName: req.user.email,
    action: 'department_deactivated',
    entity: 'department',
    entityId: department.id,
    description: `Deactivated department "${department.name}"`,
  });

  res.json({ success: true, department });
});
