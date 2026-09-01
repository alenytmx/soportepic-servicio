import { Router } from 'express';
import { z } from 'zod';
import { QuotationType } from '../models/QuotationType.js';
import { authenticate, requirePermission } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { audit } from '../services/audit.js';
import { objectId, paginationQuery } from './schemas.js';

const bodySchema = z.object({ name: z.string().trim().min(2).max(100), description: z.string().trim().max(300).default(''), active: z.boolean().default(true) });
export const quotationTypesRouter = Router();
quotationTypesRouter.use(authenticate);
quotationTypesRouter.get('/', requirePermission('quotationTypes:view'), validate(paginationQuery, 'query'), asyncHandler(async (req, res) => {
  const { page, limit, search, active } = req.validatedQuery as z.infer<typeof paginationQuery>;
  const filter: any = active === 'all' ? {} : { active: active === 'true' };
  if (search) filter.name = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
  const [data, total] = await Promise.all([QuotationType.find(filter).sort({ name: 1 }).skip((page - 1) * limit).limit(limit), QuotationType.countDocuments(filter)]);
  res.json({ data, pagination: { page, limit, total, pages: Math.ceil(total / limit) } });
}));
quotationTypesRouter.post('/', requirePermission('quotationTypes:edit'), validate(bodySchema), asyncHandler(async (req, res) => {
  const data = await QuotationType.create({ ...req.body, createdBy: req.user?.id, updatedBy: req.user?.id });
  await audit(req, 'create', 'quotationType', data.id, { name: data.name });
  res.status(201).json({ data, message: 'Tipo de cotización guardado.' });
}));
quotationTypesRouter.put('/:id', requirePermission('quotationTypes:edit'), validate(z.object({ id: objectId }), 'params'), validate(bodySchema.partial()), asyncHandler(async (req, res) => {
  const data = await QuotationType.findByIdAndUpdate(req.params.id, { ...req.body, updatedBy: req.user?.id }, { new: true, runValidators: true });
  res.json({ data, message: 'Tipo de cotización actualizado.' });
}));
