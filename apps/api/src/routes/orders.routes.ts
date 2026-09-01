import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { Router } from 'express';
import type { Request } from 'express';
import { z } from 'zod';
import { Client } from '../models/Client.js';
import { OrderType } from '../models/OrderType.js';
import { nextSequence } from '../models/Counter.js';
import { ORDER_STATUSES, ServiceOrder } from '../models/ServiceOrder.js';
import { authenticate, requirePermission } from '../middleware/auth.js';
import { uploadPhotos } from '../middleware/upload.js';
import { validate } from '../middleware/validate.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { AppError } from '../utils/AppError.js';
import { escapeRegex } from '../utils/normalize.js';
import { money } from '../utils/money.js';
import { calculateOrderTotal } from '../utils/orderTotals.js';
import { audit } from '../services/audit.js';
import { createOrderPdf } from '../services/orderPdf.js';
import { downloadSalesNoteController } from '../controllers/salesNote.controller.js';
import {
  cancelPaymentSchema,
  objectId,
  paymentSchema,
  serviceOrderCreateSchema,
  serviceOrderUpdateSchema,
  statusSchema
} from './schemas.js';
import { deliverySignatureSchema } from './schemas.js';
import { pdfToBuffer } from '../utils/pdfBuffer.js';

export const ordersRouter = Router();
ordersRouter.use(authenticate);

const listSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
  search: z.string().trim().max(120).default(''),
  status: z.union([z.enum(ORDER_STATUSES), z.literal('')]).default(''),
  type: z.string().trim().max(100).default(''),
  start: z.string().datetime().optional(),
  end: z.string().datetime().optional()
});

function addressText(client: any) {
  if (!client.address) return '';
  return [client.address.street, client.address.neighborhood, client.address.city, client.address.state, client.address.postalCode].filter(Boolean).join(', ');
}

async function removeUploaded(files: Express.Multer.File[] = []) {
  await Promise.all(files.map((file) => fs.unlink(file.path).catch(() => undefined)));
}

async function validateImageSignatures(files: Express.Multer.File[]) {
  for (const file of files) {
    const bytes = await fs.readFile(file.path);
    const jpeg = bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
    const png = bytes.length >= 8 && bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
    if ((file.mimetype === 'image/jpeg' && !jpeg) || (file.mimetype === 'image/png' && !png)) {
      await removeUploaded(files);
      throw new AppError('Una fotografia no coincide con su formato real.', 422);
    }
  }
}

function parseMultipartPayload(req: Request) {
  try {
    return JSON.parse(String(req.body.payload || '{}'));
  } catch {
    throw new AppError('Los datos de la orden no tienen un formato valido.', 422);
  }
}

ordersRouter.get('/', requirePermission('orders:view'), validate(listSchema, 'query'), asyncHandler(async (req, res) => {
  const { page, limit, search, status, type, start, end } = req.validatedQuery as z.infer<typeof listSchema>;
  const filter: Record<string, any> = {};
  if (status) filter.status = status;
  if (type) filter.orderTypeName = new RegExp(escapeRegex(type), 'i');
  if (search) {
    const rx = new RegExp(escapeRegex(search), 'i');
    filter.$or = [{ folio: rx }, { 'clientSnapshot.name': rx }, { 'clientSnapshot.phone': rx }, { orderTypeName: rx }, { 'equipment.equipmentType': rx }, { 'equipment.brand': rx }, { 'equipment.model': rx }, { 'equipment.serialNumber': rx }];
  }
  if (start || end) {
    filter.orderDate = {};
    if (start) filter.orderDate.$gte = new Date(start);
    if (end) filter.orderDate.$lte = new Date(end);
  }
  const [data, total] = await Promise.all([
    ServiceOrder.find(filter).sort({ orderDate: -1, folioNumber: -1 }).skip((page - 1) * limit).limit(limit).select('-photos'),
    ServiceOrder.countDocuments(filter)
  ]);
  res.json({ data, pagination: { page, limit, total, pages: Math.ceil(total / limit) }, statuses: ORDER_STATUSES });
}));

ordersRouter.get('/:id', requirePermission('orders:view'), validate(z.object({ id: objectId }), 'params'), asyncHandler(async (req, res) => {
  const data = await ServiceOrder.findById(req.params.id);
  if (!data) throw new AppError('Orden de servicio no encontrada.', 404);
  res.json({ data });
}));

ordersRouter.post('/', requirePermission('orders:create'), uploadPhotos, asyncHandler(async (req, res) => {
  const files = (req.files as Express.Multer.File[]) || [];
  await validateImageSignatures(files);
  const parsed = serviceOrderCreateSchema.safeParse(parseMultipartPayload(req));
  if (!parsed.success) {
    await removeUploaded(files);
    throw new AppError('Revisa los datos de la orden.', 422, 'VALIDATION_ERROR', parsed.error.flatten());
  }
  const input = parsed.data;
  const [client, orderType] = await Promise.all([
    Client.findOne({ _id: input.clientId, active: true }),
    OrderType.findOne({ _id: input.orderTypeId, active: true })
  ]);
  if (!client || !orderType) {
    await removeUploaded(files);
    throw new AppError(!client ? 'El cliente no existe o esta desactivado.' : 'El tipo de orden no existe o esta desactivado.', 422);
  }
  try {
    const sequence = await nextSequence('serviceOrder');
    const serviceAmount = money(input.total);
    const total = calculateOrderTotal(serviceAmount, input.materials);
    const data = await ServiceOrder.create({
      folio: `OS-${String(sequence).padStart(6, '0')}`,
      folioNumber: sequence,
      orderDate: input.orderDate,
      client: client._id,
      clientSnapshot: { name: `${client.firstName} ${client.lastName}`.trim(), phone: client.phone, email: client.email, address: addressText(client) },
      orderType: orderType._id,
      orderTypeName: orderType.name,
      customerReference: input.customerReference,
      equipment: input.equipment,
      materials: input.materials,
      photos: files.map((file) => ({ filename: file.filename, originalName: file.originalname, mimeType: file.mimetype, size: file.size })),
      serviceAmount,
      total,
      paidAmount: 0,
      balance: total,
      status: 'Pendiente',
      statusHistory: [{ status: 'Pendiente', changedBy: req.user?.id, changedByName: req.user?.name, note: 'Orden registrada' }],
      notes: input.notes,
      createdBy: req.user?.id,
      createdByName: req.user?.name,
      updatedBy: req.user?.id
    });
    await audit(req, 'create', 'serviceOrder', data.id, { folio: data.folio, total: data.total });
    req.app.get('io')?.emit('orders:changed', { id: data.id, action: 'created' });
    res.status(201).json({ data, message: `Orden ${data.folio} registrada.` });
  } catch (error) {
    await removeUploaded(files);
    throw error;
  }
}));

ordersRouter.put('/:id', requirePermission('orders:edit'), validate(z.object({ id: objectId }), 'params'), validate(serviceOrderUpdateSchema), asyncHandler(async (req, res) => {
  const data = await ServiceOrder.findById(req.params.id);
  if (!data) throw new AppError('Orden de servicio no encontrada.', 404);
  if (data.status === 'Cancelado') throw new AppError('Una orden cancelada no puede editarse.', 409);
  const { revision, clientId, orderTypeId, ...changes } = req.body;
  if (revision !== undefined && data.get('revision') !== revision) throw new AppError('La orden fue modificada en otra ventana. Actualiza e intenta nuevamente.', 409);

  if (clientId && String(data.client) !== clientId) {
    const client = await Client.findOne({ _id: clientId, active: true });
    if (!client) throw new AppError('El cliente no existe o esta desactivado.', 422);
    data.client = client._id;
    data.clientSnapshot = { name: `${client.firstName} ${client.lastName}`.trim(), phone: client.phone, email: client.email, address: addressText(client) };
  }
  if (orderTypeId && String(data.orderType) !== orderTypeId) {
    const orderType = await OrderType.findOne({ _id: orderTypeId, active: true });
    if (!orderType) throw new AppError('El tipo de orden no existe o esta desactivado.', 422);
    data.orderType = orderType._id;
    data.orderTypeName = orderType.name;
  }
  const serviceAmount = changes.total !== undefined
    ? money(changes.total)
    : money(Number(data.serviceAmount ?? data.total));
  const materials = changes.materials !== undefined ? changes.materials : data.materials;
  const newTotal = calculateOrderTotal(serviceAmount, materials);
  const financialFields = changes.total !== undefined || changes.materials !== undefined ? ['serviceAmount', 'total', 'balance'] : [];
  if (newTotal < data.paidAmount) throw new AppError('El total del servicio y las refacciones no puede ser menor a lo ya abonado.', 422);
  data.serviceAmount = serviceAmount;
  data.total = newTotal;
  data.balance = money(newTotal - data.paidAmount);
  delete (changes as Record<string, unknown>).total;
  Object.assign(data, changes, { updatedBy: req.user?.id });
  await data.save();
  await audit(req, 'update', 'serviceOrder', data.id, { folio: data.folio, fields: [...new Set([...Object.keys(changes), ...financialFields])] });
  req.app.get('io')?.emit('orders:changed', { id: data.id, action: 'updated' });
  res.json({ data, message: 'Orden actualizada.' });
}));

ordersRouter.post('/:id/photos', requirePermission('orders:edit'), validate(z.object({ id: objectId }), 'params'), uploadPhotos, asyncHandler(async (req, res) => {
  const files = (req.files as Express.Multer.File[]) || [];
  await validateImageSignatures(files);
  const data = await ServiceOrder.findById(req.params.id);
  if (!data) {
    await removeUploaded(files);
    throw new AppError('Orden de servicio no encontrada.', 404);
  }
  if (data.photos.length + files.length > 5) {
    await removeUploaded(files);
    throw new AppError(`Solo puedes agregar ${5 - data.photos.length} fotografia(s) mas.`, 422);
  }
  data.photos.push(...files.map((file) => ({ filename: file.filename, originalName: file.originalname, mimeType: file.mimetype, size: file.size }) as any));
  data.updatedBy = req.user?._id as any;
  await data.save();
  await audit(req, 'addPhotos', 'serviceOrder', data.id, { count: files.length });
  res.json({ data, message: 'Evidencias agregadas.' });
}));

ordersRouter.post('/:id/payments', requirePermission('orders:pay'), validate(z.object({ id: objectId }), 'params'), validate(paymentSchema), asyncHandler(async (req, res) => {
  const amount = money(req.body.amount);
  const duplicate = await ServiceOrder.findOne({ _id: req.params.id, 'payments.idempotencyKey': req.body.idempotencyKey });
  if (duplicate) return res.json({ data: duplicate, message: 'El abono ya habia sido registrado.', idempotent: true });

  const payment = {
    idempotencyKey: req.body.idempotencyKey || randomUUID(),
    amount,
    paymentMethod: req.body.paymentMethod,
    cashAmount: req.body.cashAmount,
    transferAmount: req.body.transferAmount,
    cardAmount: req.body.cardAmount,
    reference: req.body.reference,
    notes: req.body.notes,
    status: 'Aplicado',
    paidAt: new Date(),
    createdBy: req.user?.id,
    createdByName: req.user?.name
  };
  const data = await ServiceOrder.findOneAndUpdate(
    { _id: req.params.id, status: { $ne: 'Cancelado' }, balance: { $gte: amount }, payments: { $not: { $elemMatch: { idempotencyKey: payment.idempotencyKey } } } },
    { $push: { payments: payment }, $inc: { paidAmount: amount, balance: -amount }, $set: { updatedBy: req.user?.id } },
    { new: true, runValidators: true }
  );
  if (!data) {
    const order = await ServiceOrder.findById(req.params.id);
    if (!order) throw new AppError('Orden de servicio no encontrada.', 404);
    if (order.status === 'Cancelado') throw new AppError('No se puede abonar a una orden cancelada.', 409);
    throw new AppError(`El abono supera el saldo disponible de ${money(order.balance).toFixed(2)}.`, 422);
  }
  data.paidAmount = money(data.paidAmount);
  data.balance = money(data.balance);
  await data.save();
  await audit(req, 'payment', 'serviceOrder', data.id, { folio: data.folio, amount, method: payment.paymentMethod });
  req.app.get('io')?.emit('orders:changed', { id: data.id, action: 'payment' });
  res.status(201).json({ data, message: 'Abono registrado.' });
}));

ordersRouter.post('/:id/delivery-signature', requirePermission('orders:status'), validate(z.object({ id: objectId }), 'params'), validate(deliverySignatureSchema), asyncHandler(async (req, res) => {
  const order = await ServiceOrder.findById(req.params.id);
  if (!order) throw new AppError('Orden de servicio no encontrada.', 404);
  if (order.balance > 0) throw new AppError('La orden debe estar liquidada antes de firmar la entrega.', 409);
  order.deliverySignature = { ...req.body, signedAt: new Date() } as any;
  if (!['Entregado', 'Finalizado'].includes(order.status)) {
    order.status = 'Entregado';
    order.statusHistory.push({ status: 'Entregado', changedBy: req.user?._id, changedByName: req.user?.name, note: `Entrega firmada por ${req.body.receivedBy}` } as any);
  }
  order.updatedBy = req.user?._id as any;
  await order.save();
  await audit(req, 'deliverySignature', 'serviceOrder', order.id, { folio: order.folio, receivedBy: req.body.receivedBy });
  req.app.get('io')?.emit('orders:changed', { id: order.id, action: 'delivery-signature' });
  res.json({ data: order, message: 'Firma de entrega guardada.' });
}));

ordersRouter.post('/:id/payments/:paymentId/cancel', requirePermission('orders:cancel'), validate(z.object({ id: objectId, paymentId: objectId }), 'params'), validate(cancelPaymentSchema), asyncHandler(async (req, res) => {
  const order = await ServiceOrder.findById(req.params.id);
  if (!order) throw new AppError('Orden de servicio no encontrada.', 404);
  const paymentId = String(req.params.paymentId || '');
  const payment = order.payments.id(paymentId) as any;
  if (!payment || payment.status !== 'Aplicado') throw new AppError('El abono no existe o ya fue cancelado.', 409);
  const data = await ServiceOrder.findOneAndUpdate(
    { _id: order._id, payments: { $elemMatch: { _id: payment._id, status: 'Aplicado' } } },
    { $set: { 'payments.$.status': 'Cancelado', 'payments.$.notes': `CANCELADO: ${req.body.reason}`, updatedBy: req.user?.id }, $inc: { paidAmount: -payment.amount, balance: payment.amount } },
    { new: true, runValidators: true }
  );
  if (!data) throw new AppError('El abono ya fue modificado. Actualiza la orden.', 409);
  await audit(req, 'cancelPayment', 'serviceOrder', data.id, { paymentId, amount: payment.amount, reason: req.body.reason });
  req.app.get('io')?.emit('orders:changed', { id: data.id, action: 'payment-cancelled' });
  res.json({ data, message: 'Abono cancelado.' });
}));

ordersRouter.post('/:id/status', requirePermission('orders:status'), validate(z.object({ id: objectId }), 'params'), validate(statusSchema), asyncHandler(async (req, res) => {
  const order = await ServiceOrder.findById(req.params.id);
  if (!order) throw new AppError('Orden de servicio no encontrada.', 404);
  if (order.status === req.body.status) return res.json({ data: order, message: 'La orden ya tiene ese estado.' });
  if (req.body.status === 'Cancelado' && order.paidAmount > 0) {
    throw new AppError('Cancela primero los abonos aplicados para conservar la contabilidad correcta.', 409);
  }
  order.status = req.body.status;
  order.statusHistory.push({ status: req.body.status, changedBy: req.user?._id, changedByName: req.user?.name, note: req.body.note } as any);
  order.updatedBy = req.user?._id as any;
  await order.save();
  await audit(req, 'status', 'serviceOrder', order.id, { folio: order.folio, status: order.status, note: req.body.note });
  req.app.get('io')?.emit('orders:changed', { id: order.id, action: 'status' });
  res.json({ data: order, message: 'Estado actualizado.' });
}));

ordersRouter.get('/:id/pdf', requirePermission('orders:download'), validate(z.object({ id: objectId }), 'params'), asyncHandler(async (req, res) => {
  const formatSchema = z.enum(['a4', 'thermal58', 'thermal80']).default('a4');
  const format = formatSchema.parse(req.query.format);
  const order = await ServiceOrder.findById(req.params.id);
  if (!order) throw new AppError('Orden de servicio no encontrada.', 404);
  const doc = await createOrderPdf(order as any, format);
  const buffer = await pdfToBuffer(doc);
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `inline; filename="${order.folio}-${format}.pdf"`);
  res.setHeader('Content-Length', buffer.length);
  res.send(buffer);
}));

ordersRouter.get('/:id/sales-note', requirePermission('orders:download'), validate(z.object({ id: objectId }), 'params'), asyncHandler(downloadSalesNoteController));
