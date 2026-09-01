import mongoose from 'mongoose';
import { normalizeText } from '../utils/normalize.js';

const orderTypeSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 80 },
  normalizedName: { type: String, required: true, unique: true, index: true },
  description: { type: String, trim: true, maxlength: 300, default: '' },
  active: { type: Boolean, default: true, index: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }
}, { timestamps: true, versionKey: 'revision' });

orderTypeSchema.pre('validate', function () {
  this.normalizedName = normalizeText(this.name);
});

export const OrderType = mongoose.model('OrderType', orderTypeSchema);
