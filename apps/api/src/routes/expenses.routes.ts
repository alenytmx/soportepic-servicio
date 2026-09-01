import { Router } from 'express';
import { z } from 'zod';
import { Expense } from '../models/Expense.js';
import { ServiceOrder } from '../models/ServiceOrder.js';
import { nextSequence } from '../models/Counter.js';
import { authenticate, requirePermission } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { AppError } from '../utils/AppError.js';
import { escapeRegex } from '../utils/normalize.js';
import { money } from '../utils/money.js';
import { audit } from '../services/audit.js';
import { cancelExpenseSchema, expenseSchema, expenseUpdateSchema, objectId } from './schemas.js';

export const expensesRouter = Router();
expensesRouter.use(authenticate);

const listSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
  search: z.string().trim().max(120).default(''),
  status: z.enum(['Activo', 'Cancelado', 'Todos']).default('Activo'),
  start: z.string().datetime().optional(),
  end: z.string().datetime().optional()
});

expensesRouter.get('/', requirePermission('expenses:view'), validate(listSchema, 'query'), asyncHandler(async (req, res) => {
  const { page, limit, search, status, start, end } = req.validatedQuery as z.infer<typeof listSchema>;
  const filter: Record<string, any> = {};
  if (status !== 'Todos') filter.status = status;
  if (search) {
    const rx = new RegExp(escapeRegex(search), 'i');
    filter.$or = [{ expenseCode: rx }, { concept: rx }, { category: rx }, { createdByName: rx }];
  }
  if (start || end) {
    filter.expenseDate = {};
    if (start) filter.expenseDate.$gte = new Date(start);
    if (end) filter.expenseDate.$lte = new Date(end);
  }
  const [data, total] = await Promise.all([
    Expense.find(filter).populate('serviceOrder', 'folio clientSnapshot.name').sort({ expenseDate: -1 }).skip((page - 1) * limit).limit(limit),
    Expense.countDocuments(filter)
  ]);
  res.json({ data, pagination: { page, limit, total, pages: Math.ceil(total / limit) } });
}));

expensesRouter.post('/', requirePermission('expenses:create'), validate(expenseSchema), asyncHandler(async (req, res) => {
  if (req.body.serviceOrderId && !(await ServiceOrder.exists({ _id: req.body.serviceOrderId }))) {
    throw new AppError('La orden relacionada no existe.', 422);
  }
  const sequence = await nextSequence('expense');
  const data = await Expense.create({
    expenseCode: `GAS-${String(sequence).padStart(6, '0')}`,
    expenseDate: req.body.expenseDate,
    concept: req.body.concept,
    category: req.body.category,
    amount: money(req.body.amount),
    paymentMethod: req.body.paymentMethod,
    serviceOrder: req.body.serviceOrderId || null,
    notes: req.body.notes,
    createdBy: req.user?.id,
    createdByName: req.user?.name,
    updatedBy: req.user?.id
  });
  await audit(req, 'create', 'expense', data.id, { code: data.expenseCode, amount: data.amount });
  req.app.get('io')?.emit('expenses:changed', { id: data.id, action: 'created' });
  res.status(201).json({ data, message: 'Gasto registrado.' });
}));

expensesRouter.put('/:id', requirePermission('expenses:edit'), validate(z.object({ id: objectId }), 'params'), validate(expenseUpdateSchema), asyncHandler(async (req, res) => {
  const data = await Expense.findById(req.params.id);
  if (!data) throw new AppError('Gasto no encontrado.', 404);
  if (data.status === 'Cancelado') throw new AppError('Un gasto cancelado no puede editarse.', 409);
  const { revision, serviceOrderId, ...changes } = req.body;
  if (revision !== undefined && data.get('revision') !== revision) throw new AppError('El gasto fue modificado en otra ventana.', 409);
  if (serviceOrderId !== undefined) {
    if (serviceOrderId && !(await ServiceOrder.exists({ _id: serviceOrderId }))) throw new AppError('La orden relacionada no existe.', 422);
    data.serviceOrder = serviceOrderId || null;
  }
  if (changes.amount !== undefined) changes.amount = money(changes.amount);
  Object.assign(data, changes, { updatedBy: req.user?.id });
  await data.save();
  await audit(req, 'update', 'expense', data.id, { fields: Object.keys(changes) });
  req.app.get('io')?.emit('expenses:changed', { id: data.id, action: 'updated' });
  res.json({ data, message: 'Gasto actualizado.' });
}));

expensesRouter.post('/:id/cancel', requirePermission('expenses:cancel'), validate(z.object({ id: objectId }), 'params'), validate(cancelExpenseSchema), asyncHandler(async (req, res) => {
  const data = await Expense.findOneAndUpdate(
    { _id: req.params.id, status: 'Activo' },
    { status: 'Cancelado', cancellationReason: req.body.reason, updatedBy: req.user?.id },
    { new: true }
  );
  if (!data) throw new AppError('El gasto no existe o ya fue cancelado.', 409);
  await audit(req, 'cancel', 'expense', data.id, { reason: req.body.reason, amount: data.amount });
  req.app.get('io')?.emit('expenses:changed', { id: data.id, action: 'cancelled' });
  res.json({ data, message: 'Gasto cancelado.' });
}));
