import express from 'express';
import bcrypt from 'bcryptjs';
import { asyncHandler } from '../utils/asyncHandler.js';
import { allowRoles, requireAuth } from '../middlewares/auth.js';
import {
  ActivityLog, Attendance, Counter, Invoice, Notification, Order, Payment,
  SalaryPayment, User
} from '../models/index.js';

const router = express.Router();
router.use(requireAuth, allowRoles('cashier', 'manager', 'admin', 'owner'));
function dayStart() {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date;
}

async function paidAmount(orderId) {
  const result = await Payment.aggregate([
    { $match: { order: orderId, status: 'successful' } },
    { $group: { _id: null, total: { $sum: '$amount' } } }
  ]);
  return Number(result[0]?.total || 0);
}

async function ensureInvoice(order, cashierId) {
  let invoice = await Invoice.findOne({ order: order._id });
  if (invoice) return invoice;
  const counter = await Counter.findOneAndUpdate({ _id: 'invoice' }, { $inc: { sequence: 1 } }, { new: true, upsert: true });
  invoice = await Invoice.create({
    invoiceNumber: `INV-${String(counter.sequence).padStart(6, '0')}`,
    order: order._id,
    generatedBy: cashierId,
    subtotal: order.subtotal,
    discount: order.discount,
    tax: order.tax,
    serviceCharge: order.serviceCharge,
    total: order.total
  });
  await ActivityLog.create({ actor: cashierId, actorRole: 'cashier', action: 'invoice_created', resourceType: 'Invoice', resourceId: invoice._id });
  return invoice;
}

router.get('/overview', asyncHandler(async (request, response) => {
  const start = dayStart();
  const [bills, payments, paidBills, partialBills, unpaidBills, attendance, salary, notifications] = await Promise.all([
    Order.countDocuments({ createdAt: { $gte: start } }),
    Payment.aggregate([{ $match: { receivedBy: request.user._id, status: 'successful', createdAt: { $gte: start } } }, { $group: { _id: null, total: { $sum: '$amount' } } }]),
    Order.countDocuments({ paymentStatus: 'paid', createdAt: { $gte: start } }),
    Order.countDocuments({ paymentStatus: 'partially_paid', createdAt: { $gte: start } }),
    Order.countDocuments({ paymentStatus: 'unpaid', createdAt: { $gte: start } }),
    Attendance.findOne({ employee: request.user._id, date: { $gte: start } }),
    SalaryPayment.findOne({ employee: request.user._id }).sort({ salaryMonth: -1 }),
    Notification.find({ recipient: request.user._id }).sort({ createdAt: -1 }).limit(5)
  ]);
  response.json({ data: { bills, revenue: payments[0]?.total || 0, paidBills, partialBills, unpaidBills, attendance, salary, notifications } });
}));

router.get('/orders', asyncHandler(async (request, response) => {
  const filter = { $or: [{ status: 'served' }, { status: 'completed', paymentStatus: { $in: ['unpaid', 'partially_paid'] } }] };
  if (request.query.search) filter.orderNumber = { $regex: request.query.search, $options: 'i' };
  if (request.query.paymentStatus) filter.paymentStatus = request.query.paymentStatus;
  const orders = await Order.find(filter).sort({ createdAt: -1 }).limit(100).populate('table', 'name').populate('createdBy', 'fullName');
  const data = await Promise.all(orders.map(async (order) => {
    const paid = await paidAmount(order._id);
    if (paid >= Number(order.total) && order.paymentStatus !== 'paid') {
      order.paymentStatus = 'paid';
      order.status = 'completed';
      await order.save();
    }
    return { ...order.toObject(), paidAmount: paid };
  }));
  response.json({ data });
}));

router.get('/online-orders', asyncHandler(async (request, response) => {
  const status = request.query.status || 'pending';
  const approvalFilter = status === 'pending'
    ? { $or: [{ onlineApproval: 'pending' }, { onlineApproval: { $exists: false } }] }
    : { onlineApproval: status };
  const filter = { type: 'online', ...approvalFilter };
  const orders = await Order.find(filter).sort({ createdAt: 1 }).limit(100)
    .populate('customer', 'fullName phone email').populate('createdBy', 'fullName');
  response.json({ data: orders });
}));

router.patch('/online-orders/:id/approve', asyncHandler(async (request, response) => {
  const order = await Order.findOneAndUpdate(
    { _id: request.params.id, type: 'online', $or: [{ onlineApproval: 'pending' }, { onlineApproval: { $exists: false } }] },
    { onlineApproval: 'approved', onlineApprovedBy: request.user._id, onlineApprovedAt: new Date(), status: 'pending' },
    { new: true, runValidators: true }
  );
  if (!order) return response.status(404).json({ message: 'Pending online order not found' });
  if (order.customer) {
    await Notification.create({ recipient: order.customer, type: 'order', title: 'Order confirmed', message: `Your order ${order.orderNumber} was confirmed and sent to the kitchen`, referenceModel: 'Order', referenceId: order._id });
  }
  await ActivityLog.create({ actor: request.user._id, actorRole: request.user.role, action: 'online_order_approved', resourceType: 'Order', resourceId: order._id });
  response.json({ data: order });
}));

router.patch('/online-orders/:id/reject', asyncHandler(async (request, response) => {
  const reason = String(request.body.reason || 'Unable to confirm this order').trim();
  const order = await Order.findOneAndUpdate(
    { _id: request.params.id, type: 'online', $or: [{ onlineApproval: 'pending' }, { onlineApproval: { $exists: false } }] },
    { onlineApproval: 'rejected', onlineRejectionReason: reason, status: 'cancelled', cancellationReason: reason },
    { new: true, runValidators: true }
  );
  if (!order) return response.status(404).json({ message: 'Pending online order not found' });
  if (order.customer) {
    await Notification.create({ recipient: order.customer, type: 'order', title: 'Order could not be confirmed', message: `${order.orderNumber}: ${reason}`, referenceModel: 'Order', referenceId: order._id });
  }
  await ActivityLog.create({ actor: request.user._id, actorRole: request.user.role, action: 'online_order_rejected', resourceType: 'Order', resourceId: order._id, metadata: { reason } });
  response.json({ data: order });
}));

router.get('/payments', asyncHandler(async (_request, response) => {
  const payments = await Payment.find().sort({ createdAt: -1 }).limit(100).populate('order', 'orderNumber total').populate('receivedBy', 'fullName');
  response.json({ data: payments });
}));

router.get('/invoices', asyncHandler(async (request, response) => {
  const filter = request.query.search ? { invoiceNumber: { $regex: request.query.search, $options: 'i' } } : {};
  const invoices = await Invoice.find(filter).sort({ createdAt: -1 }).limit(100).populate('order', 'orderNumber total paymentStatus').populate('generatedBy', 'fullName');
  response.json({ data: invoices });
}));

router.post('/invoices/:orderId', asyncHandler(async (request, response) => {
  const order = await Order.findById(request.params.orderId);
  if (!order) return response.status(404).json({ message: 'Order not found' });
  let invoice = await Invoice.findOne({ order: order._id });
  if (!invoice) {
    invoice = await ensureInvoice(order, request.user._id);
  }
  response.status(201).json({ data: await invoice.populate('order', 'orderNumber total items') });
}));

router.post('/invoices/:id/print', asyncHandler(async (request, response) => {
  const invoice = await Invoice.findById(request.params.id);
  if (!invoice) return response.status(404).json({ message: 'Invoice not found' });
  const isReprint = Boolean(invoice.printedAt);
  invoice.printedAt = new Date();
  if (isReprint) invoice.reprintCount += 1;
  await invoice.save();
  await ActivityLog.create({ actor: request.user._id, actorRole: request.user.role, action: isReprint ? 'invoice_reprinted' : 'invoice_printed', resourceType: 'Invoice', resourceId: invoice._id, metadata: { printerWidth: request.body.printerWidth || 80 } });
  response.json({ data: invoice });
}));

router.get('/activity', asyncHandler(async (request, response) => {
  response.json({ data: await ActivityLog.find({ actor: request.user._id }).sort({ createdAt: -1 }).limit(100) });
}));

router.post('/orders/:id/pay', asyncHandler(async (request, response) => {
  const { amount, method, notes } = request.body;
  const validMethods = ['cash', 'bank_transfer', 'mobile_banking'];
  const order = await Order.findOne({ _id: request.params.id, status: { $in: ['served', 'completed'] }, paymentStatus: { $in: ['unpaid', 'partially_paid'] }, $or: [{ type: { $ne: 'online' } }, { type: 'online', deliveryStatus: { $in: ['handed_to_cashier', 'not_required'] } }] });
  if (!order) return response.status(404).json({ message: 'Served order not found' });
  const paymentAmount = Number(amount);
  if (!Number.isFinite(paymentAmount) || paymentAmount <= 0) {
    if (remaining <= 0) {
      order.paymentStatus = 'paid';
      order.status = 'completed';
      await order.save();
      const invoice = await ensureInvoice(order, request.user._id);
      return response.json({ data: { order, invoice, paidAmount: currentPaid, remaining: 0 } });
    }
    return response.status(400).json({ message: 'Enter a payment amount greater than 0' });
  }
  const currentPaid = await paidAmount(order._id);
  const remaining = Number((order.total - currentPaid).toFixed(2));
  if (remaining <= 0) {
    order.paymentStatus = 'paid';
    order.status = 'completed';
    await order.save();
    const invoice = await ensureInvoice(order, request.user._id);
    return response.json({ data: { order, invoice, paidAmount: currentPaid, remaining: 0 } });
  }
  if (!validMethods.includes(method)) return response.status(400).json({ message: 'Select a valid payment method' });
  if (!Number.isFinite(paymentAmount) || paymentAmount <= 0 || paymentAmount > remaining) return response.status(400).json({ message: `Payment must be greater than 0 and no more than ৳${remaining.toFixed(2)}` });
  const payment = await Payment.create({ order: order._id, amount: paymentAmount, method, notes, status: 'successful', receivedBy: request.user._id });
  const nextPaid = Number((currentPaid + paymentAmount).toFixed(2));
  order.paymentStatus = nextPaid >= order.total ? 'paid' : 'partially_paid';
  if (order.paymentStatus === 'paid') order.status = 'completed';
  await order.save();
  const invoice = order.paymentStatus === 'paid' ? await ensureInvoice(order, request.user._id) : null;
  await ActivityLog.create({ actor: request.user._id, actorRole: request.user.role, action: 'payment_received', resourceType: 'Order', resourceId: order._id, metadata: { amount: paymentAmount, method } });
  response.status(201).json({ data: { order, payment, invoice, paidAmount: nextPaid, remaining: Math.max(order.total - nextPaid, 0) } });
}));

router.patch('/orders/:id/receive-delivery', asyncHandler(async (request, response) => {
  const order = await Order.findOne({ _id: request.params.id, type: 'online', deliveryStatus: 'cash_collected', status: 'served' });
  if (!order) return response.status(404).json({ message: 'Cash collection request not found' });
  const alreadyPaid = await paidAmount(order._id);
  if (alreadyPaid < order.total) {
    await Payment.create({ order: order._id, amount: Number((order.total - alreadyPaid).toFixed(2)), method: 'cash', status: 'successful', receivedBy: request.user._id, notes: 'Cash received from delivery staff' });
  }
  order.deliveryStatus = 'handed_to_cashier';
  order.cashHandedToCashierAt = new Date();
  order.cashHandedToCashierBy = request.user._id;
  order.paymentStatus = 'paid';
  order.status = 'completed';
  await order.save();
  const invoice = await ensureInvoice(order, request.user._id);
  await ActivityLog.create({ actor: request.user._id, actorRole: request.user.role, action: 'delivery_cash_received', resourceType: 'Order', resourceId: order._id });
  response.json({ data: { order, invoice } });
}));

router.get('/attendance', asyncHandler(async (request, response) => {
  response.json({ data: await Attendance.find({ employee: request.user._id }).sort({ date: -1 }).limit(60) });
}));

router.post('/attendance/check-in', asyncHandler(async (request, response) => {
  const now = new Date();
  const date = dayStart();
  const attendance = await Attendance.findOneAndUpdate(
    { employee: request.user._id, date },
    { $setOnInsert: { employee: request.user._id, date, submittedBy: request.user._id }, $set: { checkIn: now, status: 'present' } },
    { new: true, upsert: true, runValidators: true }
  );
  response.json({ data: attendance });
}));

router.post('/attendance/check-out', asyncHandler(async (request, response) => {
  const attendance = await Attendance.findOneAndUpdate({ employee: request.user._id, date: { $gte: dayStart() } }, { checkOut: new Date() }, { new: true, runValidators: true });
  if (!attendance) return response.status(400).json({ message: 'Check in before checking out' });
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
  response.json({ data: salary });
}));

router.patch('/salary/:id/report', asyncHandler(async (request, response) => {
  const salary = await SalaryPayment.findOne({ _id: request.params.id, employee: request.user._id });
  if (!salary) return response.status(404).json({ message: 'Salary record not found' });
  salary.status = 'payment_disputed';
  salary.confirmation = { issue: String(request.body.issue || 'Payment issue reported') };
  await salary.save();
  response.json({ data: salary });
}));

router.get('/notifications', asyncHandler(async (request, response) => {
  response.json({ data: await Notification.find({ recipient: request.user._id }).sort({ createdAt: -1 }).limit(50) });
}));

router.patch('/notifications/:id/read', asyncHandler(async (request, response) => {
  const notification = await Notification.findOneAndUpdate({ _id: request.params.id, recipient: request.user._id }, { isRead: true, readAt: new Date() }, { new: true });
  if (!notification) return response.status(404).json({ message: 'Notification not found' });
  response.json({ data: notification });
}));

router.patch('/profile', asyncHandler(async (request, response) => {
  const updates = {};
  if (request.body.fullName?.trim()) updates.fullName = request.body.fullName.trim();
  if (request.body.phone !== undefined) updates.phone = request.body.phone;
  const user = await User.findByIdAndUpdate(request.user._id, updates, { new: true, runValidators: true });
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
  response.json({ message: 'Password changed successfully' });
}));

export default router;
