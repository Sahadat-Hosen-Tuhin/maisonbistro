import express from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import { allowRoles, requireAuth } from '../middlewares/auth.js';
import { ActivityLog, Order } from '../models/index.js';

const router = express.Router();
router.use(requireAuth, allowRoles('delivery'));

const onlineDeliveryFilter = {
  type: 'online',
  onlineApproval: 'approved',
  status: { $in: ['ready', 'served'] }
};

router.get('/overview', asyncHandler(async (_request, response) => {
  const [available, active, delivered] = await Promise.all([
    Order.countDocuments({ ...onlineDeliveryFilter, $or: [{ deliveryStatus: 'awaiting_pickup' }, { deliveryStatus: { $exists: false } }], assignedDeliveryStaff: { $exists: false } }),
    Order.countDocuments({ ...onlineDeliveryFilter, assignedDeliveryStaff: _request.user._id, deliveryStatus: { $in: ['accepted', 'picked_up', 'delivered', 'cash_collected'] } }),
    Order.countDocuments({ assignedDeliveryStaff: _request.user._id, deliveryStatus: 'handed_to_cashier' })
  ]);
  response.json({ data: { available, active, delivered } });
}));

router.get('/orders', asyncHandler(async (request, response) => {
  const orders = await Order.find({
    ...onlineDeliveryFilter,
    $or: [
      { assignedDeliveryStaff: request.user._id },
      { $or: [{ deliveryStatus: 'awaiting_pickup' }, { deliveryStatus: { $exists: false } }], assignedDeliveryStaff: { $exists: false } }
    ]
  }).sort({ createdAt: 1 }).populate('customer', 'fullName phone').lean();
  response.json({
    data: orders.map((order) => ({
      ...order,
      deliveryContact: {
        name: order.customer?.fullName || order.guest?.name || 'Guest customer',
        phone: order.customer?.phone || order.guest?.phone || '',
        address: order.deliveryAddress || order.guest?.address || '',
        instructions: order.deliveryInstructions || ''
      }
    }))
  });
}));

router.get('/history', asyncHandler(async (request, response) => {
  const filter = { assignedDeliveryStaff: request.user._id, type: 'online' };
  if (request.query.status) filter.deliveryStatus = request.query.status;
  const orders = await Order.find(filter).sort({ updatedAt: -1 }).limit(200).populate('customer', 'fullName phone').lean();
  response.json({ data: orders });
}));

router.patch('/orders/:id/accept', asyncHandler(async (request, response) => {
  const order = await Order.findOneAndUpdate(
    { _id: request.params.id, ...onlineDeliveryFilter, $or: [{ deliveryStatus: 'awaiting_pickup' }, { deliveryStatus: { $exists: false } }], assignedDeliveryStaff: { $exists: false } },
    { assignedDeliveryStaff: request.user._id, deliveryStatus: 'accepted', deliveryAcceptedAt: new Date() },
    { new: true }
  );
  if (!order) return response.status(409).json({ message: 'This order is no longer available for delivery' });
  await ActivityLog.create({ actor: request.user._id, actorRole: request.user.role, action: 'delivery_order_accepted', resourceType: 'Order', resourceId: order._id });
  response.json({ data: order });
}));

router.patch('/orders/:id/status', asyncHandler(async (request, response) => {
  const transitions = {
    accepted: { next: 'picked_up', update: { deliveryPickedUpAt: new Date() } },
    picked_up: { next: 'out_for_delivery' },
    out_for_delivery: { next: 'delivered', update: { deliveredAt: new Date(), cashCollectedAt: new Date() } },
    delivered: { next: 'cash_collected' }
  };
  const current = request.body.status;
  const transition = transitions[current];
  if (!transition) return response.status(400).json({ message: 'Invalid delivery status transition' });
  const order = await Order.findOneAndUpdate(
    { _id: request.params.id, assignedDeliveryStaff: request.user._id, deliveryStatus: current },
    { deliveryStatus: transition.next, ...(transition.next === 'delivered' ? { status: 'served' } : {}), ...(transition.next === 'failed' ? { deliveryFailureReason: String(request.body.reason || 'Delivery failed') } : {}), ...transition.update },
    { new: true }
  );
  if (!order) return response.status(404).json({ message: 'Assigned delivery order not found' });
  await ActivityLog.create({ actor: request.user._id, actorRole: request.user.role, action: `delivery_${transition.next}`, resourceType: 'Order', resourceId: order._id });
  response.json({ data: order });
}));

export default router;
