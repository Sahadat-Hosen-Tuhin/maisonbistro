import mongoose from 'mongoose';

const orderItemSchema = new mongoose.Schema({
  foodItem: { type: mongoose.Schema.Types.ObjectId, ref: 'FoodItem', required: true },
  name: { type: String, required: true },
  quantity: { type: Number, required: true, min: 1 },
  unitPrice: { type: Number, required: true, min: 0 },
  selectedSize: {
    type: String,
    enum: ['small', 'medium', 'large', '9_inch', '10_inch', '11_inch', '12_inch', 'family']
  },
  addOns: [{
    name: { type: String, required: true },
    type: { type: String, enum: ['spicy_level', 'other'], default: 'other' },
    price: { type: Number, min: 0, default: 0 }
  }],
  notes: String,
  preparationStatus: { type: String, enum: ['pending', 'accepted', 'preparing', 'ready', 'completed', 'cancelled'], default: 'pending' }
}, { _id: true });

const orderSchema = new mongoose.Schema({
  orderNumber: { type: String, required: true, unique: true, index: true },
  customer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
  guest: { name: String, phone: String, address: String },
  type: { type: String, enum: ['dine_in', 'takeaway', 'online', 'walk_in'], required: true, index: true },
  onlineApproval: { type: String, enum: ['not_required', 'pending', 'approved', 'rejected'], default: 'not_required', index: true },
  onlineApprovedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  onlineApprovedAt: Date,
  onlineRejectionReason: String,
  table: { type: mongoose.Schema.Types.ObjectId, ref: 'RestaurantTable' },
  items: { type: [orderItemSchema], required: true, validate: v => v.length > 0 },
  status: { type: String, enum: ['pending', 'accepted', 'processing', 'ready', 'served', 'completed', 'delivered', 'cancelled'], default: 'pending', index: true },
  kitchenPriority: { type: String, enum: ['normal', 'high', 'urgent'], default: 'normal', index: true },
  kitchenIssue: String,
  kitchenEvents: [{
    status: { type: String, enum: ['pending', 'accepted', 'processing', 'ready', 'served', 'completed', 'cancelled'] },
    staff: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    at: { type: Date, default: Date.now },
    note: String
  }],
  paymentStatus: { type: String, enum: ['unpaid', 'partially_paid', 'paid', 'refunded'], default: 'unpaid', index: true },
  paymentMethod: { type: String, enum: ['cash_on_delivery', 'cash', 'bank_transfer', 'mobile_banking'] },
  subtotal: { type: Number, required: true, min: 0 },
  discount: { type: Number, default: 0, min: 0 },
  tax: { type: Number, default: 0, min: 0 },
  serviceCharge: { type: Number, default: 0, min: 0 },
  total: { type: Number, required: true, min: 0 },
  coupon: { type: mongoose.Schema.Types.ObjectId, ref: 'Coupon' },
  deliveryAddress: String,
  deliveryInstructions: String,
  cancellationReason: String,
  assignedDeliveryStaff: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  deliveryStatus: { type: String, enum: ['not_required', 'awaiting_pickup', 'accepted', 'picked_up', 'out_for_delivery', 'delivered', 'failed', 'cash_collected', 'handed_to_cashier'], default: 'not_required', index: true },
  deliveryAcceptedAt: Date,
  deliveryPickedUpAt: Date,
  deliveredAt: Date,
  cashCollectedAt: Date,
  cashHandedToCashierAt: Date,
  cashHandedToCashierBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  deliveryFailureReason: String,
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });
orderSchema.index({ createdAt: -1, status: 1 });
export const Order = mongoose.models.Order || mongoose.model('Order', orderSchema);

const invoiceSchema = new mongoose.Schema({
  invoiceNumber: { type: String, required: true, unique: true, index: true },
  order: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', required: true, unique: true },
  generatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  subtotal: Number,
  discount: Number,
  tax: Number,
  serviceCharge: Number,
  total: Number,
  printedAt: Date,
  reprintCount: { type: Number, default: 0 }
}, { timestamps: true });
export const Invoice = mongoose.models.Invoice || mongoose.model('Invoice', invoiceSchema);

const paymentSchema = new mongoose.Schema({
  order: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', required: true, index: true },
  invoice: { type: mongoose.Schema.Types.ObjectId, ref: 'Invoice' },
  amount: { type: Number, required: true, min: 0 },
  method: { type: String, enum: ['cash', 'bank_transfer', 'mobile_banking'], required: true },
  status: { type: String, enum: ['successful', 'pending', 'failed', 'refunded'], default: 'successful' },
  transactionId: String,
  receivedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  notes: String
}, { timestamps: true });
paymentSchema.index({ createdAt: -1 });
export const Payment = mongoose.models.Payment || mongoose.model('Payment', paymentSchema);
