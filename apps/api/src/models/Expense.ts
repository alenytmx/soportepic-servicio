import mongoose from 'mongoose';

const expenseSchema = new mongoose.Schema({
  expenseCode: { type: String, required: true, unique: true, index: true },
  expenseDate: { type: Date, required: true, default: Date.now, index: true },
  concept: { type: String, required: true, trim: true, maxlength: 200 },
  category: { type: String, required: true, trim: true, maxlength: 100, index: true },
  amount: { type: Number, required: true, min: 0.01 },
  paymentMethod: { type: String, enum: ['Efectivo', 'Transferencia'], required: true },
  serviceOrder: { type: mongoose.Schema.Types.ObjectId, ref: 'ServiceOrder', default: null },
  notes: { type: String, trim: true, maxlength: 500, default: '' },
  status: { type: String, enum: ['Activo', 'Cancelado'], default: 'Activo', index: true },
  cancellationReason: { type: String, trim: true, maxlength: 300, default: '' },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  createdByName: { type: String, required: true },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }
}, { timestamps: true, versionKey: 'revision', optimisticConcurrency: true });

expenseSchema.index({ status: 1, expenseDate: -1 });

export const Expense = mongoose.model('Expense', expenseSchema);
