import express from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import { allowRoles, requireAuth } from '../middlewares/auth.js';
import { Attendance, Expense, LeaveRequest, Order, Reservation, RestaurantTable, SalaryPayment, User, InventoryItem, InventoryMovement, Purchase, ActivityLog, Notification } from '../models/index.js';

const router = express.Router();
router.use(requireAuth, allowRoles('manager', 'admin', 'owner'));

router.get('/dashboard', asyncHandler(async (_request, response) => {
  const start = new Date(); start.setHours(0, 0, 0, 0);
  const [orders, revenue, expenses, reservations, availableTables, occupiedTables, employees, present, pendingAttendance, lowStock, recentOrders, recentReservations] = await Promise.all([
    Order.countDocuments({ createdAt: { $gte: start } }),
    Order.aggregate([{ $match: { createdAt: { $gte: start }, paymentStatus: 'paid' } }, { $group: { _id: null, total: { $sum: '$total' } } }]),
    Expense.aggregate([{ $match: { expenseDate: { $gte: start } } }, { $group: { _id: null, total: { $sum: '$amount' } } }]),
    Reservation.countDocuments({ status: { $in: ['pending', 'confirmed', 'seated'] } }),
    RestaurantTable.countDocuments({ status: 'available', isActive: true }),
    RestaurantTable.countDocuments({ status: 'occupied', isActive: true }),
    User.countDocuments({ role: { $in: ['manager', 'waiter', 'chef', 'cashier', 'delivery', 'cleaner'] }, isActive: true }),
    Attendance.countDocuments({ date: { $gte: start }, status: { $in: ['present', 'late'] }, 'approval.status': 'approved' }),
    Attendance.countDocuments({ 'approval.status': 'pending' }),
    InventoryItem.countDocuments({ $expr: { $lte: ['$quantity', '$lowStockThreshold'] }, isActive: true }),
    Order.find().sort({ createdAt: -1 }).limit(8).populate('customer', 'fullName'),
    Reservation.find({ status: { $in: ['pending', 'confirmed', 'seated'] } }).sort({ date: 1 }).limit(8).populate('table', 'name')
  ]);
  response.json({ data: { totals: { orders, revenue: revenue[0]?.total || 0, expenses: expenses[0]?.total || 0, netSales: (revenue[0]?.total || 0) - (expenses[0]?.total || 0), reservations, availableTables, occupiedTables, employees, present, absent: Math.max(employees - present, 0), pendingAttendance, lowStock }, recentOrders, recentReservations } });
}));

router.get('/attendance/requests', asyncHandler(async (request, response) => {
  response.json({ data: await Attendance.find({ 'approval.status': request.query.status || 'pending', employee: { $ne: request.user._id } }).sort({ date: -1 }).limit(200).populate('employee', 'fullName role employeeId') });
}));

router.patch('/attendance/:id/approve', asyncHandler(async (request, response) => {
  const attendance = await Attendance.findOneAndUpdate({ _id: request.params.id, employee: { $ne: request.user._id }, 'approval.status': 'pending' }, { 'approval.status': 'approved', 'approval.approvedBy': request.user._id, 'approval.approverRole': request.user.role, 'approval.approvedAt': new Date() }, { new: true });
  if (!attendance) return response.status(404).json({ message: 'Pending attendance request not found' });
  await Notification.create({ recipient: attendance.employee, type: 'attendance', title: 'Attendance approved', message: 'Your attendance request was approved', referenceModel: 'Attendance', referenceId: attendance._id });
  await ActivityLog.create({ actor: request.user._id, actorRole: request.user.role, action: 'attendance_approved', resourceType: 'Attendance', resourceId: attendance._id });
  response.json({ data: attendance });
}));

router.patch('/attendance/:id/reject', asyncHandler(async (request, response) => {
  const reason = String(request.body.reason || '').trim();
  if (!reason) return response.status(400).json({ message: 'Rejection reason is required' });
  const attendance = await Attendance.findOneAndUpdate({ _id: request.params.id, employee: { $ne: request.user._id }, 'approval.status': 'pending' }, { 'approval.status': 'rejected', 'approval.approvedBy': request.user._id, 'approval.approverRole': request.user.role, 'approval.approvedAt': new Date(), 'approval.rejectionReason': reason }, { new: true });
  if (!attendance) return response.status(404).json({ message: 'Pending attendance request not found' });
  response.json({ data: attendance });
}));

router.get('/leave', asyncHandler(async (request, response) => {
  const filter = request.query.status ? { status: request.query.status } : {};
  response.json({ data: await LeaveRequest.find(filter).sort({ createdAt: -1 }).limit(200).populate('employee', 'fullName role employeeId') });
}));

router.patch('/leave/:id/review', asyncHandler(async (request, response) => {
  const status = request.body.status;
  if (!['approved', 'rejected'].includes(status)) return response.status(400).json({ message: 'Status must be approved or rejected' });
  const update = { status, reviewedBy: request.user._id, reviewerRole: request.user.role, reviewedAt: new Date() };
  if (status === 'rejected') update.rejectionReason = String(request.body.reason || '').trim() || 'Leave request rejected';
  const leave = await LeaveRequest.findOneAndUpdate({ _id: request.params.id, status: 'pending' }, update, { new: true });
  if (!leave) return response.status(404).json({ message: 'Pending leave request not found' });
  await Notification.create({ recipient: leave.employee, type: 'leave', title: `Leave ${status}`, message: status === 'approved' ? 'Your leave request was approved' : update.rejectionReason, referenceModel: 'LeaveRequest', referenceId: leave._id });
  response.json({ data: leave });
}));

router.post('/salary/generate', asyncHandler(async (request, response) => {
  const month = String(request.body.salaryMonth || '').trim();
  const basicSalary = Number(request.body.basicSalary);
  if (!/^\d{4}-\d{2}$/.test(month) || !Number.isFinite(basicSalary) || basicSalary < 0) return response.status(400).json({ message: 'salaryMonth and valid basicSalary are required' });
  const start = new Date(`${month}-01T00:00:00.000Z`); const end = new Date(start); end.setMonth(end.getMonth() + 1);
  const employees = await User.find({ role: { $in: ['manager', 'waiter', 'chef', 'cashier', 'delivery', 'cleaner'] }, isActive: true }).select('_id role');
  const records = [];
  for (const employee of employees) {
    const [absent, leave] = await Promise.all([
      Attendance.countDocuments({ employee: employee._id, date: { $gte: start, $lt: end }, status: 'absent', 'approval.status': 'approved' }),
      Attendance.countDocuments({ employee: employee._id, date: { $gte: start, $lt: end }, status: 'leave', 'approval.status': 'approved' })
    ]);
    const deduction = Number(((basicSalary / 30) * (absent + leave)).toFixed(2));
    records.push(await SalaryPayment.findOneAndUpdate({ employee: employee._id, salaryMonth: month }, { employee: employee._id, designation: employee.role, basicSalary, deductions: deduction, totalPayable: Math.max(basicSalary - deduction, 0), enteredBy: request.user._id, status: 'unpaid' }, { upsert: true, new: true, setDefaultsOnInsert: true }));
  }
  response.status(201).json({ data: records });
}));

router.patch('/reservations/:id/assign-table', asyncHandler(async (request, response) => {
  const reservation = await Reservation.findById(request.params.id);
  const table = await RestaurantTable.findOne({ _id: request.body.table, isActive: true, status: { $in: ['available', 'reserved'] }, capacity: { $gte: reservation?.guestCount || 0 } });
  if (!reservation || !table) return response.status(404).json({ message: 'Reservation or suitable available table not found' });
  reservation.table = table._id; reservation.status = 'confirmed'; reservation.managedBy = request.user._id; await reservation.save();
  table.status = 'reserved'; await table.save();
  response.json({ data: await reservation.populate('table', 'name capacity') });
}));

router.patch('/reservations/:id/status', asyncHandler(async (request, response) => {
  const reservation = await Reservation.findById(request.params.id);
  if (!reservation || !['pending', 'confirmed', 'seated', 'completed', 'cancelled', 'no_show'].includes(request.body.status)) return response.status(400).json({ message: 'Invalid reservation or status' });
  reservation.status = request.body.status; reservation.managedBy = request.user._id; if (request.body.status === 'cancelled') reservation.cancellationReason = String(request.body.reason || 'Cancelled by manager');
  await reservation.save();
  if (reservation.table && ['completed', 'cancelled', 'no_show'].includes(reservation.status)) await RestaurantTable.findByIdAndUpdate(reservation.table, { status: 'available' });
  response.json({ data: reservation });
}));

router.get('/inventory/items', asyncHandler(async (request, response) => {
  const filter = request.query.lowStock === 'true' ? { $expr: { $lte: ['$quantity', '$lowStockThreshold'] }, isActive: true } : {};
  response.json({ data: await InventoryItem.find(filter).sort({ name: 1 }) });
}));

router.post('/inventory/items', asyncHandler(async (request, response) => {
  response.status(201).json({ data: await InventoryItem.create(request.body) });
}));

router.patch('/inventory/items/:id', asyncHandler(async (request, response) => {
  const item = await InventoryItem.findByIdAndUpdate(request.params.id, request.body, { new: true, runValidators: true });
  if (!item) return response.status(404).json({ message: 'Inventory item not found' });
  response.json({ data: item });
}));

router.delete('/inventory/items/:id', asyncHandler(async (request, response) => {
  const item = await InventoryItem.findByIdAndUpdate(request.params.id, { isActive: false }, { new: true });
  if (!item) return response.status(404).json({ message: 'Inventory item not found' });
  response.json({ data: item });
}));

router.get('/inventory/movements', asyncHandler(async (_request, response) => {
  response.json({ data: await InventoryMovement.find().sort({ createdAt: -1 }).limit(100).populate('item', 'name unit').populate('createdBy', 'fullName') });
}));

router.post('/inventory/movements', asyncHandler(async (request, response) => {
  const amount = Number(request.body.quantity);
  if (!request.body.item || !['stock_in', 'stock_out', 'adjustment'].includes(request.body.type) || !Number.isFinite(amount) || amount <= 0) return response.status(400).json({ message: 'Valid item, movement type and quantity are required' });
  const item = await InventoryItem.findById(request.body.item);
  if (!item) return response.status(404).json({ message: 'Inventory item not found' });
  const nextQuantity = request.body.type === 'stock_in' ? item.quantity + amount : request.body.type === 'stock_out' ? item.quantity - amount : amount;
  if (nextQuantity < 0) return response.status(400).json({ message: 'Stock cannot become negative' });
  item.quantity = nextQuantity; await item.save();
  const movement = await InventoryMovement.create({ item: item._id, type: request.body.type, quantity: amount, unit: item.unit, source: request.body.source || 'manual', notes: request.body.notes, createdBy: request.user._id });
  response.status(201).json({ data: { item, movement } });
}));

router.get('/inventory/purchases', asyncHandler(async (_request, response) => {
  response.json({ data: await Purchase.find().sort({ purchaseDate: -1 }).limit(100).populate('item', 'name unit').populate('createdBy', 'fullName') });
}));

router.post('/inventory/purchases', asyncHandler(async (request, response) => {
  const item = await InventoryItem.findById(request.body.item);
  const quantity = Number(request.body.quantity); const unitPrice = Number(request.body.unitPrice);
  if (!item || !Number.isFinite(quantity) || quantity <= 0 || !Number.isFinite(unitPrice) || unitPrice < 0) return response.status(400).json({ message: 'Valid item, quantity and unit price are required' });
  const purchase = await Purchase.create({ ...request.body, item: item._id, itemName: item.name, category: item.category, unit: item.unit, quantity, unitPrice, totalAmount: quantity * unitPrice, createdBy: request.user._id });
  item.quantity += quantity; item.costPerUnit = unitPrice; await item.save();
  await InventoryMovement.create({ item: item._id, type: 'stock_in', quantity, unit: item.unit, source: 'purchase', reference: purchase._id, createdBy: request.user._id });
  response.status(201).json({ data: purchase });
}));

router.get('/inventory/expenses', asyncHandler(async (_request, response) => {
  response.json({ data: await Expense.find().sort({ expenseDate: -1 }).limit(100).populate('createdBy', 'fullName') });
}));

router.post('/inventory/expenses', asyncHandler(async (request, response) => {
  response.status(201).json({ data: await Expense.create({ ...request.body, amount: Number(request.body.amount), createdBy: request.user._id }) });
}));

export default router;
