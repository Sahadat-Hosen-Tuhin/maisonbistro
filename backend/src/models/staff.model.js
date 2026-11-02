import mongoose from 'mongoose';
import { User } from './user.model.js';

const staffSchema = new mongoose.Schema({
  designation: {
    type: String,
    enum: ['manager', 'waiter', 'chef', 'cashier', 'delivery', 'cleaner'],
    required: true,
    index: true
  },
  employeeId: { type: String, unique: true, sparse: true, trim: true },
  salaryAmount: { type: Number, min: 0 },
  joiningDate: Date,
  address: { type: String, trim: true },
  permissions: { type: Map, of: [String], default: {} }
}, { timestamps: true });

export const Staff = mongoose.models.Staff || User.discriminator('staff', staffSchema, 'staff');
const managerSchema = new mongoose.Schema({
  designation: staffSchema.obj.designation,
  employeeId: staffSchema.obj.employeeId,
  salaryAmount: staffSchema.obj.salaryAmount,
  joiningDate: staffSchema.obj.joiningDate,
  address: staffSchema.obj.address,
  permissions: staffSchema.obj.permissions,
  canApproveAttendance: { type: Boolean, default: true }
});
export const Manager = mongoose.models.Manager || User.discriminator('manager', managerSchema, 'manager');
