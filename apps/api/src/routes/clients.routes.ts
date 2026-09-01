import { Router } from 'express';
import { z } from 'zod';
import { Client } from '../models/Client.js';
import { nextSequence } from '../models/Counter.js';
import { authenticate, requirePermission } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { AppError } from '../utils/AppError.js';
import { escapeRegex, normalizePhone, normalizeText } from '../utils/normalize.js';
import { audit } from '../services/audit.js';
import { ServiceOrder } from '../models/ServiceOrder.js';
import { clientSchema, clientUpdateSchema, objectId, paginationQuery } from './schemas.js';

export const clientsRouter = Router();
clientsRouter.use(authenticate);

clientsRouter.get('/', requirePermission('clients:view'), validate(paginationQuery, 'query'), asyncHandler(async (req, res) => {
  const { page, limit, search, active } = req.validatedQuery as z.infer<typeof paginationQuery>;
  const filter: Record<string, unknown> = {};
  if (active !== 'all') filter.active = active === 'true';
  if (search) {
    const rx = new RegExp(escapeRegex(search), 'i');
    const phone = normalizePhone(search);
    filter.$or = [
      { clientCode: rx },
      { firstName: rx },
      { lastName: rx },
      { fullNameNormalized: new RegExp(escapeRegex(normalizeText(search)), 'i') },
      { phone: rx },
      ...(phone ? [{ phoneNormalized: new RegExp(escapeRegex(phone)) }] : []),
      { email: rx }
    ];
  }
  const [data, total] = await Promise.all([
    Client.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit),
    Client.countDocuments(filter)
  ]);
  res.json({ data, pagination: { page, limit, total, pages: Math.ceil(total / limit) } });
}));

clientsRouter.get('/duplicates', requirePermission('clients:view'), asyncHandler(async (req, res) => {
  const name = normalizeText(String(req.query.name || ''));
  const phone = normalizePhone(String(req.query.phone || ''));
  const filters: Record<string, unknown>[] = [];
  if (name.length >= 3) filters.push({ fullNameNormalized: new RegExp(escapeRegex(name), 'i') });
  if (phone.length >= 7) filters.push({ phoneNormalized: phone });
  const data = filters.length ? await Client.find({ active: true, $or: filters }).limit(8) : [];
  res.json({ data });
}));

clientsRouter.get('/:id/history', requirePermission('clients:view'), validate(z.object({ id: objectId }), 'params'), asyncHandler(async (req, res) => {
  const client = await Client.findById(req.params.id);
  if (!client) throw new AppError('Cliente no encontrado.', 404);
  const orders = await ServiceOrder.find({ client: client._id }).sort({ orderDate: -1 }).select('folio orderDate orderTypeName equipment total paidAmount balance payments status');
  const totals = orders.reduce((acc, order) => ({ orders: acc.orders + 1, total: acc.total + order.total, paid: acc.paid + order.paidAmount, balance: acc.balance + order.balance }), { orders: 0, total: 0, paid: 0, balance: 0 });
  res.json({ data: { client, orders, totals } });
}));

clientsRouter.get('/:id', requirePermission('clients:view'), validate(z.object({ id: objectId }), 'params'), asyncHandler(async (req, res) => {
  const data = await Client.findById(req.params.id);
  if (!data) throw new AppError('Cliente no encontrado.', 404);
  res.json({ data });
}));

clientsRouter.post('/', requirePermission('clients:create'), validate(clientSchema), asyncHandler(async (req, res) => {
  const sequence = await nextSequence('client');
  const data = await Client.create({
    ...req.body,
    clientCode: `CLI-${String(sequence).padStart(5, '0')}`,
    createdBy: req.user?.id,
    updatedBy: req.user?.id
  });
  const possibleDuplicates = await Client.find({
    _id: { $ne: data._id },
    active: true,
    $or: [
      { phoneNormalized: data.phoneNormalized },
      { fullNameNormalized: data.fullNameNormalized }
    ]
  }).limit(5);
  await audit(req, 'create', 'client', data.id, { clientCode: data.clientCode });
  res.status(201).json({ data, possibleDuplicates, message: 'Cliente guardado.' });
}));

clientsRouter.put('/:id', requirePermission('clients:edit'), validate(z.object({ id: objectId }), 'params'), validate(clientUpdateSchema), asyncHandler(async (req, res) => {
  const data = await Client.findById(req.params.id);
  if (!data) throw new AppError('Cliente no encontrado.', 404);
  const { revision, ...changes } = req.body;
  if (revision !== undefined && data.get('revision') !== revision) throw new AppError('El cliente fue modificado en otra ventana. Actualiza e intenta nuevamente.', 409);
  Object.assign(data, changes, { updatedBy: req.user?.id });
  await data.save();
  await audit(req, 'update', 'client', data.id, { fields: Object.keys(changes) });
  res.json({ data, message: 'Cliente actualizado.' });
}));

clientsRouter.patch('/:id/deactivate', requirePermission('clients:deactivate'), validate(z.object({ id: objectId }), 'params'), asyncHandler(async (req, res) => {
  const data = await Client.findByIdAndUpdate(req.params.id, { active: false, updatedBy: req.user?.id }, { new: true });
  if (!data) throw new AppError('Cliente no encontrado.', 404);
  await audit(req, 'deactivate', 'client', data.id);
  res.json({ data, message: 'Cliente desactivado.' });
}));
