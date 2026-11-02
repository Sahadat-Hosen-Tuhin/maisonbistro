import express from 'express';
import bcrypt from 'bcryptjs';
import { asyncHandler } from '../utils/asyncHandler.js';
import { allowRoles, requireAuth } from '../middlewares/auth.js';
import { ActivityLog, Attendance, LeaveRequest, Notification, SalaryPayment, User } from '../models/index.js';

const router = express.Router();
const staffRoles = ['manager', 'waiter', 'chef', 'cashier', 'delivery', 'cleaner'];
router.use(requireAuth, allowRoles(...staffRoles));

router.get('/attendance', asyncHandler(async (request, response) => {
  response.json({ data: await Attendance.find({ employee: request.user._id }).sort({ date: -1 }).limit(366) });
}));

router.post('/attendance/check-in', asyncHandler(async (request, response) => {
  const date = new Date(); date.setHours(0, 0, 0, 0);
  const attendance = await Attendance.findOneAndUpdate(
    { employee: request.user._id, date },
    { $set: { employee: request.user._id, date, checkIn: new Date(), submittedBy: request.user._id, 'approval.status': 'pending' } },
    { new: true, upsert: true, runValidators: true }
  );
  response.json({ data: attendance });
}));

router.post('/attendance/check-out', asyncHandler(async (request, response) => {
  const date = new Date(); date.setHours(0, 0, 0, 0);
  const attendance = await Attendance.findOneAndUpdate({ employee: request.user._id, date, checkIn: { $exists: true } }, { checkOut: new Date() }, { new: true });
  if (!attendance) return response.status(400).json({ message: 'Check in before checking out' });
  response.json({ data: attendance });
}));

router.get('/leave', asyncHandler(async (request, response) => {
  response.json({ data: await LeaveRequest.find({ employee: request.user._id }).sort({ createdAt: -1 }).limit(100) });
}));

router.post('/leave', asyncHandler(async (request, response) => {
  const startDate = new Date(request.body.startDate); const endDate = new Date(request.body.endDate);
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime()) || endDate < startDate || !String(request.body.reason || '').trim()) return response.status(400).json({ message: 'Valid leave dates and reason are required' });
  const leave = await LeaveRequest.create({ employee: request.user._id, startDate, endDate, reason: request.body.reason.trim() });
  const approvers = await User.find({ role: { $in: ['manager', 'admin', 'owner'] }, isActive: true }).select('_id');
  if (approvers.length) await Notification.insertMany(approvers.map((approver) => ({ recipient: approver._id, type: 'leave', title: 'Leave request submitted', message: `${request.user.fullName} submitted a leave request`, referenceModel: 'LeaveRequest', referenceId: leave._id })));
  response.status(201).json({ data: leave });
}));

router.get('/salary', asyncHandler(async (request, response) => {
  response.json({ data: await SalaryPayment.find({ employee: request.user._id }).sort({ salaryMonth: -1 }).limit(24) });
}));

router.patch('/salary/:id/confirm', asyncHandler(async (request, response) => {
  const salary = await SalaryPayment.findOneAndUpdate({ _id: request.params.id, employee: request.user._id, status: 'awaiting_confirmation' }, { status: 'paid_confirmed', 'confirmation.confirmedAt': new Date() }, { new: true });
  if (!salary) return response.status(404).json({ message: 'Salary confirmation request not found' });
  response.json({ data: salary });
}));

router.patch('/salary/:id/report', asyncHandler(async (request, response) => {
  const salary = await SalaryPayment.findOneAndUpdate({ _id: request.params.id, employee: request.user._id }, { status: 'payment_disputed', 'confirmation.issue': String(request.body.issue || 'Payment issue reported') }, { new: true });
  if (!salary) return response.status(404).json({ message: 'Salary record not found' });
  response.json({ data: salary });
}));

router.patch('/password', asyncHandler(async (request, response) => {
  if (!request.body.currentPassword || !request.body.newPassword || request.body.newPassword.length < 8) return response.status(400).json({ message: 'Current and new passwords are required; new password must be 8 characters' });
  const user = await User.findById(request.user._id).select('+passwordHash');
  if (!user || !(await bcrypt.compare(request.body.currentPassword, user.passwordHash))) return response.status(400).json({ message: 'Current password is incorrect' });
  user.passwordHash = await bcrypt.hash(request.body.newPassword, 12); user.mustChangePassword = false; await user.save();
  response.json({ message: 'Password changed successfully' });
}));

router.get('/notifications', asyncHandler(async (request, response) => {
  response.json({ data: await Notification.find({ recipient: request.user._id }).sort({ createdAt: -1 }).limit(100) });
}));

router.get('/activity', asyncHandler(async (request, response) => {
  response.json({ data: await ActivityLog.find({ actor: request.user._id }).sort({ createdAt: -1 }).limit(100) });
}));

export default router;
