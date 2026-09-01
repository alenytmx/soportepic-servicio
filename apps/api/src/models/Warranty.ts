import mongoose from 'mongoose';

const claimSchema = new mongoose.Schema({
  claimDate: { type: Date, default: Date.now },
  description: { type: String, required: true, trim: true, maxlength: 800 },
  resolution: { type: String, trim: true, maxlength: 800, default: '' },
  status: { type: String, enum: ['Abierta', 'En revision', 'Resuelta', 'Rechazada'], default: 'Abierta' },
  createdByName: { type: String, required: true }
});

const warrantySchema = new mongoose.Schema({
  warrantyCode: { type: String, required: true, unique: true, index: true },
  warrantyNumber: { type: Number, required: true, unique: true },
  serviceOrder: { type: mongoose.Schema.Types.ObjectId, ref: 'ServiceOrder', required: true, unique: true, index: true },
  client: { type: mongoose.Schema.Types.ObjectId, ref: 'Client', required: true, index: true },
  clientName: { type: String, required: true },
  orderFolio: { type: String, required: true },
  startDate: { type: Date, required: true, default: Date.now },
  expirationDate: { type: Date, required: true, index: true },
  coveredParts: [{ type: String, trim: true, maxlength: 180 }],
  exclusionReason: { type: String, trim: true, maxlength: 1000, default: '' },
  terms: { type: String, trim: true, maxlength: 1500, default: '' },
  status: { type: String, enum: ['Vigente', 'Vencida', 'Cancelada'], default: 'Vigente', index: true },
  claims: { type: [claimSchema], default: [] },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  createdByName: { type: String, required: true },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }
}, { timestamps: true, versionKey: 'revision' });

export const Warranty = mongoose.model('Warranty', warrantySchema);
