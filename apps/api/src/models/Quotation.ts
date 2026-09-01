import mongoose from 'mongoose';

const quotationSchema = new mongoose.Schema({
  folio: { type: String, required: true, unique: true, index: true },
  folioNumber: { type: Number, required: true, unique: true },
  quotationDate: { type: Date, required: true, default: Date.now, index: true },
  client: { type: mongoose.Schema.Types.ObjectId, ref: 'Client', required: true, index: true },
  clientSnapshot: { name: { type: String, required: true }, phone: { type: String, default: '' }, email: { type: String, default: '' } },
  quotationType: { type: mongoose.Schema.Types.ObjectId, ref: 'QuotationType', required: true },
  quotationTypeName: { type: String, required: true },
  references: { type: String, trim: true, maxlength: 500, default: '' },
  equipment: [{ equipmentType: { type: String, required: true, trim: true }, brand: { type: String, default: '' }, model: { type: String, default: '' }, serialNumber: { type: String, default: '' }, observations: { type: String, default: '' } }],
  materials: [{ description: { type: String, required: true }, quantity: { type: Number, min: 0.01, default: 1 }, unitPrice: { type: Number, min: 0, default: 0 } }],
  photos: [{ filename: String, originalName: String, mimeType: String, size: Number }],
  serviceAmount: { type: Number, min: 0, default: 0 },
  total: { type: Number, min: 0, required: true },
  status: { type: String, enum: ['Borrador', 'Enviada', 'Aceptada', 'Rechazada', 'Vencida'], default: 'Borrador', index: true },
  notes: { type: String, trim: true, maxlength: 1500, default: '' },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  createdByName: { type: String, required: true },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }
}, { timestamps: true, versionKey: 'revision' });

export const Quotation = mongoose.model('Quotation', quotationSchema);
