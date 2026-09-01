import type { RequestHandler } from 'express';
import { User } from '../models/User.js';
import { AppError } from '../utils/AppError.js';
import { verifyAccessToken } from '../utils/jwt.js';
import type { Permission } from '../utils/permissions.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const authenticate = asyncHandler(async (req, _res, next) => {
  const bearer = req.header('authorization')?.replace(/^Bearer\s+/i, '');
  const token = req.cookies?.sp_session || bearer;
  if (!token) throw new AppError('Debes iniciar sesion.', 401, 'AUTH_REQUIRED');

  let payload;
  try {
    payload = verifyAccessToken(token);
  } catch {
    throw new AppError('La sesion expiro. Inicia sesion nuevamente.', 401, 'SESSION_EXPIRED');
  }

  const user = await User.findById(payload.sub);
  if (!user || !user.active || user.tokenVersion !== payload.tokenVersion) {
    throw new AppError('La sesion ya no es valida.', 401, 'SESSION_INVALID');
  }
  req.user = user;
  next();
});

export function requirePermission(...permissions: Permission[]): RequestHandler {
  return (req, _res, next) => {
    if (!req.user) return next(new AppError('Debes iniciar sesion.', 401));
    const allowed = req.user.role === 'admin' || permissions.every((permission) => req.user?.permissions.includes(permission));
    if (!allowed) return next(new AppError('No tienes permiso para realizar esta accion.', 403, 'FORBIDDEN'));
    next();
  };
}
