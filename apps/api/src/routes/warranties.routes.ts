import { Router } from 'express';
import { z } from 'zod';
import { Warranty } from '../models/Warranty.js';
import { ServiceOrder } from '../models/ServiceOrder.js';
import { nextSequence } from '../models/Counter.js';
import { authenticate, requirePermission } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { AppError } from '../utils/AppError.js';
import { audit } from '../services/audit.js';
import { objectId } from './schemas.js';
import { createWarrantyPdf } from '../services/simpleDocumentsPdf.js';
import { pdfToBuffer } from '../utils/pdfBuffer.js';

const listSchema = z.object({ page: z.coerce.number().int().min(1).default(1), limit: z.coerce.number().int().min(1).max(100).default(10), search: z.string().trim().max(120).default('') });
const createSchema = z.object({ serviceOrderId: objectId, startDate: z.coerce.date(), expirationDate: z.coerce.date(), coveredParts: z.array(z.string().trim().min(1).max(180)).min(1), exclusionReason: z.string().trim().max(1000).default(''), terms: z.string().trim().max(1500).default('') }).refine(v => v.expirationDate >= v.startDate, { message: 'El vencimiento debe ser posterior al inicio' });
const claimSchema = z.object({ description: z.string().trim().min(3).max(800), resolution: z.string().trim().max(800).default(''), status: z.enum(['Abierta', 'En revision', 'Resuelta', 'Rechazada']).default('Abierta') });
export const warrantiesRouter = Router();
warrantiesRouter.use(authenticate);
warrantiesRouter.get('/', requirePermission('warranties:view'), validate(listSchema, 'query'), asyncHandler(async (req, res) => {
  const { page, limit, search } = req.validatedQuery as z.infer<typeof listSchema>; const rx = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
  await Warranty.updateMany({ status: 'Vigente', expirationDate: { $lt: new Date() } }, { status: 'Vencida' });
  const filter = search ? { $or: [{ warrantyCode: rx }, { orderFolio: rx }, { clientName: rx }] } : {};
  const [data, total] = await Promise.all([Warranty.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit), Warranty.countDocuments(filter)]);
  res.json({ data, pagination: { page, limit, total, pages: Math.ceil(total / limit) } });
}));
warrantiesRouter.post('/', requirePermission('warranties:edit'), validate(createSchema), asyncHandler(async (req, res) => {
  const order = await ServiceOrder.findById(req.body.serviceOrderId); if (!order) throw new AppError('Orden no encontrada.', 404);
  const n = await nextSequence('warranty');
  const data = await Warranty.create({ ...req.body, warrantyCode: `GAR-${String(n).padStart(6, '0')}`, warrantyNumber: n, serviceOrder: order._id, client: order.client, clientName: order.clientSnapshot?.name || 'Cliente', orderFolio: order.folio, createdBy: req.user?.id, createdByName: req.user?.name, updatedBy: req.user?.id });
  await audit(req, 'create', 'warranty', data.id, { code: data.warrantyCode });
  res.status(201).json({ data, message: 'Garantía registrada.' });
}));
warrantiesRouter.post('/:id/claims', requirePermission('warranties:edit'), validate(z.object({ id: objectId }), 'params'), validate(claimSchema), asyncHandler(async (req, res) => {
  const data = await Warranty.findByIdAndUpdate(req.params.id, { $push: { claims: { ...req.body, createdByName: req.user?.name } }, $set: { updatedBy: req.user?.id } }, { new: true, runValidators: true });
  if (!data) throw new AppError('Garantía no encontrada.', 404);
  await audit(req, 'claim', 'warranty', data.id, { status: req.body.status });
  res.status(201).json({ data, message: 'Reclamación agregada al historial.' });
}));
warrantiesRouter.get('/:id/pdf', requirePermission('warranties:view'), validate(z.object({ id: objectId }), 'params'), asyncHandler(async (req, res) => {
  const item = await Warranty.findById(req.params.id); if (!item) throw new AppError('Garantía no encontrada.', 404);
  const buffer = await pdfToBuffer(await createWarrantyPdf(item.toObject()));
  res.setHeader('Content-Type', 'application/pdf'); res.setHeader('Content-Disposition', `inline; filename="${item.warrantyCode}.pdf"`); res.setHeader('Content-Length', buffer.length); res.send(buffer);
}));
