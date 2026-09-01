import mongoose from 'mongoose';
import { normalizePhone, normalizeText } from '../utils/normalize.js';

const addressSchema = new mongoose.Schema({
  street: { type: String, trim: true, maxlength: 150, default: '' },
  neighborhood: { type: String, trim: true, maxlength: 100, default: '' },
  city: { type: String, trim: true, maxlength: 100, default: '' },
  state: { type: String, trim: true, maxlength: 100, default: '' },
  postalCode: { type: String, trim: true, maxlength: 10, default: '' }
}, { _id: false });

const clientSchema = new mongoose.Schema({
  clientCode: { type: String, unique: true, required: true, index: true },
  firstName: { type: String, required: true, trim: true, maxlength: 80 },
  lastName: { type: String, trim: true, maxlength: 100, default: '' },
  fullNameNormalized: { type: String, index: true },
  phone: { type: String, required: true, trim: true, maxlength: 30 },
  phoneNormalized: { type: String, index: true },
  alternatePhone: { type: String, trim: true, maxlength: 30, default: '' },
  email: { type: String, trim: true, lowercase: true, maxlength: 150, default: '' },
  address: { type: addressSchema, default: () => ({}) },
  references: { type: String, trim: true, maxlength: 500, default: '' },
  notes: { type: String, trim: true, maxlength: 1000, default: '' },
  active: { type: Boolean, default: true, index: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }
}, { timestamps: true, versionKey: 'revision' });

clientSchema.pre('validate', function () {
  this.fullNameNormalized = normalizeText(`${this.firstName} ${this.lastName}`);
  this.phoneNormalized = normalizePhone(this.phone);
});

clientSchema.index({ fullNameNormalized: 1, phoneNormalized: 1 });
clientSchema.index({ createdAt: -1 });

export const Client = mongoose.model('Client', clientSchema);
