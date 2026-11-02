import express from 'express';
import bcrypt from 'bcryptjs';
import { asyncHandler } from '../utils/asyncHandler.js';
import { User, Staff, Manager } from '../models/index.js';
import { createCrudRouter } from '../utils/crudRouter.js';
import { requireAuth, allowRoles } from '../middlewares/auth.js';

const router = express.Router();
router.use(requireAuth, allowRoles('admin', 'owner', 'manager'));
router.get('/', createCrudRouter(User, { filterFields: ['role', 'isActive'], searchableFields: ['fullName', 'email', 'phone'] }));
router.post('/', asyncHandler(async (request, response) => {
  const { password, ...data } = request.body;
  if (!password || !data.role || data.role === 'customer') return response.status(400).json({ message: 'Staff role and password are required' });
  data.accountType = data.role === 'manager' ? 'manager' : 'staff';
  data.passwordHash = await bcrypt.hash(password, 12);
  const Model = data.role === 'manager' ? Manager : Staff;
  const user = await Model.create(data);
  response.status(201).json({ data: user });
}));
export default router;
