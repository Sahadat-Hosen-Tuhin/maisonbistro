import mongoose from 'mongoose';

const kitchenEventSchema = new mongoose.Schema({
  status: { type: String, enum: ['pending', 'accepted', 'preparing', 'ready', 'completed', 'cancelled'], required: true },
  staff: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  at: { type: Date, default: Date.now },
  note: String
}, { _id: false });
const kitchenOrderSchema = new mongoose.Schema({
  order: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', required: true, unique: true, index: true },
  priority: { type: String, enum: ['normal', 'high', 'urgent'], default: 'normal' },
  status: { type: String, enum: ['pending', 'accepted', 'preparing', 'ready', 'completed', 'cancelled'], default: 'pending', index: true },
  assignedChef: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  issue: String,
  events: [kitchenEventSchema]
}, { timestamps: true });
export const KitchenOrder = mongoose.models.KitchenOrder || mongoose.model('KitchenOrder', kitchenOrderSchema);

const deliverySchema = new mongoose.Schema({
  order: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', required: true, unique: true, index: true },
  staff: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  status: { type: String, enum: ['assigned', 'accepted', 'picked_up', 'out_for_delivery', 'delivered', 'failed', 'cancelled'], default: 'assigned', index: true },
  customerName: String,
  customerPhone: String,
  address: String,
  instructions: String,
  pickedUpAt: Date,
  deliveredAt: Date,
  failureReason: String
}, { timestamps: true });
export const DeliveryAssignment = mongoose.models.DeliveryAssignment || mongoose.model('DeliveryAssignment', deliverySchema);

const cleaningTaskSchema = new mongoose.Schema({
  title: { type: String, required: true },
  area: { type: String, required: true },
  description: String,
  priority: { type: String, enum: ['normal', 'high', 'urgent'], default: 'normal' },
  assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  status: { type: String, enum: ['assigned', 'accepted', 'in_progress', 'completed'], default: 'assigned', index: true },
  issue: String,
  completedAt: Date,
  assignedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });
export const CleaningTask = mongoose.models.CleaningTask || mongoose.model('CleaningTask', cleaningTaskSchema);
