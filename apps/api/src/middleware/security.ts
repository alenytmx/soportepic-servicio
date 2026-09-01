import type { RequestHandler } from 'express';
import { AppError } from '../utils/AppError.js';

function hasUnsafeKey(value: unknown): boolean {
  if (!value || typeof value !== 'object') return false;
  if (Array.isArray(value)) return value.some(hasUnsafeKey);
  return Object.entries(value as Record<string, unknown>).some(([key, nested]) =>
    key.startsWith('$') || key.includes('.') || ['__proto__', 'prototype', 'constructor'].includes(key) || hasUnsafeKey(nested)
  );
}

export const rejectUnsafePayload: RequestHandler = (req, _res, next) => {
  if (hasUnsafeKey(req.body) || hasUnsafeKey(req.query) || hasUnsafeKey(req.params)) {
    return next(new AppError('La solicitud contiene campos no permitidos.', 400, 'UNSAFE_PAYLOAD'));
  }
  next();
};

export function sameOriginForMutations(isAllowedOrigin: (origin?: string) => boolean): RequestHandler {
  return (req, _res, next) => {
    if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
    const origin = req.header('origin');
    if (isAllowedOrigin(origin)) return next();
    return next(new AppError('Origen de solicitud no permitido.', 403, 'INVALID_ORIGIN'));
  };
}
