import mongoose from 'mongoose';

const socialSchema = new mongoose.Schema({
  facebook: { type: String, trim: true, maxlength: 200, default: '' },
  instagram: { type: String, trim: true, maxlength: 200, default: '' },
  whatsapp: { type: String, trim: true, maxlength: 30, default: '' },
  website: { type: String, trim: true, maxlength: 200, default: '' }
}, { _id: false });

const businessSettingsSchema = new mongoose.Schema({
  _id: { type: String, default: 'main' },
  businessName: { type: String, trim: true, maxlength: 120, default: 'Mi taller de servicio' },
  brandName: { type: String, trim: true, maxlength: 120, default: 'Soportepic Servicio' },
  slogan: { type: String, trim: true, maxlength: 180, default: 'Reparacion de celulares y computadoras' },
  address: { type: String, trim: true, maxlength: 300, default: '' },
  postalCode: { type: String, trim: true, maxlength: 10, default: '' },
  phone: { type: String, trim: true, maxlength: 30, default: '311-135-45-85' },
  email: { type: String, trim: true, lowercase: true, maxlength: 150, default: '' },
  social: { type: socialSchema, default: () => ({}) },
  logoUrl: { type: String, default: '' },
  logoFilename: { type: String, default: '' },
  printFormat: { type: String, enum: ['a4', 'thermal58', 'thermal80'], default: 'a4' },
  ticketHeader: { type: String, trim: true, maxlength: 300, default: '' },
  ticketFooter: { type: String, trim: true, maxlength: 500, default: 'Gracias por su preferencia.' },
  currency: { type: String, enum: ['MXN'], default: 'MXN' },
  timezone: { type: String, default: 'America/Mazatlan' },
  themeMode: { type: String, enum: ['light', 'dark', 'system'], default: 'system' },
  primaryColor: { type: String, match: /^#[0-9a-f]{6}$/i, default: '#2563eb' },
  fontFamily: { type: String, enum: ['system', 'inter', 'arial', 'georgia'], default: 'system' },
  fontScale: { type: Number, min: 0.85, max: 1.25, default: 1 },
  showThemeToggle: { type: Boolean, default: true },
  showUserName: { type: Boolean, default: true },
  showDateTime: { type: Boolean, default: true },
  systemVersion: { type: String, default: '1.3.0' },
  rightsText: { type: String, default: 'Derechos reservados Soportepic' },
  supportPhone: { type: String, default: '311-135-45-85' }
}, { timestamps: true, versionKey: 'revision' });

export const BusinessSettings = mongoose.model('BusinessSettings', businessSettingsSchema);

export async function getBusinessSettings() {
  return BusinessSettings.findByIdAndUpdate(
    'main',
    { $set: { systemVersion: '1.3.0' }, $setOnInsert: { _id: 'main' } },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  );
}
