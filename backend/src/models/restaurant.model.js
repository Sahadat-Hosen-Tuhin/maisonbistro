import mongoose from 'mongoose';

const sectionSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  type: { type: String, enum: ['vip', 'family', 'general', 'outdoor', 'other'], default: 'general' },
  description: String
}, { _id: true });

const floorSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  description: String,
  sections: [sectionSchema],
  isActive: { type: Boolean, default: true }
}, { timestamps: true });
export const Floor = mongoose.models.Floor || mongoose.model('Floor', floorSchema);

const tableSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  capacity: { type: Number, required: true, min: 1 },
  floor: { type: mongoose.Schema.Types.ObjectId, ref: 'Floor', required: true, index: true },
  sectionId: mongoose.Schema.Types.ObjectId,
  status: { type: String, enum: ['available', 'occupied', 'reserved'], default: 'available', index: true },
  position: { x: Number, y: Number, rotation: Number },
  isActive: { type: Boolean, default: true }
}, { timestamps: true });
tableSchema.index({ floor: 1, name: 1 }, { unique: true });
export const RestaurantTable = mongoose.models.RestaurantTable || mongoose.model('RestaurantTable', tableSchema);

const settingsSchema = new mongoose.Schema({
  restaurantName: { type: String, required: true, trim: true },
  logo: String,
  banner: String,
  address: String,
  phone: String,
  email: String,
  openingHours: mongoose.Schema.Types.Mixed,
  currency: { type: String, default: 'BDT' },
  timeZone: { type: String, default: 'Asia/Dhaka' },
  dateTimeFormat: { type: String, default: 'DD/MM/YYYY HH:mm' },
  taxPercentage: { type: Number, min: 0, default: 0 },
  serviceChargePercentage: { type: Number, min: 0, default: 0 },
  enabledOrderTypes: { type: [String], default: ['dine_in', 'takeaway', 'online', 'walk_in'] },
  reservation: {
    timeSlots: [String],
    bookingCapacity: Number,
    policy: String
  },
  printer: { paperWidth: { type: Number, enum: [58, 80], default: 80 }, preferences: mongoose.Schema.Types.Mixed },
  onlineOrdersEnabled: { type: Boolean, default: true },
  websiteVisible: { type: Boolean, default: true },
  maintenanceMode: { type: Boolean, default: false },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });
export const RestaurantSettings = mongoose.models.RestaurantSettings || mongoose.model('RestaurantSettings', settingsSchema);
