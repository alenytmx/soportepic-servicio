import { Router } from 'express';
import { z } from 'zod';
import { OrderType } from '../models/OrderType.js';
import { authenticate, requirePermission } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { AppError } from '../utils/AppError.js';
import { escapeRegex } from '../utils/normalize.js';
import { audit } from '../services/audit.js';
import { objectId, orderTypeSchema, orderTypeUpdateSchema, paginationQuery } from './schemas.js';

export const orderTypesRouter = Router();
orderTypesRouter.use(authenticate);

orderTypesRouter.get('/', requirePermission('orderTypes:view'), validate(paginationQuery, 'query'), asyncHandler(async (req, res) => {
  const { page, limit, search, active } = req.validatedQuery as z.infer<typeof paginationQuery>;
  const filter: Record<string, unknown> = {};
  if (active !== 'all') filter.active = active === 'true';
  if (search) {
    const rx = new RegExp(escapeRegex(search), 'i');
    filter.$or = [{ name: rx }, { description: rx }];
  }
  const [data, total] = await Promise.all([
    OrderType.find(filter).sort({ name: 1 }).skip((page - 1) * limit).limit(limit),
    OrderType.countDocuments(filter)
  ]);
  res.json({ data, pagination: { page, limit, total, pages: Math.ceil(total / limit) } });
}));

orderTypesRouter.post('/', requirePermission('orderTypes:create'), validate(orderTypeSchema), asyncHandler(async (req, res) => {
  const data = await OrderType.create({ ...req.body, createdBy: req.user?.id, updatedBy: req.user?.id });
  await audit(req, 'create', 'orderType', data.id, { name: data.name });
  res.status(201).json({ data, message: 'Tipo de orden guardado.' });
}));

orderTypesRouter.put('/:id', requirePermission('orderTypes:edit'), validate(z.object({ id: objectId }), 'params'), validate(orderTypeUpdateSchema), asyncHandler(async (req, res) => {
  const data = await OrderType.findById(req.params.id);
  if (!data) throw new AppError('Tipo de orden no encontrado.', 404);
  const { revision, ...changes } = req.body;
  if (revision !== undefined && data.get('revision') !== revision) throw new AppError('El registro fue modificado en otra ventana.', 409);
  Object.assign(data, changes, { updatedBy: req.user?.id });
  await data.save();
  await audit(req, 'update', 'orderType', data.id, { fields: Object.keys(changes) });
  res.json({ data, message: 'Tipo de orden actualizado.' });
}));

orderTypesRouter.patch('/:id/deactivate', requirePermission('orderTypes:deactivate'), validate(z.object({ id: objectId }), 'params'), asyncHandler(async (req, res) => {
  const data = await OrderType.findByIdAndUpdate(req.params.id, { active: false, updatedBy: req.user?.id }, { new: true });
  if (!data) throw new AppError('Tipo de orden no encontrado.', 404);
  await audit(req, 'deactivate', 'orderType', data.id);
  res.json({ data, message: 'Tipo de orden desactivado.' });
}));
