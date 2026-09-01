import { Router } from 'express';
import { authenticate, requirePermission } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { BusinessSettings, getBusinessSettings } from '../models/BusinessSettings.js';
import { settingsSchema } from './schemas.js';
import { audit } from '../services/audit.js';
import { uploadLogo, uploadDirectory } from '../middleware/upload.js';
import fs from 'node:fs';
import path from 'node:path';
import mongoose from 'mongoose';
import { z } from 'zod';
import { AuditLog } from '../models/AuditLog.js';
import { AppError } from '../utils/AppError.js';

export const settingsRouter = Router();
settingsRouter.use(authenticate);

settingsRouter.get('/', requirePermission('settings:view'), asyncHandler(async (_req, res) => {
  res.json({ data: await getBusinessSettings() });
}));

settingsRouter.get('/logo', asyncHandler(async (_req, res) => {
  const settings = await getBusinessSettings();
  const filename = path.basename(settings.logoFilename || '');
  const filePath = path.join(uploadDirectory, filename);
  if (!filename || !fs.existsSync(filePath)) return res.status(404).json({ message: 'Logotipo no configurado.' });
  res.setHeader('Cache-Control', 'private, max-age=3600');
  res.sendFile(filePath);
}));

settingsRouter.post('/logo', requirePermission('settings:edit'), uploadLogo, asyncHandler(async (req, res) => {
  if (!req.file) return res.status(422).json({ message: 'Selecciona una imagen JPG o PNG.' });
  const previous = await getBusinessSettings();
  const oldFilename = path.basename(previous.logoFilename || '');
  const data = await BusinessSettings.findByIdAndUpdate('main', { $set: { logoFilename: req.file.filename, logoUrl: '/api/settings/logo' } }, { new: true, upsert: true });
  if (oldFilename && oldFilename !== req.file.filename) fs.promises.unlink(path.join(uploadDirectory, oldFilename)).catch(() => undefined);
  await audit(req, 'updateLogo', 'settings', 'main', { filename: req.file.filename });
  req.app.get('io')?.emit('settings:changed', { action: 'logo' });
  res.json({ data, message: 'Logotipo actualizado.' });
}));

settingsRouter.put('/', requirePermission('settings:edit'), validate(settingsSchema), asyncHandler(async (req, res) => {
  const data = await BusinessSettings.findByIdAndUpdate(
    'main',
    { $set: req.body, $setOnInsert: { _id: 'main' } },
    { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true }
  );
  await audit(req, 'update', 'settings', 'main', { fields: Object.keys(req.body) });
  req.app.get('io')?.emit('settings:changed', { action: 'updated' });
  res.json({ data, message: 'Configuracion guardada.' });
}));

settingsRouter.post('/reset-data', requirePermission('settings:edit'), validate(z.object({ confirmation: z.literal('REINICIAR DATOS') })), asyncHandler(async (req, res) => {
  if (req.user?.role !== 'admin') throw new AppError('Solo un administrador puede reiniciar la base de datos.', 403);
  const db = mongoose.connection.db; if (!db) throw new AppError('MongoDB no está disponible.', 503);
  const keep = new Set(['users', 'setuplocks']);
  const collections = await db.collections();
  for (const collection of collections) if (!keep.has(collection.collectionName)) await collection.deleteMany({});
  const files = await fs.promises.readdir(uploadDirectory).catch(() => [] as string[]);
  await Promise.all(files.filter((name) => name !== '.gitkeep').map((name) => fs.promises.unlink(path.join(uploadDirectory, path.basename(name))).catch(() => undefined)));
  await AuditLog.create({ userId: req.user._id, username: req.user.username, action: 'resetDatabase', entity: 'database', details: { preserved: ['users'] }, ip: req.ip, requestId: req.requestId });
  req.app.get('io')?.emit('database:reset', { by: req.user.username });
  res.json({ message: 'La base de datos fue reiniciada. Los usuarios se conservaron y los contadores comenzarán desde cero.' });
}));
