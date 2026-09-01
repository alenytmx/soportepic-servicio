import mongoose from 'mongoose';

const setupLockSchema = new mongoose.Schema({
  _id: { type: String, default: 'initial-admin' },
  createdAt: { type: Date, default: Date.now }
}, { versionKey: false });

export const SetupLock = mongoose.model('SetupLock', setupLockSchema);
