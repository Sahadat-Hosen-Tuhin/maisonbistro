import express from 'express';
import { Counter, Reservation } from '../models/index.js';
import { allowRoles, requireAuth } from '../middlewares/auth.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const router = express.Router();
router.use(requireAuth, allowRoles('admin', 'owner', 'manager', 'cashier'));

router.get('/', asyncHandler(async (request, response) => {
  const filter = {};
  if (request.query.status) filter.status = request.query.status;
  if (request.query.date) {
    const date = new Date(request.query.date);
    const next = new Date(date);
    next.setDate(next.getDate() + 1);
    filter.date = { $gte: date, $lt: next };
  }
  const reservations = await Reservation.find(filter).sort({ date: 1, startTime: 1, createdAt: -1 })
    .limit(100).populate('table', 'name capacity status').populate('managedBy', 'fullName');
  response.json({ data: reservations });
}));

router.post('/', asyncHandler(async (request, response) => {
  const { guest, customer, date, startTime, endTime, guestCount, table, notes } = request.body;
  if (!date || !startTime || !Number.isInteger(Number(guestCount)) || Number(guestCount) < 1) {
    return response.status(400).json({ message: 'Date, start time and a valid guest count are required' });
  }
  const counter = await Counter.findOneAndUpdate(
    { _id: 'reservation' }, { $inc: { sequence: 1 } }, { new: true, upsert: true }
  );
  const reservation = await Reservation.create({
    reservationNumber: `RES-${String(counter.sequence).padStart(6, '0')}`,
    guest, customer, date, startTime, endTime, guestCount: Number(guestCount), table, notes,
    managedBy: request.user._id
  });
  response.status(201).json({ data: await reservation.populate('table', 'name capacity status') });
}));

router.patch('/:id', asyncHandler(async (request, response) => {
  const allowed = ['date', 'startTime', 'endTime', 'guest', 'guestCount', 'table', 'notes', 'status', 'cancellationReason'];
  const updates = Object.fromEntries(Object.entries(request.body).filter(([key]) => allowed.includes(key)));
  updates.managedBy = request.user._id;
  const reservation = await Reservation.findByIdAndUpdate(request.params.id, updates, {
    new: true, runValidators: true
  }).populate('table', 'name capacity status').populate('managedBy', 'fullName');
  if (!reservation) return response.status(404).json({ message: 'Reservation not found' });
  response.json({ data: reservation });
}));

export default router;
