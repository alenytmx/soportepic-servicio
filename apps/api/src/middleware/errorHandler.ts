import type { ErrorRequestHandler, RequestHandler } from 'express';
import mongoose from 'mongoose';
import multer from 'multer';
import { AppError } from '../utils/AppError.js';
import { env } from '../config/env.js';

export const notFound: RequestHandler = (req, _res, next) => {
  next(new AppError(`Ruta no encontrada: ${req.method} ${req.originalUrl}`, 404, 'NOT_FOUND'));
};

export const errorHandler: ErrorRequestHandler = (error, req, res, _next) => {
  let statusCode = error instanceof AppError ? error.statusCode : 500;
  let message = error instanceof AppError ? error.message : 'Ocurrio un error inesperado.';
  let code = error instanceof AppError ? error.code : 'INTERNAL_ERROR';
  let details = error instanceof AppError ? error.details : undefined;

  if (error instanceof mongoose.Error.ValidationError) {
    statusCode = 422;
    message = 'Revisa los datos capturados.';
    code = 'DATABASE_VALIDATION';
    details = Object.values(error.errors).map((item) => item.message);
  } else if (error instanceof mongoose.Error.CastError) {
    statusCode = 400;
    message = 'El identificador enviado no es valido.';
    code = 'INVALID_ID';
  } else if ((error as { code?: number }).code === 11000) {
    statusCode = 409;
    message = 'Ya existe un registro con esos datos.';
    code = 'DUPLICATE_RECORD';
  } else if (error instanceof multer.MulterError) {
    statusCode = 422;
    message = error.code === 'LIMIT_FILE_SIZE' ? 'Una fotografia supera el tamaño permitido.' : 'No fue posible procesar las fotografias.';
    code = error.code;
  }

  if (statusCode >= 500) console.error(`[${req.requestId}]`, error);

  res.status(statusCode).json({
    message,
    code,
    details,
    requestId: req.requestId,
    ...(env.NODE_ENV === 'development' && statusCode >= 500 ? { debug: String(error?.message || error) } : {})
  });
};
