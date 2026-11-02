import express from 'express';
import bcrypt from 'bcryptjs';
import { profileUpload } from '../config/uploads.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { allowRoles, requireAuth } from '../middlewares/auth.js';
import {
  ActivityLog, Attendance, Expense, FoodCategory, FoodItem, Floor, InventoryItem,
  Invoice, Notification, Order, Payment, PerformanceRecord, Purchase, RestaurantSettings,
  RestaurantTable, Reservation, SalaryPayment, Staff, Manager, User, Counter,
  InventoryMovement, LeaveRequest
} from '../models/index.js';

const router = express.Router();
router.use(requireAuth, allowRoles('admin', 'owner'));

router.get('/dashboard', asyncHandler(async (_request, response) => {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const [
    totalOrders, todayOrders, revenue, expenses, totalCustomers, totalEmployees,
    reservations, availableTables, occupiedTables, recentOrders
  ] = await Promise.all([
    Order.countDocuments(),
    Order.countDocuments({ createdAt: { $gte: start } }),
    Payment.aggregate([
      { $match: { status: 'successful' } },
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ]),
    Expense.aggregate([
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ]),
    User.countDocuments({ role: 'customer', isActive: true }),
    User.countDocuments({ role: { $in: ['manager', 'waiter', 'chef', 'cashier', 'delivery', 'cleaner'] }, isActive: true }),
    Reservation.countDocuments({ status: { $in: ['pending', 'confirmed', 'seated'] } }),
    RestaurantTable.countDocuments({ status: 'available', isActive: true }),
    RestaurantTable.countDocuments({ status: 'occupied', isActive: true }),
    Order.find().sort({ createdAt: -1 }).limit(8).populate('customer', 'fullName')
  ]);
  response.json({
    data: {
      totals: {
        orders: totalOrders,
        todayOrders,
        revenue: revenue[0]?.total || 0,
        expenses: expenses[0]?.total || 0,
        profit: (revenue[0]?.total || 0) - (expenses[0]?.total || 0),
        customers: totalCustomers,
        employees: totalEmployees,
        reservations,
        availableTables,
        occupiedTables
      },
      recentOrders
    }
  });
}));

router.get('/analytics', asyncHandler(async (request, response) => {
  const days = Math.min(Math.max(Number(request.query.days) || 30, 7), 366);
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - days + 1);
  const [sales, orders, topItems, investments] = await Promise.all([
    Payment.aggregate([
      { $match: { status: 'successful', createdAt: { $gte: start } } },
      { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, revenue: { $sum: '$amount' }, payments: { $sum: 1 } } },
      { $sort: { _id: 1 } }
    ]),
    Order.aggregate([
      { $match: { createdAt: { $gte: start } } },
      { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, orders: { $sum: 1 } } },
      { $sort: { _id: 1 } }
    ]),
    Order.aggregate([
      { $match: { createdAt: { $gte: start }, status: { $nin: ['cancelled'] } } },
      { $unwind: '$items' },
      { $group: { _id: '$items.foodItem', name: { $first: '$items.name' }, quantity: { $sum: '$items.quantity' }, revenue: { $sum: { $multiply: ['$items.quantity', '$items.unitPrice'] } } } },
      { $sort: { quantity: -1 } },
      { $limit: 10 }
    ]),
    Expense.aggregate([{ $group: { _id: null, total: { $sum: '$amount' } } }])
  ]);
  response.json({ data: { days, sales, orders, topItems, expenses: investments[0]?.total || 0 } });
}));

router.get('/orders/:id', asyncHandler(async (request, response) => {
  const order = await Order.findById(request.params.id)
    .populate('customer', 'fullName email phone').populate('createdBy', 'fullName role')
    .populate('table', 'name capacity').populate('kitchenEvents.staff', 'fullName role');
  if (!order) return response.status(404).json({ message: 'Order not found' });
  response.json({ data: order });
}));

router.patch('/orders/:id/cancel', asyncHandler(async (request, response) => {
  const order = await Order.findById(request.params.id);
  if (!order) return response.status(404).json({ message: 'Order not found' });
  if (['completed', 'cancelled'].includes(order.status)) return response.status(400).json({ message: 'This order cannot be cancelled' });
  order.status = 'cancelled';
  order.cancellationReason = String(request.body.reason || 'Cancelled by administrator');
  await order.save();
  if (order.table) await RestaurantTable.findByIdAndUpdate(order.table, { status: 'available' });
  await ActivityLog.create({ actor: request.user._id, actorRole: request.user.role, action: 'admin_order_cancelled', resourceType: 'Order', resourceId: order._id, metadata: { reason: order.cancellationReason } });
  response.json({ data: order });
}));

router.get('/attendance/requests', asyncHandler(async (request, response) => {
  const filter = { 'approval.status': request.query.status || 'pending' };
  response.json({ data: await Attendance.find(filter).sort({ date: -1 }).limit(200).populate('employee', 'fullName role employeeId') });
}));

router.get('/leave/requests', asyncHandler(async (request, response) => {
  const filter = request.query.status ? { status: request.query.status } : {};
  response.json({ data: await LeaveRequest.find(filter).sort({ createdAt: -1 }).limit(200).populate('employee', 'fullName role employeeId') });
}));

router.patch('/attendance/:id/approve', asyncHandler(async (request, response) => {
  const attendance = await Attendance.findByIdAndUpdate(request.params.id, { approval: { status: 'approved', approvedBy: request.user._id, approverRole: request.user.role, approvedAt: new Date() } }, { new: true, runValidators: true });
  if (!attendance) return response.status(404).json({ message: 'Attendance record not found' });
  await Notification.create({ recipient: attendance.employee, type: 'attendance', title: 'Attendance approved', message: `Your attendance for ${attendance.date.toLocaleDateString()} was approved`, referenceModel: 'Attendance', referenceId: attendance._id });
  response.json({ data: attendance });
}));

router.patch('/attendance/:id/reject', asyncHandler(async (request, response) => {
  const reason = String(request.body.reason || '').trim();
  if (!reason) return response.status(400).json({ message: 'Rejection reason is required' });
  const attendance = await Attendance.findByIdAndUpdate(request.params.id, { approval: { status: 'rejected', approvedBy: request.user._id, approverRole: request.user.role, approvedAt: new Date(), rejectionReason: reason } }, { new: true, runValidators: true });
  if (!attendance) return response.status(404).json({ message: 'Attendance record not found' });
  await Notification.create({ recipient: attendance.employee, type: 'attendance', title: 'Attendance rejected', message: reason, referenceModel: 'Attendance', referenceId: attendance._id });
  response.json({ data: attendance });
}));

router.get('/attendance/sheet', asyncHandler(async (request, response) => {
  const start = request.query.month ? new Date(`${request.query.month}-01T00:00:00.000Z`) : new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  const end = new Date(start); end.setMonth(end.getMonth() + 1);
  const records = await Attendance.find({ date: { $gte: start, $lt: end } }).sort({ date: -1 }).populate('employee', 'fullName role employeeId');
  response.json({ data: records });
}));

router.get('/salary/records', asyncHandler(async (request, response) => {
  const filter = request.query.month ? { salaryMonth: request.query.month } : {};
  response.json({ data: await SalaryPayment.find(filter).sort({ salaryMonth: -1 }).populate('employee', 'fullName role employeeId').populate('enteredBy', 'fullName') });
}));

router.post('/salary/generate', asyncHandler(async (request, response) => {
  const month = String(request.body.salaryMonth || '').trim();
  if (!/^\d{4}-\d{2}$/.test(month)) return response.status(400).json({ message: 'A valid salary month is required' });
  const start = new Date(`${month}-01T00:00:00.000Z`); const end = new Date(start); end.setMonth(end.getMonth() + 1);
  const employees = await User.find({ role: { $in: staffRoles }, isActive: true }).select('_id role salaryAmount');
  const records = [];
  for (const employee of employees) {
    const basicSalary = Number(employee.salaryAmount || 0);
    const absent = await Attendance.countDocuments({ employee: employee._id, date: { $gte: start, $lt: end }, status: { $in: ['absent', 'leave'] }, 'approval.status': 'approved' });
    const deductions = Number(((basicSalary / 30) * absent).toFixed(2));
    records.push(await SalaryPayment.findOneAndUpdate({ employee: employee._id, salaryMonth: month }, { employee: employee._id, designation: employee.role, basicSalary, deductions, totalPayable: Math.max(basicSalary - deductions, 0), enteredBy: request.user._id, status: 'unpaid' }, { upsert: true, new: true, setDefaultsOnInsert: true }));
  }
  response.status(201).json({ data: records });
}));

router.patch('/salary/:id/pay', asyncHandler(async (request, response) => {
  const amount = Number(request.body.paymentAmount);
  if (!Number.isFinite(amount) || amount < 0) return response.status(400).json({ message: 'Valid payment amount is required' });
  const salary = await SalaryPayment.findByIdAndUpdate(request.params.id, { paymentAmount: amount, paymentDate: new Date(), paymentMethod: request.body.paymentMethod || 'cash', paymentReference: request.body.paymentReference, status: 'awaiting_confirmation', enteredBy: request.user._id }, { new: true, runValidators: true });
  if (!salary) return response.status(404).json({ message: 'Salary record not found' });
  await Notification.create({ recipient: salary.employee, type: 'salary', title: 'Salary payment confirmation', message: `Salary payment of ৳${amount.toFixed(2)} is ready for confirmation`, referenceModel: 'SalaryPayment', referenceId: salary._id });
  response.json({ data: salary });
}));

router.get('/performance', asyncHandler(async (request, response) => {
  const filter = {};
  if (request.query.employee) filter.employee = request.query.employee;
  response.json({ data: await PerformanceRecord.find(filter).sort({ periodEnd: -1 }).limit(200).populate('employee', 'fullName role employeeId').populate('evaluatedBy', 'fullName') });
}));

const staffRoles = ['manager', 'waiter', 'chef', 'cashier', 'delivery', 'cleaner'];
const staffPrefixes = {
  manager: 'MGR',
  waiter: 'WTR',
  chef: 'CHF',
  cashier: 'CSH',
  delivery: 'DLV',
  cleaner: 'CLN'
};

async function generateEmployeeId(role) {
  const counter = await Counter.findOneAndUpdate(
    { _id: `employee-${role}` },
    { $inc: { sequence: 1 } },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  );
  return `${staffPrefixes[role]}-${String(counter.sequence).padStart(4, '0')}`;
}

router.get('/staff', asyncHandler(async (request, response) => {
  const page = Math.max(Number(request.query.page) || 1, 1);
  const limit = Math.min(Math.max(Number(request.query.limit) || 50, 1), 100);
  const filter = { role: { $in: staffRoles } };
  if (request.query.role && staffRoles.includes(request.query.role)) filter.role = request.query.role;
  if (request.query.isActive !== undefined) filter.isActive = request.query.isActive === 'true';
  if (request.query.search) {
    filter.$or = [
      { fullName: { $regex: request.query.search, $options: 'i' } },
      { email: { $regex: request.query.search, $options: 'i' } },
      { phone: { $regex: request.query.search, $options: 'i' } },
      { employeeId: { $regex: request.query.search, $options: 'i' } }
    ];
  }
  const [items, total] = await Promise.all([
    User.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit),
    User.countDocuments(filter)
  ]);
  response.json({ data: items, pagination: { page, limit, total, pages: Math.ceil(total / limit) } });
}));

router.post('/staff', profileUpload.single('profilePicture'), asyncHandler(async (request, response) => {
  const {
    fullName, email, phone, password, role, employeeId,
    salaryAmount, joiningDate, address, permissions
  } = request.body;
  if (!fullName || !email || !password || !request.file || !staffRoles.includes(role)) {
    return response.status(400).json({
      message: 'fullName, email, password, profile picture and a valid staff role are required'
    });
  }
  const normalizedEmail = email.toLowerCase().trim();
  if (await User.exists({ email: normalizedEmail })) {
    return response.status(409).json({ message: 'Email is already in use' });
  }
  const normalizedEmployeeId = employeeId?.trim() || await generateEmployeeId(role);
  if (await User.exists({ employeeId: normalizedEmployeeId })) {
    return response.status(409).json({ message: 'Employee ID is already in use' });
  }
  const Model = role === 'manager' ? Manager : Staff;
  const staff = await Model.create({
    fullName, email: normalizedEmail, phone, profilePicture: `/uploads/profiles/${request.file.filename}`, role, designation: role,
    accountType: role === 'manager' ? 'manager' : 'staff',
    passwordHash: await bcrypt.hash(password, 12),
    employeeId: normalizedEmployeeId, salaryAmount, joiningDate, address, permissions,
    mustChangePassword: true
  });
  response.status(201).json({ data: staff });
}));

router.patch('/staff/:id', profileUpload.single('profilePicture'), asyncHandler(async (request, response) => {
  const allowedFields = ['fullName', 'phone', 'employeeId', 'salaryAmount', 'joiningDate', 'address', 'permissions', 'isActive'];
  const updates = {};
  for (const field of allowedFields) {
    if (request.body[field] !== undefined && (field !== 'employeeId' || request.body[field].trim())) {
      updates[field] = field === 'employeeId' ? request.body[field].trim() : request.body[field];
    }
  }
  if (request.file) updates.profilePicture = `/uploads/profiles/${request.file.filename}`;
  if (request.body.password) updates.passwordHash = await bcrypt.hash(request.body.password, 12);
  if (!Object.keys(updates).length) return response.status(400).json({ message: 'No editable staff fields were provided' });
  const staff = await User.findOneAndUpdate(
    { _id: request.params.id, role: { $in: staffRoles } },
    updates,
    { new: true, runValidators: true }
  );
  if (!staff) return response.status(404).json({ message: 'Staff member not found' });
  response.json({ data: staff });
}));

router.delete('/staff/:id', asyncHandler(async (request, response) => {
  const staff = await User.findOneAndDelete({ _id: request.params.id, role: { $in: staffRoles } });
  if (!staff) return response.status(404).json({ message: 'Staff member not found' });
  response.status(204).send();
}));

router.get('/settings/current', asyncHandler(async (_request, response) => {
  const settings = await RestaurantSettings.findOne().sort({ createdAt: 1 });
  response.json({ data: settings });
}));

router.put('/settings/current', asyncHandler(async (request, response) => {
  const allowedFields = [
    'restaurantName', 'logo', 'banner', 'address', 'phone', 'email',
    'openingHours', 'currency', 'timeZone', 'dateTimeFormat', 'taxPercentage',
    'serviceChargePercentage', 'enabledOrderTypes', 'reservation', 'printer',
    'onlineOrdersEnabled', 'websiteVisible', 'maintenanceMode'
  ];
  const updates = {};
  for (const field of allowedFields) {
    if (request.body[field] !== undefined) updates[field] = request.body[field];
  }
  if (!updates.restaurantName?.trim()) {
    return response.status(400).json({ message: 'Restaurant name is required' });
  }
  updates.updatedBy = request.user._id;
  const settings = await RestaurantSettings.findOneAndUpdate({}, updates, {
    new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true
  });
  response.json({ data: settings });
}));

router.get('/inventory/items', asyncHandler(async (request, response) => {
  const filter = {};
  if (request.query.category) filter.category = request.query.category;
  if (request.query.search) filter.name = { $regex: request.query.search, $options: 'i' };
  if (request.query.lowStock === 'true') filter.$expr = { $lte: ['$quantity', '$lowStockThreshold'] };
  response.json({ data: await InventoryItem.find(filter).sort({ name: 1 }) });
}));

router.post('/inventory/items', asyncHandler(async (request, response) => {
  const item = await InventoryItem.create(request.body);
  response.status(201).json({ data: item });
}));

router.patch('/inventory/items/:id', asyncHandler(async (request, response) => {
  const item = await InventoryItem.findByIdAndUpdate(request.params.id, request.body, {
    new: true, runValidators: true
  });
  if (!item) return response.status(404).json({ message: 'Inventory item not found' });
  response.json({ data: item });
}));

router.delete('/inventory/items/:id', asyncHandler(async (request, response) => {
  const item = await InventoryItem.findByIdAndUpdate(request.params.id, { isActive: false }, { new: true });
  if (!item) return response.status(404).json({ message: 'Inventory item not found' });
  response.json({ data: item });
}));

router.post('/floors', asyncHandler(async (request, response) => {
  const floor = await Floor.create(request.body);
  response.status(201).json({ data: floor });
}));

router.patch('/floors/:id', asyncHandler(async (request, response) => {
  const floor = await Floor.findByIdAndUpdate(request.params.id, request.body, {
    new: true, runValidators: true
  });
  if (!floor) return response.status(404).json({ message: 'Floor not found' });
  response.json({ data: floor });
}));

router.delete('/floors/:id', asyncHandler(async (request, response) => {
  const tableCount = await RestaurantTable.countDocuments({ floor: request.params.id });
  if (tableCount) return response.status(409).json({ message: 'Remove all tables from this floor first' });
  const floor = await Floor.findByIdAndDelete(request.params.id);
  if (!floor) return response.status(404).json({ message: 'Floor not found' });
  response.status(204).send();
}));

router.get('/floors/:floorId/tables', asyncHandler(async (request, response) => {
  const tables = await RestaurantTable.find({ floor: request.params.floorId }).sort({ name: 1 });
  response.json({ data: tables });
}));

router.post('/floors/:floorId/tables', asyncHandler(async (request, response) => {
  const floor = await Floor.findById(request.params.floorId);
  if (!floor) return response.status(404).json({ message: 'Floor not found' });
  const table = await RestaurantTable.create({ ...request.body, floor: floor._id });
  response.status(201).json({ data: table });
}));

router.patch('/floors/:floorId/tables/:tableId', asyncHandler(async (request, response) => {
  const table = await RestaurantTable.findOneAndUpdate(
    { _id: request.params.tableId, floor: request.params.floorId },
    request.body,
    { new: true, runValidators: true }
  );
  if (!table) return response.status(404).json({ message: 'Table not found on this floor' });
  response.json({ data: table });
}));

router.delete('/floors/:floorId/tables/:tableId', asyncHandler(async (request, response) => {
  const table = await RestaurantTable.findOneAndDelete({ _id: request.params.tableId, floor: request.params.floorId });
  if (!table) return response.status(404).json({ message: 'Table not found on this floor' });
  response.status(204).send();
}));

router.get('/inventory/movements', asyncHandler(async (request, response) => {
  const movements = await InventoryMovement.find()
    .sort({ createdAt: -1 }).limit(100).populate('item', 'name unit').populate('createdBy', 'fullName');
  response.json({ data: movements });
}));

router.post('/inventory/movements', asyncHandler(async (request, response) => {
  const { item: itemId, type, quantity, source = 'manual', notes } = request.body;
  const amount = Number(quantity);
  if (!itemId || !['stock_in', 'stock_out', 'adjustment'].includes(type) || !Number.isFinite(amount) || amount <= 0) {
    return response.status(400).json({ message: 'item, valid movement type and positive quantity are required' });
  }
  const item = await InventoryItem.findById(itemId);
  if (!item) return response.status(404).json({ message: 'Inventory item not found' });
  const nextQuantity = type === 'stock_out'
    ? item.quantity - amount
    : type === 'stock_in' ? item.quantity + amount : amount;
  if (nextQuantity < 0) return response.status(400).json({ message: 'Stock cannot become negative' });
  item.quantity = nextQuantity;
  await item.save();
  const movement = await InventoryMovement.create({
    item: itemId, type, quantity: amount, unit: item.unit, source, notes, createdBy: request.user._id
  });
  response.status(201).json({ data: { item, movement } });
}));

router.get('/inventory/purchases', asyncHandler(async (_request, response) => {
  const purchases = await Purchase.find().sort({ purchaseDate: -1, createdAt: -1 })
    .limit(100).populate('item', 'name unit').populate('createdBy', 'fullName');
  response.json({ data: purchases });
}));

router.post('/inventory/purchases', asyncHandler(async (request, response) => {
  const data = { ...request.body, quantity: Number(request.body.quantity), unitPrice: Number(request.body.unitPrice) };
  data.totalAmount = data.quantity * data.unitPrice;
  data.createdBy = request.user._id;
  const item = await InventoryItem.findById(data.item);
  if (!item) return response.status(404).json({ message: 'Inventory item not found' });
  data.itemName = item.name;
  data.category = item.category;
  data.unit = item.unit;
  const purchase = await Purchase.create(data);
  item.quantity += data.quantity;
  item.costPerUnit = data.unitPrice;
  await item.save();
  await InventoryMovement.create({
    item: item._id, type: 'stock_in', quantity: data.quantity, unit: item.unit,
    source: 'purchase', reference: purchase._id, createdBy: request.user._id
  });
  response.status(201).json({ data: purchase });
}));

router.get('/inventory/expenses', asyncHandler(async (_request, response) => {
  response.json({ data: await Expense.find().sort({ expenseDate: -1, createdAt: -1 }).limit(100).populate('createdBy', 'fullName') });
}));

router.post('/inventory/expenses', asyncHandler(async (request, response) => {
  const expense = await Expense.create({ ...request.body, amount: Number(request.body.amount), createdBy: request.user._id });
  response.status(201).json({ data: expense });
}));

const resources = {
  floors: Floor,
  tables: RestaurantTable,
  orders: Order,
  reservations: Reservation,
  categories: FoodCategory,
  foodItems: FoodItem,
  invoices: Invoice,
  payments: Payment,
  attendance: Attendance,
  performance: PerformanceRecord,
  salary: SalaryPayment,
  inventory: InventoryItem,
  purchases: Purchase,
  expenses: Expense,
  settings: RestaurantSettings,
  activityLogs: ActivityLog
};

router.get('/:resource', asyncHandler(async (request, response) => {
  const Model = resources[request.params.resource];
  if (!Model) return response.status(404).json({ message: 'Admin resource not found' });
  const page = Math.max(Number(request.query.page) || 1, 1);
  const limit = Math.min(Math.max(Number(request.query.limit) || 20, 1), 100);
  const items = await Model.find().sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit);
  const total = await Model.countDocuments();
  response.json({ data: items, pagination: { page, limit, total, pages: Math.ceil(total / limit) } });
}));

export default router;
