import mongoose from 'mongoose';

const notificationSchema = new mongoose.Schema({
  recipient: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  type: { type: String, required: true },
  title: { type: String, required: true },
  message: { type: String, required: true },
  referenceModel: String,
  referenceId: mongoose.Schema.Types.ObjectId,
  isRead: { type: Boolean, default: false, index: true },
  readAt: Date
}, { timestamps: true });
export const Notification = mongoose.models.Notification || mongoose.model('Notification', notificationSchema);

const complaintSchema = new mongoose.Schema({
  customer: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  order: { type: mongoose.Schema.Types.ObjectId, ref: 'Order' },
  subject: { type: String, required: true },
  message: { type: String, required: true },
  status: { type: String, enum: ['open', 'in_progress', 'resolved', 'closed'], default: 'open', index: true },
  response: String,
  handledBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });
export const Complaint = mongoose.models.Complaint || mongoose.model('Complaint', complaintSchema);

const activityLogSchema = new mongoose.Schema({
  actor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  actorRole: String,
  action: { type: String, required: true },
  resourceType: { type: String, required: true },
  resourceId: mongoose.Schema.Types.ObjectId,
  changes: mongoose.Schema.Types.Mixed,
  metadata: mongoose.Schema.Types.Mixed
}, { timestamps: true });
activityLogSchema.index({ createdAt: -1 });
export const ActivityLog = mongoose.models.ActivityLog || mongoose.model('ActivityLog', activityLogSchema);
