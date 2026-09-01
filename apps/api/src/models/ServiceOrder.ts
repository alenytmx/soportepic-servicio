import mongoose from 'mongoose';
import { calculateOrderTotal } from '../utils/orderTotals.js';
import { money } from '../utils/money.js';

export const ORDER_STATUSES = [
  'Pendiente',
  'En diagnostico',
  'En reparacion',
  'Esperando refaccion',
  'Listo para entregar',
  'Entregado',
  'Finalizado',
  'Cancelado'
] as const;

const equipmentSchema = new mongoose.Schema({
  equipmentType: { type: String, required: true, trim: true, maxlength: 80 },
  brand: { type: String, trim: true, maxlength: 80, default: '' },
  model: { type: String, trim: true, maxlength: 100, default: '' },
  serialNumber: { type: String, trim: true, maxlength: 120, default: '' },
  observations: { type: String, trim: true, maxlength: 1500, default: '' },
  accessories: [{ type: String, trim: true, maxlength: 100 }]
});

const photoSchema = new mongoose.Schema({
  filename: { type: String, required: true },
  originalName: { type: String, required: true },
  mimeType: { type: String, required: true },
  size: { type: Number, required: true },
  uploadedAt: { type: Date, default: Date.now }
});

const materialSchema = new mongoose.Schema({
  description: { type: String, required: true, trim: true, maxlength: 200 },
  quantity: { type: Number, required: true, min: 0.01, default: 1 },
  unitCost: { type: Number, required: true, min: 0, default: 0 },
  supplier: { type: String, trim: true, maxlength: 150, default: '' }
});

const paymentSchema = new mongoose.Schema({
  idempotencyKey: { type: String, required: true },
  amount: { type: Number, required: true, min: 0.01 },
  paymentMethod: { type: String, enum: ['Efectivo', 'Transferencia', 'Tarjeta', 'Mixto'], required: true },
  cashAmount: { type: Number, min: 0, default: 0 },
  transferAmount: { type: Number, min: 0, default: 0 },
  cardAmount: { type: Number, min: 0, default: 0 },
  reference: { type: String, trim: true, maxlength: 120, default: '' },
  notes: { type: String, trim: true, maxlength: 300, default: '' },
  status: { type: String, enum: ['Aplicado', 'Cancelado'], default: 'Aplicado' },
  paidAt: { type: Date, default: Date.now },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  createdByName: { type: String, required: true }
});

const statusHistorySchema = new mongoose.Schema({
  status: { type: String, enum: ORDER_STATUSES, required: true },
  changedAt: { type: Date, default: Date.now },
  changedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  changedByName: { type: String, required: true },
  note: { type: String, trim: true, maxlength: 300, default: '' }
});

const serviceOrderSchema = new mongoose.Schema({
  folio: { type: String, required: true, unique: true, index: true },
  folioNumber: { type: Number, required: true, unique: true },
  orderDate: { type: Date, required: true, default: Date.now, index: true },
  client: { type: mongoose.Schema.Types.ObjectId, ref: 'Client', required: true, index: true },
  clientSnapshot: {
    name: { type: String, required: true },
    phone: { type: String, required: true },
    email: { type: String, default: '' },
    address: { type: String, default: '' }
  },
  orderType: { type: mongoose.Schema.Types.ObjectId, ref: 'OrderType', required: true, index: true },
  orderTypeName: { type: String, required: true, index: true },
  customerReference: { type: String, trim: true, maxlength: 500, default: '' },
  equipment: { type: [equipmentSchema], validate: [(items: unknown[]) => items.length >= 1 && items.length <= 10, 'Debe registrar entre 1 y 10 equipos'] },
  photos: { type: [photoSchema], validate: [(items: unknown[]) => items.length <= 5, 'Solo se permiten 5 fotografias'] },
  materials: { type: [materialSchema], default: [] },
  serviceAmount: { type: Number, min: 0 },
  total: { type: Number, min: 0, required: true, default: 0 },
  paidAmount: { type: Number, min: 0, required: true, default: 0 },
  balance: { type: Number, min: 0, required: true, default: 0 },
  payments: { type: [paymentSchema], default: [] },
  status: { type: String, enum: ORDER_STATUSES, default: 'Pendiente', index: true },
  statusHistory: { type: [statusHistorySchema], default: [] },
  deliverySignature: {
    dataUrl: { type: String, maxlength: 300000, default: '' },
    signedAt: { type: Date },
    signedByName: { type: String, maxlength: 120, default: '' },
    receivedBy: { type: String, maxlength: 120, default: '' }
  },
  notes: { type: String, trim: true, maxlength: 1500, default: '' },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  createdByName: { type: String, required: true },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }
}, { timestamps: true, versionKey: 'revision', optimisticConcurrency: true });

serviceOrderSchema.index({ 'clientSnapshot.name': 'text', 'clientSnapshot.phone': 'text', folio: 'text' });
serviceOrderSchema.index({ status: 1, orderDate: -1 });
serviceOrderSchema.index({ orderType: 1, orderDate: -1 });

serviceOrderSchema.pre('validate', function () {
  const serviceAmount = money(Number(this.serviceAmount ?? this.total ?? 0));
  const total = calculateOrderTotal(serviceAmount, this.materials);
  const paidAmount = money(Number(this.paidAmount || 0));
  this.serviceAmount = serviceAmount;
  this.total = total;
  if (paidAmount > total) {
    this.invalidate('total', 'El total no puede ser menor a lo ya abonado.');
    return;
  }
  this.balance = money(total - paidAmount);
});

export const ServiceOrder = mongoose.model('ServiceOrder', serviceOrderSchema);
