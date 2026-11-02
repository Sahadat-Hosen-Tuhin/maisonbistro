import mongoose from 'mongoose';

const reservationSchema = new mongoose.Schema({
  reservationNumber: { type: String, required: true, unique: true, index: true },
  customer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
  guest: { name: String, phone: String, email: String },
  date: { type: Date, required: true, index: true },
  startTime: { type: String, required: true },
  endTime: String,
  guestCount: { type: Number, required: true, min: 1 },
  table: { type: mongoose.Schema.Types.ObjectId, ref: 'RestaurantTable' },
  status: { type: String, enum: ['pending', 'confirmed', 'seated', 'completed', 'cancelled', 'no_show'], default: 'pending', index: true },
  notes: String,
  cancellationReason: String,
  managedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });
reservationSchema.index({ date: 1, status: 1 });
export const Reservation = mongoose.models.Reservation || mongoose.model('Reservation', reservationSchema);
