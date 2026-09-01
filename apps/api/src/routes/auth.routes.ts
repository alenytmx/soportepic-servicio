import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { User } from '../models/User.js';
import { SetupLock } from '../models/SetupLock.js';
import { BusinessSettings, getBusinessSettings } from '../models/BusinessSettings.js';
import { validate } from '../middleware/validate.js';
import { authenticate } from '../middleware/auth.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { AppError } from '../utils/AppError.js';
import { signAccessToken } from '../utils/jwt.js';
import { normalizeText } from '../utils/normalize.js';
import { ADMIN_PERMISSIONS } from '../utils/permissions.js';
import { changePasswordSchema, loginSchema, setupSchema } from './schemas.js';
import { env } from '../config/env.js';
import { OrderType } from '../models/OrderType.js';
import { audit } from '../services/audit.js';

export const authRouter = Router();

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 12,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Demasiados intentos. Espera 15 minutos antes de volver a intentar.', code: 'LOGIN_RATE_LIMIT' }
});

function setSessionCookie(res: Parameters<Parameters<typeof authRouter.get>[1]>[1], user: InstanceType<typeof User>) {
  const token = signAccessToken({ sub: user.id, username: user.username, tokenVersion: user.tokenVersion });
  res.cookie('sp_session', token, {
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 8 * 60 * 60 * 1000,
    path: '/'
  });
}

authRouter.get('/setup-status', asyncHandler(async (_req, res) => {
  const userCount = await User.countDocuments();
  res.json({ setupRequired: userCount === 0 });
}));

authRouter.post('/setup-admin', authLimiter, validate(setupSchema), asyncHandler(async (req, res) => {
  if (await User.exists({})) throw new AppError('La configuracion inicial ya fue realizada.', 409);

  const staleBefore = new Date(Date.now() - 10 * 60 * 1000);
  await SetupLock.deleteOne({ _id: 'initial-admin', createdAt: { $lt: staleBefore } });
  try {
    await SetupLock.create({ _id: 'initial-admin' });
  } catch {
    throw new AppError('La configuracion inicial ya esta en proceso.', 409);
  }

  try {
    if (await User.exists({})) throw new AppError('La configuracion inicial ya fue realizada.', 409);
    const { name, username, password, businessName } = req.body;
    const passwordHash = await User.hashPassword(password);
    const user = await User.create({
      name,
      username,
      passwordHash,
      role: 'admin',
      permissions: ADMIN_PERMISSIONS,
      active: true
    });
    if (businessName) {
      await BusinessSettings.findByIdAndUpdate('main', { $set: { businessName } }, { upsert: true, setDefaultsOnInsert: true });
    } else {
      await getBusinessSettings();
    }
    await OrderType.insertMany(
      ['Diagnóstico', 'Reparación', 'Mantenimiento', 'Garantía', 'Instalación'].map((name) => ({
        name,
        normalizedName: normalizeText(name),
        description: '',
        active: true,
        createdBy: user._id,
        updatedBy: user._id
      })),
      { ordered: false }
    ).catch(() => undefined);
    setSessionCookie(res, user);
    res.status(201).json({ user, message: 'Administrador creado correctamente.' });
  } catch (error) {
    await SetupLock.deleteOne({ _id: 'initial-admin' });
    throw error;
  }
}));

authRouter.post('/login', authLimiter, validate(loginSchema), asyncHandler(async (req, res) => {
  const username = normalizeText(req.body.username).replace(/\s/g, '');
  const user = await User.findOne({ username }).select('+passwordHash');
  if (!user || !user.active || !(await user.comparePassword(req.body.password))) {
    throw new AppError('Usuario o contraseña incorrectos.', 401, 'INVALID_CREDENTIALS');
  }
  user.lastLoginAt = new Date();
  await user.save();
  setSessionCookie(res, user);
  res.json({ user, message: 'Sesion iniciada.' });
}));

authRouter.get('/me', authenticate, asyncHandler(async (req, res) => {
  res.json({ user: req.user });
}));

authRouter.post('/logout', (_req, res) => {
  res.clearCookie('sp_session', { path: '/' });
  res.json({ message: 'Sesion cerrada.' });
});

authRouter.post('/change-password', authenticate, validate(changePasswordSchema), asyncHandler(async (req, res) => {
  const user = await User.findById(req.user?.id).select('+passwordHash');
  if (!user || !(await user.comparePassword(req.body.currentPassword))) {
    throw new AppError('La contraseña actual no es correcta.', 422);
  }
  user.passwordHash = await User.hashPassword(req.body.newPassword);
  user.tokenVersion += 1;
  await user.save();
  await audit(req, 'passwordUpdate', 'settings', user.id, { section: 'security' });
  setSessionCookie(res, user);
  res.json({ message: 'Contraseña actualizada correctamente.' });
}));
