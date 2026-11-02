import express from 'express';
import bcrypt from 'bcryptjs';
import { asyncHandler } from '../utils/asyncHandler.js';
import { allowRoles, requireAuth } from '../middlewares/auth.js';
import {
  ActivityLog, Attendance, Notification, Order, SalaryPayment, Staff, User
} from '../models/index.js';

const router = express.Router();
router.use(requireAuth, allowRoles('chef', 'manager'));

function todayStart() {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date;
}

function kitchenFilter(request) {
  const visibility = { $or: [{ type: { $ne: 'online' } }, { type: 'online', onlineApproval: 'approved' }] };
  return request.user.role === 'chef' ? { $and: [visibility, { createdAt: { $gte: todayStart() } }] } : visibility;
}

router.get('/overview', asyncHandler(async (request, response) => {
  const filter = kitchenFilter(request);
  const [orders, attendance, salary, notifications] = await Promise.all([
    Order.find(filter).select('status items kitchenEvents createdAt').lean(),
    Attendance.findOne({ employee: request.user._id, date: { $gte: todayStart() } }),
    SalaryPayment.findOne({ employee: request.user._id }).sort({ salaryMonth: -1 }),
    Notification.find({ recipient: request.user._id }).sort({ createdAt: -1 }).limit(10)
  ]);
  const completedEvents = orders.flatMap((order) => order.kitchenEvents || []).filter((event) => event.status === 'served' || event.status === 'completed');
  const completedItems = orders.filter((order) => ['served', 'completed'].includes(order.status))
    .reduce((sum, order) => sum + order.items.reduce((itemSum, item) => itemSum + item.quantity, 0), 0);
  const preparationTimes = orders.flatMap((order) => {
    const start = (order.kitchenEvents || []).find((event) => event.status === 'processing');
    const end = (order.kitchenEvents || []).find((event) => ['ready', 'served', 'completed'].includes(event.status));
    return start && end ? [new Date(end.at) - new Date(start.at)] : [];
  });
  response.json({
    data: {
      totalAssigned: orders.length,
      accepted: orders.filter((order) => ['accepted', 'processing', 'ready', 'served', 'completed'].includes(order.status)).length,
      pending: orders.filter((order) => order.status === 'pending').length,
      preparing: orders.filter((order) => order.status === 'processing').length,
      ready: orders.filter((order) => order.status === 'ready').length,
      completed: orders.filter((order) => ['served', 'completed'].includes(order.status)).length,
      cancelled: orders.filter((order) => order.status === 'cancelled').length,
      completedItems,
      averagePreparationMinutes: preparationTimes.length ? Math.round(preparationTimes.reduce((sum, value) => sum + value, 0) / preparationTimes.length / 60000) : 0,
      completedEvents: completedEvents.length,
      attendance,
      salary,
      notifications
    }
  });
}));

router.get('/orders', asyncHandler(async (request, response) => {
  const filter = {
    status: { $nin: ['completed', 'cancelled'] },
    $or: [{ type: { $ne: 'online' } }, { type: 'online', onlineApproval: 'approved' }]
  };
  if (request.query.status) filter.status = request.query.status;
  if (request.query.search) filter.orderNumber = { $regex: request.query.search, $options: 'i' };
  if (request.query.date) {
    const start = new Date(request.query.date);
    const end = new Date(start);
    end.setDate(end.getDate() + 1);
    filter.createdAt = { $gte: start, $lt: end };
  }
  const orders = await Order.find(filter).sort({ kitchenPriority: -1, createdAt: 1 })
    .populate('table', 'name').populate('createdBy', 'fullName');
  response.json({ data: orders });
}));

router.get('/history', asyncHandler(async (request, response) => {
  const filter = kitchenFilter(request);
  if (request.query.status) filter.status = request.query.status;
  if (request.query.search) filter.orderNumber = { $regex: request.query.search, $options: 'i' };
  if (request.query.date) {
    const start = new Date(request.query.date);
    const end = new Date(start);
    end.setDate(end.getDate() + 1);
    filter.createdAt = { $gte: start, $lt: end };
  }
  response.json({ data: await Order.find(filter).sort({ updatedAt: -1 }).limit(200).populate('table', 'name').populate('createdBy', 'fullName') });
}));

router.patch('/orders/:id/status', asyncHandler(async (request, response) => {
  const transitions = {
    pending: ['accepted', 'cancelled'],
    accepted: ['processing', 'cancelled'],
    processing: ['ready', 'cancelled'],
    ready: ['served', 'cancelled'],
    served: ['cancelled']
  };
  const order = await Order.findById(request.params.id);
  if (!order) return response.status(404).json({ message: 'Order not found' });
  const nextStatus = request.body.status;
  if (!transitions[order.status]?.includes(nextStatus)) {
    return response.status(400).json({ message: `Order can move from ${order.status} to ${transitions[order.status]?.join(' or ') || 'no next stage'}` });
  }
  order.status = nextStatus;
  if (['ready', 'served'].includes(nextStatus) && order.type === 'online') order.deliveryStatus = 'awaiting_pickup';
  order.kitchenEvents.push({ status: nextStatus, staff: request.user._id, note: request.body.note });
  if (request.body.issue !== undefined) order.kitchenIssue = String(request.body.issue);
  order.items.forEach((item) => { item.preparationStatus = nextStatus === 'processing' ? 'preparing' : nextStatus === 'ready' || nextStatus === 'served' ? 'ready' : nextStatus === 'completed' ? 'completed' : item.preparationStatus; });
  await order.save();
  await ActivityLog.create({ actor: request.user._id, actorRole: request.user.role, action: `kitchen_order_${nextStatus}`, resourceType: 'Order', resourceId: order._id, metadata: { note: request.body.note, issue: request.body.issue } });
  response.json({ data: await order.populate('table', 'name') });
}));

router.patch('/orders/:id/priority', asyncHandler(async (request, response) => {
  if (!['normal', 'high', 'urgent'].includes(request.body.priority)) return response.status(400).json({ message: 'Invalid kitchen priority' });
  const order = await Order.findByIdAndUpdate(request.params.id, { kitchenPriority: request.body.priority }, { new: true, runValidators: true });
  if (!order) return response.status(404).json({ message: 'Order not found' });
  response.json({ data: order });
}));

router.post('/orders/:id/issue', asyncHandler(async (request, response) => {
  const issue = String(request.body.issue || '').trim();
  if (!issue) return response.status(400).json({ message: 'Preparation issue is required' });
  const order = await Order.findByIdAndUpdate(request.params.id, { kitchenIssue: issue }, { new: true });
  if (!order) return response.status(404).json({ message: 'Order not found' });
  await ActivityLog.create({ actor: request.user._id, actorRole: request.user.role, action: 'kitchen_issue_reported', resourceType: 'Order', resourceId: order._id, metadata: { issue } });
  response.json({ data: order });
}));

router.get('/attendance', asyncHandler(async (request, response) => {
  response.json({ data: await Attendance.find({ employee: request.user._id }).sort({ date: -1 }).limit(100) });
}));

router.post('/attendance/check-in', asyncHandler(async (request, response) => {
  const date = todayStart();
  const attendance = await Attendance.findOneAndUpdate({ employee: request.user._id, date }, { $setOnInsert: { employee: request.user._id, date, submittedBy: request.user._id }, $set: { checkIn: new Date(), status: 'present' } }, { new: true, upsert: true, runValidators: true });
  response.json({ data: attendance });
}));

router.post('/attendance/check-out', asyncHandler(async (request, response) => {
  const attendance = await Attendance.findOneAndUpdate({ employee: request.user._id, date: { $gte: todayStart() } }, { checkOut: new Date() }, { new: true, runValidators: true });
  if (!attendance?.checkIn) return response.status(400).json({ message: 'Check in before checking out' });
  response.json({ data: attendance });
}));

router.get('/salary', asyncHandler(async (request, response) => {
  response.json({ data: await SalaryPayment.find({ employee: request.user._id }).sort({ salaryMonth: -1 }).limit(24) });
}));

router.patch('/salary/:id/confirm', asyncHandler(async (request, response) => {
  const salary = await SalaryPayment.findOne({ _id: request.params.id, employee: request.user._id });
  if (!salary) return response.status(404).json({ message: 'Salary record not found' });
  salary.status = 'paid_confirmed'; salary.confirmation = { confirmedAt: new Date() }; await salary.save();
  response.json({ data: salary });
}));

router.patch('/salary/:id/report', asyncHandler(async (request, response) => {
  const salary = await SalaryPayment.findOne({ _id: request.params.id, employee: request.user._id });
  if (!salary) return response.status(404).json({ message: 'Salary record not found' });
  salary.status = 'payment_disputed'; salary.confirmation = { issue: String(request.body.issue || 'Payment issue reported') }; await salary.save();
  response.json({ data: salary });
}));

router.get('/notifications', asyncHandler(async (request, response) => {
  response.json({ data: await Notification.find({ recipient: request.user._id }).sort({ createdAt: -1 }).limit(100) });
}));

router.patch('/notifications/:id/read', asyncHandler(async (request, response) => {
  const notification = await Notification.findOneAndUpdate({ _id: request.params.id, recipient: request.user._id }, { isRead: true, readAt: new Date() }, { new: true });
  if (!notification) return response.status(404).json({ message: 'Notification not found' });
  response.json({ data: notification });
}));

router.patch('/profile', asyncHandler(async (request, response) => {
  const updates = {};
  if (request.body.fullName?.trim()) updates.fullName = request.body.fullName.trim();
  if (request.body.phone !== undefined) updates.phone = request.body.phone.trim();
  if (request.body.address !== undefined) updates.address = request.body.address.trim();
  const user = await Staff.findOneAndUpdate({ _id: request.user._id, role: 'chef' }, updates, { new: true, runValidators: true });
  if (!user) return response.status(404).json({ message: 'Chef account not found' });
  response.json({ data: user });
}));

router.patch('/password', asyncHandler(async (request, response) => {
  const { currentPassword, newPassword } = request.body;
  if (!newPassword || newPassword.length < 8) return response.status(400).json({ message: 'New password must be at least 8 characters' });
  const user = await User.findById(request.user._id).select('+passwordHash');
  if (!user || !(await bcrypt.compare(currentPassword || '', user.passwordHash))) return response.status(400).json({ message: 'Current password is incorrect' });
  user.passwordHash = await bcrypt.hash(newPassword, 12); user.mustChangePassword = false; await user.save();
  response.json({ message: 'Password changed successfully' });
}));

export default router;
