import express from 'express';
import bcrypt from 'bcryptjs';
import { profileUpload } from '../config/uploads.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { allowRoles, requireAuth } from '../middlewares/auth.js';
import {
  ActivityLog, Attendance, Counter, FoodCategory, FoodItem, Notification,
  Order, RestaurantSettings, RestaurantTable, SalaryPayment, Staff, User
} from '../models/index.js';

const router = express.Router();
router.use(requireAuth, allowRoles('waiter'));

router.get('/menu', asyncHandler(async (_request, response) => {
  const [categories, items] = await Promise.all([
    FoodCategory.find({ isActive: true, isVisible: true }).sort({ name: 1 }),
    FoodItem.find({ isAvailable: true }).populate('category', 'name').sort({ name: 1 })
  ]);
  response.json({ data: { categories, items } });
}));

router.get('/tables', asyncHandler(async (_request, response) => {
  const tables = await RestaurantTable.find({ isActive: true }).populate('floor', 'name').sort({ name: 1 });
  response.json({ data: tables });
}));

router.get('/overview', asyncHandler(async (request, response) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
  const [attendance, monthlyAttendance, salary, notifications, orderCount, activeOrderCount] = await Promise.all([
    Attendance.findOne({ employee: request.user._id, date: { $gte: today } }),
    Attendance.find({ employee: request.user._id, date: { $gte: monthStart } }).sort({ date: -1 }),
    SalaryPayment.findOne({ employee: request.user._id }).sort({ salaryMonth: -1 }),
    Notification.find({ recipient: request.user._id }).sort({ createdAt: -1 }).limit(10),
    Order.countDocuments({ createdBy: request.user._id, createdAt: { $gte: today } }),
    Order.countDocuments({ createdBy: request.user._id, status: { $nin: ['completed', 'cancelled'] } })
  ]);
  response.json({ data: { attendance, monthlyAttendance, salary, notifications, orderCount, activeOrderCount } });
}));

router.get('/attendance', asyncHandler(async (request, response) => {
  const filter = { employee: request.user._id };
  if (request.query.month) {
    const [year, month] = request.query.month.split('-').map(Number);
    if (year && month >= 1 && month <= 12) {
      filter.date = { $gte: new Date(year, month - 1, 1), $lt: new Date(year, month, 1) };
    }
  }
  response.json({ data: await Attendance.find(filter).sort({ date: -1 }).limit(100) });
}));

router.post('/attendance/check-in', asyncHandler(async (request, response) => {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  const attendance = await Attendance.findOneAndUpdate(
    { employee: request.user._id, date },
    { $setOnInsert: { employee: request.user._id, date, submittedBy: request.user._id }, $set: { checkIn: new Date(), status: 'present' } },
    { new: true, upsert: true, runValidators: true }
  );
  await ActivityLog.create({ actor: request.user._id, actorRole: 'waiter', action: 'attendance_check_in', resourceType: 'Attendance', resourceId: attendance._id });
  response.json({ data: attendance });
}));

router.post('/attendance/check-out', asyncHandler(async (request, response) => {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  const attendance = await Attendance.findOneAndUpdate(
    { employee: request.user._id, date },
    { $set: { checkOut: new Date() } },
    { new: true, runValidators: true }
  );
  if (!attendance?.checkIn) return response.status(400).json({ message: 'Check in before checking out' });
  await ActivityLog.create({ actor: request.user._id, actorRole: 'waiter', action: 'attendance_check_out', resourceType: 'Attendance', resourceId: attendance._id });
  response.json({ data: attendance });
}));

router.get('/salary', asyncHandler(async (request, response) => {
  response.json({ data: await SalaryPayment.find({ employee: request.user._id }).sort({ salaryMonth: -1 }).limit(24) });
}));

router.patch('/salary/:id/confirm', asyncHandler(async (request, response) => {
  const salary = await SalaryPayment.findOne({ _id: request.params.id, employee: request.user._id });
  if (!salary) return response.status(404).json({ message: 'Salary record not found' });
  salary.status = 'paid_confirmed';
  salary.confirmation = { confirmedAt: new Date() };
  await salary.save();
  await ActivityLog.create({ actor: request.user._id, actorRole: 'waiter', action: 'salary_confirmed', resourceType: 'SalaryPayment', resourceId: salary._id });
  response.json({ data: salary });
}));

router.patch('/salary/:id/report', asyncHandler(async (request, response) => {
  const salary = await SalaryPayment.findOne({ _id: request.params.id, employee: request.user._id });
  if (!salary) return response.status(404).json({ message: 'Salary record not found' });
  salary.status = 'payment_disputed';
  salary.confirmation = { issue: String(request.body.issue || 'Payment issue reported') };
  await salary.save();
  await ActivityLog.create({ actor: request.user._id, actorRole: 'waiter', action: 'salary_issue_reported', resourceType: 'SalaryPayment', resourceId: salary._id, metadata: { issue: salary.confirmation.issue } });
  response.json({ data: salary });
}));

router.get('/notifications', asyncHandler(async (request, response) => {
  response.json({ data: await Notification.find({ recipient: request.user._id }).sort({ createdAt: -1 }).limit(100) });
}));

router.patch('/notifications/:id/read', asyncHandler(async (request, response) => {
  const notification = await Notification.findOneAndUpdate(
    { _id: request.params.id, recipient: request.user._id },
    { isRead: true, readAt: new Date() },
    { new: true }
  );
  if (!notification) return response.status(404).json({ message: 'Notification not found' });
  response.json({ data: notification });
}));

router.patch('/profile', profileUpload.single('profilePicture'), asyncHandler(async (request, response) => {
  const updates = {};
  if (request.body.fullName?.trim()) updates.fullName = request.body.fullName.trim();
  if (request.body.phone !== undefined) updates.phone = request.body.phone.trim();
  if (request.body.address !== undefined) updates.address = request.body.address.trim();
  if (request.file) updates.profilePicture = `/uploads/profiles/${request.file.filename}`;
  if (!Object.keys(updates).length) return response.status(400).json({ message: 'No profile fields were provided' });
  const user = await Staff.findOneAndUpdate({ _id: request.user._id, role: 'waiter' }, updates, { new: true, runValidators: true });
  if (!user) return response.status(404).json({ message: 'Waiter account not found' });
  response.json({ data: user });
}));

router.patch('/password', asyncHandler(async (request, response) => {
  const { currentPassword, newPassword } = request.body;
  if (!newPassword || newPassword.length < 8) return response.status(400).json({ message: 'New password must be at least 8 characters' });
  const user = await User.findById(request.user._id).select('+passwordHash');
  if (!user || !(await bcrypt.compare(currentPassword || '', user.passwordHash))) return response.status(400).json({ message: 'Current password is incorrect' });
  user.passwordHash = await bcrypt.hash(newPassword, 12);
  user.mustChangePassword = false;
  await user.save();
  await ActivityLog.create({ actor: request.user._id, actorRole: 'waiter', action: 'password_changed', resourceType: 'User', resourceId: user._id });
  response.json({ message: 'Password changed successfully' });
}));

router.get('/orders', asyncHandler(async (request, response) => {
  const filter = { createdBy: request.user._id };
  if (request.query.active === 'true') filter.status = { $in: ['pending', 'processing', 'ready', 'served'] };
  const orders = await Order.find(filter).sort({ createdAt: -1 }).limit(50)
    .populate('table', 'name').populate('createdBy', 'fullName');
  response.json({ data: orders });
}));

router.get('/orders/:id', asyncHandler(async (request, response) => {
  const order = await Order.findOne({ _id: request.params.id, createdBy: request.user._id })
    .populate('table', 'name capacity').populate('createdBy', 'fullName');
  if (!order) return response.status(404).json({ message: 'Order not found' });
  response.json({ data: order });
}));

router.post('/orders', asyncHandler(async (request, response) => {
  const { type = 'dine_in', table, guest, items } = request.body;
  if (!['dine_in', 'takeaway', 'walk_in'].includes(type) || !Array.isArray(items) || !items.length) {
    return response.status(400).json({ message: 'Order type and at least one menu item are required' });
  }
  if (type === 'dine_in' && !table) return response.status(400).json({ message: 'Select a table for dine-in orders' });
  const menuItems = await FoodItem.find({ _id: { $in: items.map((item) => item.foodItem) }, isAvailable: true });
  const menuById = new Map(menuItems.map((item) => [item._id.toString(), item]));
  const orderItems = items.map((entry) => {
    const menuItem = menuById.get(String(entry.foodItem));
    const quantity = Number(entry.quantity);
    if (!menuItem || !Number.isInteger(quantity) || quantity < 1) return null;
    const size = menuItem.availableSizes.includes(entry.selectedSize) ? entry.selectedSize : undefined;
    const adjustment = menuItem.sizePricing.find((price) => price.size === size)?.adjustment || 0;
    const unitPrice = Number(menuItem.offerPrice || menuItem.regularPrice) + adjustment;
    const addOns = (Array.isArray(entry.addOns) ? entry.addOns : []).filter((addOn) => (
      addOn?.type === 'spicy_level' && menuItem.spicyLevels.includes(addOn.name)
    )).map((addOn) => ({ name: addOn.name, type: 'spicy_level', price: 0 }));
    return { foodItem: menuItem._id, name: menuItem.name, quantity, unitPrice, selectedSize: size, addOns, notes: entry.notes };
  });
  if (orderItems.some((item) => !item)) return response.status(400).json({ message: 'One or more selected menu items are invalid' });
  const subtotal = orderItems.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
  const settings = await RestaurantSettings.findOne().sort({ createdAt: 1 });
  const tax = subtotal * Number(settings?.taxPercentage || 0) / 100;
  const serviceCharge = subtotal * Number(settings?.serviceChargePercentage || 0) / 100;
  const counter = await Counter.findOneAndUpdate({ _id: 'order' }, { $inc: { sequence: 1 } }, { new: true, upsert: true });
  const order = await Order.create({
    orderNumber: `ORD-${String(counter.sequence).padStart(6, '0')}`, type, table, guest,
    items: orderItems, subtotal, tax, serviceCharge, total: subtotal + tax + serviceCharge,
    createdBy: request.user._id
  });
  if (type === 'dine_in') {
    const claimedTable = await RestaurantTable.findOneAndUpdate(
      { _id: table, isActive: true, status: 'available' },
      { status: 'occupied' },
      { new: true }
    );
    if (!claimedTable) {
      await Order.findByIdAndDelete(order._id);
      return response.status(409).json({ message: 'This table is no longer available' });
    }
  }
  await ActivityLog.create({ actor: request.user._id, actorRole: 'waiter', action: 'order_created', resourceType: 'Order', resourceId: order._id, metadata: { type, table } });
  const chefs = await User.find({ role: 'chef', isActive: true }).select('_id');
  if (chefs.length) {
    await Notification.insertMany(chefs.map((chef) => ({
      recipient: chef._id, type: 'kitchen_order', title: 'New kitchen order',
      message: `Order ${order.orderNumber} is ready for preparation`, referenceModel: 'Order', referenceId: order._id
    })));
  }
  response.status(201).json({ data: order });
}));

router.patch('/orders/:id/status', asyncHandler(async (request, response) => {
  const allowedTransitions = {
    pending: ['processing', 'cancelled'],
    processing: ['ready', 'cancelled'],
    ready: ['served', 'cancelled'],
    served: []
  };
  const { status } = request.body;
  const existing = await Order.findOne({ _id: request.params.id, createdBy: request.user._id });
  if (!existing) return response.status(404).json({ message: 'Order not found' });
  if (existing.type === 'online') return response.status(403).json({ message: 'Online orders are managed by kitchen and delivery staff' });
  if (!allowedTransitions[existing.status]?.includes(status)) {
    return response.status(400).json({ message: `Order can move from ${existing.status} to ${allowedTransitions[existing.status]?.join(' or ') || 'no next stage'}` });
  }
  const nextStatus = status === 'completed' && existing.status === 'ready' ? 'served' : status;
  const order = await Order.findOneAndUpdate(
    { _id: request.params.id, createdBy: request.user._id },
    { status: nextStatus },
    { new: true, runValidators: true }
  ).populate('table', 'name');
  if (!order) return response.status(404).json({ message: 'Order not found' });
  if (['completed', 'cancelled'].includes(nextStatus) && order.table) {
    await RestaurantTable.findByIdAndUpdate(order.table._id, { status: 'available' });
  }
  await ActivityLog.create({ actor: request.user._id, actorRole: 'waiter', action: `order_${nextStatus}`, resourceType: 'Order', resourceId: order._id });
  response.json({ data: order });
}));

export default router;
