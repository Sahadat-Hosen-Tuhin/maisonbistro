import mongoose from 'mongoose';

const addressSchema = new mongoose.Schema({
  label: { type: String, trim: true, default: 'Home' },
  recipientName: { type: String, trim: true },
  phone: { type: String, trim: true },
  addressLine: { type: String, required: true, trim: true },
  city: { type: String, trim: true },
  postalCode: { type: String, trim: true },
  deliveryInstructions: { type: String, trim: true },
  isDefault: { type: Boolean, default: false }
}, { _id: true });

const userSchema = new mongoose.Schema({
  fullName: { type: String, required: true, trim: true, maxlength: 120 },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
  phone: { type: String, trim: true, index: true },
  passwordHash: { type: String, required: true, select: false },
  profilePicture: { type: String, required: function () { return ['staff', 'manager'].includes(this.accountType); } },
  role: {
    type: String,
    enum: ['admin', 'owner', 'manager', 'waiter', 'chef', 'cashier', 'delivery', 'cleaner', 'customer'],
    required: true,
    index: true
  },
  accountType: { type: String, enum: ['admin', 'staff', 'manager', 'customer'], required: true, index: true },
  isActive: { type: Boolean, default: true, index: true },
  mustChangePassword: { type: Boolean, default: true },
  lastLoginAt: Date,
  addresses: [addressSchema],
  notificationPreferences: {
    orderUpdates: { type: Boolean, default: true },
    reservations: { type: Boolean, default: true },
    announcements: { type: Boolean, default: true }
  },
  deletedAt: Date,
  passwordResetToken: { type: String, select: false },
  passwordResetExpires: { type: Date, select: false }
}, { timestamps: true, discriminatorKey: 'accountType' });

userSchema.index({ role: 1, isActive: 1 });
export const User = mongoose.models.User || mongoose.model('User', userSchema);
export const Admin = mongoose.models.Admin || User.discriminator('admin', new mongoose.Schema({
  permissions: { type: Map, of: [String], default: {} }
}), 'admin');
export const Owner = Admin;
export const Customer = mongoose.models.Customer || User.discriminator('customer', new mongoose.Schema({
  marketingOptIn: { type: Boolean, default: false }
}), 'customer');
