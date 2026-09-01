import mongoose from 'mongoose';

const quotationTypeSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 100, unique: true },
  description: { type: String, trim: true, maxlength: 300, default: '' },
  active: { type: Boolean, default: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }
}, { timestamps: true, versionKey: 'revision' });

export const QuotationType = mongoose.model('QuotationType', quotationTypeSchema);

export const DEFAULT_QUOTATION_TYPES = [
  ['Diagnóstico y reparación', 'Diagnóstico, mano de obra y refacciones.'],
  ['Cambio de pantalla', 'Pantalla, instalación y pruebas.'],
  ['Mantenimiento preventivo', 'Limpieza, revisión y optimización.'],
  ['Recuperación de información', 'Evaluación y recuperación de archivos.'],
  ['Venta e instalación de refacción', 'Suministro e instalación de componentes.']
] as const;
