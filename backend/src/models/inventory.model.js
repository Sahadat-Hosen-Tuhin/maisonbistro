import mongoose from 'mongoose';

const inventorySchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  category: { type: String, required: true, trim: true, index: true },
  quantity: { type: Number, required: true, min: 0, default: 0 },
  unit: { type: String, required: true, trim: true },
  lowStockThreshold: { type: Number, min: 0, default: 0 },
  costPerUnit: { type: Number, min: 0, default: 0 },
  isActive: { type: Boolean, default: true }
}, { timestamps: true });
inventorySchema.index({ name: 1, unit: 1 }, { unique: true });
export const InventoryItem = mongoose.models.InventoryItem || mongoose.model('InventoryItem', inventorySchema);

const purchaseSchema = new mongoose.Schema({
  item: { type: mongoose.Schema.Types.ObjectId, ref: 'InventoryItem', required: true, index: true },
  itemName: { type: String, required: true },
  category: String,
  quantity: { type: Number, required: true, min: 0 },
  unit: { type: String, required: true },
  unitPrice: { type: Number, required: true, min: 0 },
  totalAmount: { type: Number, required: true, min: 0 },
  purchaseDate: { type: Date, required: true, index: true },
  supplierName: String,
  receiptImage: String,
  notes: String,
  status: { type: String, enum: ['draft', 'confirmed', 'cancelled'], default: 'confirmed' },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }
}, { timestamps: true });
export const Purchase = mongoose.models.Purchase || mongoose.model('Purchase', purchaseSchema);

const movementSchema = new mongoose.Schema({
  item: { type: mongoose.Schema.Types.ObjectId, ref: 'InventoryItem', required: true, index: true },
  type: { type: String, enum: ['stock_in', 'stock_out', 'adjustment'], required: true },
  quantity: { type: Number, required: true },
  unit: String,
  source: { type: String, enum: ['purchase', 'order', 'manual', 'waste'], required: true },
  reference: mongoose.Schema.Types.ObjectId,
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  notes: String
}, { timestamps: true });
export const InventoryMovement = mongoose.models.InventoryMovement || mongoose.model('InventoryMovement', movementSchema);

const expenseSchema = new mongoose.Schema({
  category: { type: String, required: true, index: true },
  description: { type: String, required: true },
  amount: { type: Number, required: true, min: 0 },
  expenseDate: { type: Date, required: true, index: true },
  receiptImage: String,
  notes: String,
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }
}, { timestamps: true });
export const Expense = mongoose.models.Expense || mongoose.model('Expense', expenseSchema);
