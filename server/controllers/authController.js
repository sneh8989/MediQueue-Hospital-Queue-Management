import * as authService from '../services/authService.js';
import * as userModel from '../models/userModel.js';
import * as auditLogModel from '../models/auditLogModel.js';
import { asyncHandler } from '../middleware/errorHandler.js';

export const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  const { token, user } = await authService.authenticate(email, password);

  await auditLogModel.record({
    userId: user.id,
    userName: user.name,
    action: 'login',
    entity: 'user',
    entityId: user.id,
    description: `${user.name} (${user.role}) logged in`,
  });

  res.json({ success: true, token, user });
});

export const me = asyncHandler(async (req, res) => {
  const user = await userModel.findById(req.user.sub);
  if (!user) {
    return res.status(404).json({ success: false, message: 'User not found' });
  }
  res.json({ success: true, user: userModel.toPublicUser(user) });
});

export const logout = asyncHandler(async (req, res) => {
  // Stateless JWT - logout is a client-side token discard. We still audit it
  // so the log has a full login/logout trail.
  if (req.user) {
    const user = await userModel.findById(req.user.sub);
    if (user) {
      await auditLogModel.record({
        userId: user.id,
        userName: user.name,
        action: 'logout',
        entity: 'user',
        entityId: user.id,
        description: `${user.name} logged out`,
      });
    }
  }
  res.json({ success: true, message: 'Logged out' });
});
