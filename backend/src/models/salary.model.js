import mongoose from 'mongoose';

const salarySchema = new mongoose.Schema({
  employee: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  employeeId: String,
  designation: String,
  salaryMonth: { type: String, required: true, match: /^\d{4}-\d{2}$/ },
  basicSalary: { type: Number, required: true, min: 0 },
  allowances: { type: Number, default: 0, min: 0 },
  deductions: { type: Number, default: 0, min: 0 },
  totalPayable: { type: Number, required: true, min: 0 },
  paymentAmount: { type: Number, min: 0 },
  paymentDate: Date,
  paymentMethod: { type: String, enum: ['cash', 'bank_transfer', 'mobile_banking'] },
  paymentReference: String,
  notes: String,
  status: { type: String, enum: ['unpaid', 'awaiting_confirmation', 'paid_confirmed', 'payment_disputed'], default: 'unpaid', index: true },
  enteredBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  confirmation: {
    confirmedAt: Date,
    issue: String
  }
}, { timestamps: true });
salarySchema.index({ employee: 1, salaryMonth: 1 }, { unique: true });
export const SalaryPayment = mongoose.models.SalaryPayment || mongoose.model('SalaryPayment', salarySchema);
