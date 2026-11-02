import express from 'express';
import bcrypt from 'bcryptjs';
import { profileUpload } from '../config/uploads.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { allowRoles, requireAuth } from '../middlewares/auth.js';
import {
  Complaint, Counter, Coupon, FoodItem, FoodReview, Notification, Order,
  Reservation, RestaurantSettings, User
} from '../models/index.js';

const router = express.Router();
const customerAuth = [requireAuth, allowRoles('customer')];

function orderTotal(items, settings) {
  const subtotal = items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
  const tax = subtotal * Number(settings?.taxPercentage || 0) / 100;
  const serviceCharge = subtotal * Number(settings?.serviceChargePercentage || 0) / 100;
  return { subtotal, tax, serviceCharge, total: subtotal + tax + serviceCharge };
}

async function buildItems(entries) {
  if (!Array.isArray(entries) || !entries.length) return null;
  const menu = await FoodItem.find({ _id: { $in: entries.map((entry) => entry.foodItem) }, isAvailable: true });
  const byId = new Map(menu.map((item) => [item._id.toString(), item]));
  const result = entries.map((entry) => {
    const item = byId.get(String(entry.foodItem));
    const quantity = Number(entry.quantity);
    if (!item || !Number.isInteger(quantity) || quantity < 1) return null;
    const size = item.availableSizes.includes(entry.selectedSize) ? entry.selectedSize : undefined;
    const adjustment = item.sizePricing.find((price) => price.size === size)?.adjustment || 0;
    return { foodItem: item._id, name: item.name, quantity, unitPrice: Number(item.offerPrice || item.regularPrice) + adjustment, selectedSize: size, addOns: [], notes: entry.notes };
  });
  return result.some((item) => !item) ? null : result;
}

router.post('/guest-orders', asyncHandler(async (request, response) => {
  const { name, phone, address, type = 'takeaway', items } = request.body;
  if (!name?.trim() || !phone?.trim() || !address?.trim()) return response.status(400).json({ message: 'Name, phone and delivery address are required' });
  if (!['takeaway', 'online', 'walk_in'].includes(type)) return response.status(400).json({ message: 'Invalid guest order type' });
  const orderItems = await buildItems(items);
  if (!orderItems) return response.status(400).json({ message: 'Selected menu items are invalid' });
  const totals = orderTotal(orderItems, await RestaurantSettings.findOne().sort({ createdAt: 1 }));
  const counter = await Counter.findOneAndUpdate({ _id: 'order' }, { $inc: { sequence: 1 } }, { new: true, upsert: true });
  const order = await Order.create({ orderNumber: `ORD-${String(counter.sequence).padStart(6, '0')}`, type, onlineApproval: 'pending', paymentMethod: 'cash_on_delivery', guest: { name, phone, address }, deliveryAddress: address, items: orderItems, ...totals });
  response.status(201).json({ data: { orderNumber: order.orderNumber, order } });
}));

router.use(...customerAuth);

router.get('/dashboard', asyncHandler(async (request, response) => {
  const customer = request.user._id;
  const [total, pending, completed, cancelled, recent, reservations, notifications] = await Promise.all([
    Order.countDocuments({ customer }), Order.countDocuments({ customer, status: { $in: ['pending', 'accepted', 'processing', 'ready', 'served'] } }),
    Order.countDocuments({ customer, status: 'completed' }), Order.countDocuments({ customer, status: 'cancelled' }),
    Order.find({ customer }).sort({ createdAt: -1 }).limit(8).populate('table', 'name'),
    Reservation.find({ customer }).sort({ date: -1 }).limit(20).populate('table', 'name'),
    Notification.find({ recipient: customer }).sort({ createdAt: -1 }).limit(10)
  ]);
  response.json({ data: { totals: { total, pending, completed, cancelled }, recent, reservations, notifications, profile: request.user } });
}));

router.get('/orders', asyncHandler(async (request, response) => {
  response.json({ data: await Order.find({ customer: request.user._id }).sort({ createdAt: -1 }).limit(100).populate('table', 'name') });
}));

router.post('/orders', asyncHandler(async (request, response) => {
  const orderItems = await buildItems(request.body.items);
  if (!orderItems) return response.status(400).json({ message: 'At least one valid menu item is required' });
  const type = request.body.type || 'online';
  if (!['online', 'takeaway', 'walk_in'].includes(type)) return response.status(400).json({ message: 'Invalid online order type' });
  const totals = orderTotal(orderItems, await RestaurantSettings.findOne().sort({ createdAt: 1 }));
  const counter = await Counter.findOneAndUpdate({ _id: 'order' }, { $inc: { sequence: 1 } }, { new: true, upsert: true });
  const order = await Order.create({ orderNumber: `ORD-${String(counter.sequence).padStart(6, '0')}`, type, onlineApproval: 'pending', paymentMethod: 'cash_on_delivery', customer: request.user._id, guest: request.body.guest, deliveryAddress: request.body.deliveryAddress, deliveryInstructions: request.body.deliveryInstructions, items: orderItems, ...totals });
  response.status(201).json({ data: order });
}));

router.get('/orders/:id', asyncHandler(async (request, response) => {
  const order = await Order.findOne({ _id: request.params.id, customer: request.user._id }).populate('table', 'name');
  if (!order) return response.status(404).json({ message: 'Order not found' });
  response.json({ data: order });
}));

router.post('/orders/:id/reorder', asyncHandler(async (request, response) => {
  const source = await Order.findOne({ _id: request.params.id, customer: request.user._id });
  if (!source) return response.status(404).json({ message: 'Order not found' });
  const items = await buildItems(source.items);
  if (!items) return response.status(409).json({ message: 'One or more previous items are no longer available' });
  const totals = orderTotal(items, await RestaurantSettings.findOne().sort({ createdAt: 1 }));
  const counter = await Counter.findOneAndUpdate({ _id: 'order' }, { $inc: { sequence: 1 } }, { new: true, upsert: true });
  const order = await Order.create({ orderNumber: `ORD-${String(counter.sequence).padStart(6, '0')}`, type: 'online', customer: request.user._id, items, ...totals });
  response.status(201).json({ data: order });
}));

router.patch('/orders/:id/cancel', asyncHandler(async (request, response) => {
  const order = await Order.findOne({ _id: request.params.id, customer: request.user._id });
  if (!order) return response.status(404).json({ message: 'Order not found' });
  if (!['pending', 'accepted'].includes(order.status)) return response.status(400).json({ message: 'This order can no longer be cancelled' });
  order.status = 'cancelled'; order.cancellationReason = String(request.body.reason || 'Cancelled by customer'); await order.save();
  response.json({ data: order });
}));

router.get('/reservations', asyncHandler(async (request, response) => {
  response.json({ data: await Reservation.find({ customer: request.user._id }).sort({ date: -1 }).populate('table', 'name') });
}));

router.post('/reservations', asyncHandler(async (request, response) => {
  const { date, startTime, endTime, guestCount, notes, guest } = request.body;
  if (!date || !startTime || !Number.isInteger(Number(guestCount)) || Number(guestCount) < 1) return response.status(400).json({ message: 'Date, start time and guest count are required' });
  const counter = await Counter.findOneAndUpdate({ _id: 'reservation' }, { $inc: { sequence: 1 } }, { new: true, upsert: true });
  const reservation = await Reservation.create({ reservationNumber: `RES-${String(counter.sequence).padStart(6, '0')}`, customer: request.user._id, date, startTime, endTime, guestCount, notes, guest: guest || { name: request.user.fullName, phone: request.user.phone, email: request.user.email } });
  response.status(201).json({ data: reservation });
}));

router.patch('/reservations/:id/cancel', asyncHandler(async (request, response) => {
  const reservation = await Reservation.findOne({ _id: request.params.id, customer: request.user._id });
  if (!reservation) return response.status(404).json({ message: 'Reservation not found' });
  if (!['pending', 'confirmed'].includes(reservation.status)) return response.status(400).json({ message: 'This reservation cannot be cancelled' });
  reservation.status = 'cancelled'; reservation.cancellationReason = String(request.body.reason || 'Cancelled by customer'); await reservation.save();
  response.json({ data: reservation });
}));

router.patch('/profile', profileUpload.single('profilePicture'), asyncHandler(async (request, response) => {
  const updates = {};
  if (request.body.fullName?.trim()) updates.fullName = request.body.fullName.trim();
  if (request.body.email?.trim()) updates.email = request.body.email.trim().toLowerCase();
  if (request.body.phone !== undefined) updates.phone = request.body.phone.trim();
  if (request.file) updates.profilePicture = `/uploads/profiles/${request.file.filename}`;
  const user = await User.findOneAndUpdate({ _id: request.user._id, role: 'customer' }, updates, { new: true, runValidators: true });
  response.json({ data: user });
}));

router.patch('/password', asyncHandler(async (request, response) => {
  const { currentPassword, newPassword } = request.body;
  if (!newPassword || newPassword.length < 8) return response.status(400).json({ message: 'New password must be at least 8 characters' });
  const user = await User.findById(request.user._id).select('+passwordHash');
  if (!(await bcrypt.compare(currentPassword || '', user.passwordHash))) return response.status(400).json({ message: 'Current password is incorrect' });
  user.passwordHash = await bcrypt.hash(newPassword, 12); await user.save();
  response.json({ message: 'Password changed successfully' });
}));

router.get('/addresses', (request, response) => response.json({ data: request.user.addresses || [] }));
router.post('/addresses', asyncHandler(async (request, response) => {
  const address = request.body;
  if (!address.addressLine?.trim()) return response.status(400).json({ message: 'Address line is required' });
  const user = await User.findById(request.user._id);
  if (address.isDefault) user.addresses.forEach((entry) => { entry.isDefault = false; });
  user.addresses.push(address); await user.save(); response.status(201).json({ data: user.addresses.at(-1) });
}));
router.patch('/addresses/:id', asyncHandler(async (request, response) => {
  const user = await User.findById(request.user._id);
  const address = user.addresses.id(request.params.id);
  if (!address) return response.status(404).json({ message: 'Address not found' });
  if (request.body.isDefault) user.addresses.forEach((entry) => { entry.isDefault = false; });
  Object.assign(address, request.body); await user.save(); response.json({ data: address });
}));
router.delete('/addresses/:id', asyncHandler(async (request, response) => {
  const user = await User.findById(request.user._id);
  if (!user.addresses.id(request.params.id)) return response.status(404).json({ message: 'Address not found' });
  user.addresses.pull(request.params.id); await user.save(); response.status(204).send();
}));

router.post('/reviews', asyncHandler(async (request, response) => {
  const { foodItem, rating, comment, order } = request.body;
  const eligible = await Order.exists({ _id: order, customer: request.user._id, status: 'completed', 'items.foodItem': foodItem });
  if (!eligible) return response.status(403).json({ message: 'You can review food only from a completed order' });
  const review = await FoodReview.findOneAndUpdate({ foodItem, customer: request.user._id }, { foodItem, customer: request.user._id, rating, comment, isVisible: true }, { new: true, upsert: true, runValidators: true });
  const stats = await FoodReview.aggregate([{ $match: { foodItem: review.foodItem, isVisible: true } }, { $group: { _id: null, average: { $avg: '$rating' }, count: { $sum: 1 } } }]);
  await FoodItem.findByIdAndUpdate(foodItem, { ratingAverage: stats[0]?.average || 0, ratingCount: stats[0]?.count || 0 });
  response.status(201).json({ data: review });
}));
router.patch('/reviews/:id', asyncHandler(async (request, response) => {
  const review = await FoodReview.findOneAndUpdate({ _id: request.params.id, customer: request.user._id }, { rating: request.body.rating, comment: request.body.comment }, { new: true, runValidators: true });
  if (!review) return response.status(404).json({ message: 'Review not found' });
  const stats = await FoodReview.aggregate([{ $match: { foodItem: review.foodItem, isVisible: true } }, { $group: { _id: null, average: { $avg: '$rating' }, count: { $sum: 1 } } }]);
  await FoodItem.findByIdAndUpdate(review.foodItem, { ratingAverage: stats[0]?.average || 0, ratingCount: stats[0]?.count || 0 });
  response.json({ data: review });
}));
router.delete('/reviews/:id', asyncHandler(async (request, response) => {
  const review = await FoodReview.findOneAndDelete({ _id: request.params.id, customer: request.user._id });
  if (!review) return response.status(404).json({ message: 'Review not found' });
  const stats = await FoodReview.aggregate([{ $match: { foodItem: review.foodItem, isVisible: true } }, { $group: { _id: null, average: { $avg: '$rating' }, count: { $sum: 1 } } }]);
  await FoodItem.findByIdAndUpdate(review.foodItem, { ratingAverage: stats[0]?.average || 0, ratingCount: stats[0]?.count || 0 });
  response.status(204).send();
}));

router.get('/coupons', asyncHandler(async (_request, response) => {
  const now = new Date();
  response.json({ data: await Coupon.find({ isActive: true, $or: [{ validFrom: { $exists: false } }, { validFrom: { $lte: now } }], $and: [{ $or: [{ validUntil: { $exists: false } }, { validUntil: { $gte: now } }] }, { $or: [{ usageLimit: { $exists: false } }, { $expr: { $lt: ['$usedCount', '$usageLimit'] } }] }] }).sort({ createdAt: -1 }) });
}));
router.post('/coupons/validate', asyncHandler(async (request, response) => {
  const coupon = await Coupon.findOne({ code: request.body.code?.toUpperCase(), isActive: true });
  if (!coupon) return response.status(404).json({ message: 'Coupon not found or inactive' });
  if (Number(request.body.subtotal || 0) < coupon.minimumOrderAmount) return response.status(400).json({ message: `Minimum order is ৳${coupon.minimumOrderAmount}` });
  const discount = coupon.discountType === 'percentage' ? Number(request.body.subtotal) * coupon.discountValue / 100 : coupon.discountValue;
  response.json({ data: { coupon, discount: Math.min(discount, Number(request.body.subtotal)) } });
}));

router.post('/complaints', asyncHandler(async (request, response) => {
  const complaint = await Complaint.create({ ...request.body, customer: request.user._id });
  response.status(201).json({ data: complaint });
}));
router.get('/complaints', asyncHandler(async (request, response) => response.json({ data: await Complaint.find({ customer: request.user._id }).sort({ createdAt: -1 }) })));
router.get('/notifications', asyncHandler(async (request, response) => response.json({ data: await Notification.find({ recipient: request.user._id }).sort({ createdAt: -1 }).limit(100) })));
router.patch('/notifications/:id/read', asyncHandler(async (request, response) => {
  const notification = await Notification.findOneAndUpdate({ _id: request.params.id, recipient: request.user._id }, { isRead: true, readAt: new Date() }, { new: true });
  if (!notification) return response.status(404).json({ message: 'Notification not found' }); response.json({ data: notification });
}));
router.delete('/account', asyncHandler(async (request, response) => {
  await User.findByIdAndUpdate(request.user._id, { isActive: false, deletedAt: new Date() });
  response.status(204).send();
}));

export default router;
