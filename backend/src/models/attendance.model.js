import mongoose from 'mongoose';

const approvalSchema = new mongoose.Schema({
  status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
  approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  approverRole: { type: String, enum: ['manager', 'admin', 'owner'] },
  approvedAt: Date,
  rejectionReason: String
}, { _id: false });

const attendanceSchema = new mongoose.Schema({
  employee: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  date: { type: Date, required: true, index: true },
  checkIn: Date,
  checkOut: Date,
  status: { type: String, enum: ['present', 'absent', 'late', 'leave'], default: 'present' },
  submittedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  approval: { type: approvalSchema, default: () => ({}) },
  notes: String
}, { timestamps: true });
attendanceSchema.index({ employee: 1, date: 1 }, { unique: true });
export const Attendance = mongoose.models.Attendance || mongoose.model('Attendance', attendanceSchema);

const performanceSchema = new mongoose.Schema({
  employee: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  periodStart: { type: Date, required: true },
  periodEnd: { type: Date, required: true },
  metrics: { type: mongoose.Schema.Types.Mixed, default: {} },
  score: { type: Number, min: 0, max: 100 },
  evaluation: String,
  evaluatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });
export const PerformanceRecord = mongoose.models.PerformanceRecord || mongoose.model('PerformanceRecord', performanceSchema);
