import mongoose from 'mongoose';

const categorySchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  slug: { type: String, trim: true, index: true },
  description: String,
  image: String,
  availableSizes: {
    type: [String],
    enum: ['small', 'medium', 'large', '9_inch', '10_inch', '11_inch', '12_inch', 'family'],
    default: []
  },
  isVisible: { type: Boolean, default: true },
  isActive: { type: Boolean, default: true }
}, { timestamps: true });
export const FoodCategory = mongoose.models.FoodCategory || mongoose.model('FoodCategory', categorySchema);

const menuItemSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  slug: { type: String, trim: true, index: true },
  description: String,
  image: String,
  category: { type: mongoose.Schema.Types.ObjectId, ref: 'FoodCategory', required: true, index: true },
  availableSizes: {
    type: [String],
    enum: ['small', 'medium', 'large', '9_inch', '10_inch', '11_inch', '12_inch', 'family'],
    default: []
  },
  dietary: { type: [String], enum: ['vegetarian', 'vegan', 'spicy', 'gluten_free', 'meat_lovers'], default: [] },
  mealTimes: { type: [String], enum: ['breakfast', 'snacks', 'dinner', 'late_night'], default: [] },
  sizePricing: [{
    size: {
      type: String,
      enum: ['small', 'medium', 'large', '9_inch', '10_inch', '11_inch', '12_inch', 'family'],
      required: true
    },
    adjustment: { type: Number, required: true }
  }],
  spicyLevels: {
    type: [String],
    enum: ['25_percent', '50_percent', '75_percent', 'super_duper_naga'],
    default: []
  },
  regularPrice: { type: Number, required: true, min: 0 },
  offerPrice: { type: Number, min: 0 },
  minimumPreparationMinutes: { type: Number, required: true, min: 0 },
  isAvailable: { type: Boolean, default: true, index: true },
  isFeatured: { type: Boolean, default: false },
  isBestSeller: { type: Boolean, default: false },
  ratingAverage: { type: Number, min: 0, max: 5, default: 0 },
  ratingCount: { type: Number, min: 0, default: 0 }
}, { timestamps: true });
menuItemSchema.index({ name: 'text', description: 'text' });
export const FoodItem = mongoose.models.FoodItem || mongoose.model('FoodItem', menuItemSchema);

const reviewSchema = new mongoose.Schema({
  foodItem: { type: mongoose.Schema.Types.ObjectId, ref: 'FoodItem', required: true, index: true },
  customer: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  guestName: String,
  rating: { type: Number, required: true, min: 1, max: 5 },
  comment: String,
  isVisible: { type: Boolean, default: true }
}, { timestamps: true });
reviewSchema.index({ foodItem: 1, customer: 1 }, { unique: true, sparse: true });
export const FoodReview = mongoose.models.FoodReview || mongoose.model('FoodReview', reviewSchema);

const couponSchema = new mongoose.Schema({
  code: { type: String, required: true, uppercase: true, unique: true, trim: true },
  description: String,
  discountType: { type: String, enum: ['percentage', 'fixed'], required: true },
  discountValue: { type: Number, required: true, min: 0 },
  minimumOrderAmount: { type: Number, min: 0, default: 0 },
  usageLimit: Number,
  usedCount: { type: Number, default: 0 },
  validFrom: Date,
  validUntil: Date,
  isActive: { type: Boolean, default: true }
}, { timestamps: true });
export const Coupon = mongoose.models.Coupon || mongoose.model('Coupon', couponSchema);
