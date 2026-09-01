import type { RequestHandler } from 'express';
import type { ZodType } from 'zod';
import { AppError } from '../utils/AppError.js';

export function validate(schema: ZodType, source: 'body' | 'query' | 'params' = 'body'): RequestHandler {
  return (req, _res, next) => {
    const result = schema.safeParse(req[source]);
    if (!result.success) {
      return next(new AppError('Revisa los datos capturados.', 422, 'VALIDATION_ERROR', result.error.flatten()));
    }
    // Express 5 expone req.query mediante un getter de solo lectura. Guardamos
    // la consulta validada aparte y solo reemplazamos body/params, que sí son mutables.
    if (source === 'query') req.validatedQuery = result.data;
    else (req as unknown as Record<string, unknown>)[source] = result.data;
    next();
  };
}
