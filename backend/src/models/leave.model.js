import mongoose from 'mongoose';

const leaveSchema = new mongoose.Schema({
  employee: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  startDate: { type: Date, required: true },
  endDate: { type: Date, required: true },
  reason: { type: String, required: true, trim: true },
  status: { type: String, enum: ['pending', 'approved', 'rejected', 'cancelled'], default: 'pending', index: true },
  reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  reviewerRole: { type: String, enum: ['manager', 'admin', 'owner'] },
  reviewedAt: Date,
  rejectionReason: String
}, { timestamps: true });

leaveSchema.index({ employee: 1, startDate: 1, endDate: 1 });
export const LeaveRequest = mongoose.models.LeaveRequest || mongoose.model('LeaveRequest', leaveSchema);
