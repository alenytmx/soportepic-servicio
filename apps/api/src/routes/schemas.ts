import { z } from 'zod';
import { ORDER_STATUSES } from '../models/ServiceOrder.js';
import { PERMISSIONS } from '../utils/permissions.js';

export const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'Identificador invalido');
export const password = z.string()
  .min(8, 'La contraseña debe tener al menos 8 caracteres')
  .max(100)
  .regex(/[a-z]/, 'Debe incluir una letra minuscula')
  .regex(/[A-Z]/, 'Debe incluir una letra mayuscula')
  .regex(/\d/, 'Debe incluir un numero');

export const paginationQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
  search: z.string().trim().max(120).default(''),
  active: z.enum(['true', 'false', 'all']).default('true')
});

export const setupSchema = z.object({
  name: z.string().trim().min(2).max(100),
  username: z.string().trim().min(3).max(50).regex(/^[a-zA-Z0-9._-]+$/),
  password,
  businessName: z.string().trim().min(2).max(120).optional()
});

export const loginSchema = z.object({
  username: z.string().trim().min(3).max(50),
  password: z.string().min(1).max(100)
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1).max(100),
  newPassword: password
});

export const userCreateSchema = z.object({
  name: z.string().trim().min(2).max(100),
  username: z.string().trim().min(3).max(50).regex(/^[a-zA-Z0-9._-]+$/),
  password,
  role: z.enum(['admin', 'operator']).default('operator'),
  permissions: z.array(z.enum(PERMISSIONS)).default([]),
  active: z.boolean().default(true)
});

export const userUpdateSchema = userCreateSchema.omit({ password: true }).partial().extend({
  password: password.optional(),
  revision: z.number().int().min(0).optional()
});

export const clientSchema = z.object({
  firstName: z.string().trim().min(2).max(80),
  lastName: z.string().trim().max(100).default(''),
  phone: z.string().trim().min(7).max(30),
  alternatePhone: z.string().trim().max(30).default(''),
  email: z.union([z.string().trim().email().max(150), z.literal('')]).default(''),
  address: z.object({
    street: z.string().trim().max(150).default(''),
    neighborhood: z.string().trim().max(100).default(''),
    city: z.string().trim().max(100).default(''),
    state: z.string().trim().max(100).default(''),
    postalCode: z.string().trim().max(10).default('')
  }).default({}),
  references: z.string().trim().max(500).default(''),
  notes: z.string().trim().max(1000).default(''),
  active: z.boolean().default(true)
});

export const clientUpdateSchema = clientSchema.partial().extend({ revision: z.number().int().min(0).optional() });

export const orderTypeSchema = z.object({
  name: z.string().trim().min(2).max(80),
  description: z.string().trim().max(300).default(''),
  active: z.boolean().default(true)
});

export const orderTypeUpdateSchema = orderTypeSchema.partial().extend({ revision: z.number().int().min(0).optional() });

export const equipmentSchema = z.object({
  equipmentType: z.string().trim().min(2).max(80),
  brand: z.string().trim().max(80).default(''),
  model: z.string().trim().max(100).default(''),
  serialNumber: z.string().trim().max(120).default(''),
  observations: z.string().trim().max(1500).default(''),
  accessories: z.array(z.string().trim().min(1).max(100)).max(20).default([])
});

export const materialSchema = z.object({
  description: z.string().trim().min(2).max(200),
  quantity: z.coerce.number().positive().max(10000).default(1),
  unitCost: z.coerce.number().min(0).max(10_000_000).default(0),
  supplier: z.string().trim().max(150).default('')
});

export const serviceOrderCreateSchema = z.object({
  orderDate: z.coerce.date().max(new Date(Date.now() + 86_400_000)).default(() => new Date()),
  clientId: objectId,
  orderTypeId: objectId,
  customerReference: z.string().trim().max(500).default(''),
  equipment: z.array(equipmentSchema).min(1).max(10),
  materials: z.array(materialSchema).max(50).default([]),
  total: z.coerce.number().min(0).max(100_000_000),
  notes: z.string().trim().max(1500).default('')
});

export const serviceOrderUpdateSchema = serviceOrderCreateSchema.omit({ clientId: true, orderTypeId: true }).partial().extend({
  clientId: objectId.optional(),
  orderTypeId: objectId.optional(),
  revision: z.number().int().min(0).optional()
});

export const paymentSchema = z.object({
  amount: z.coerce.number().positive().max(100_000_000),
  paymentMethod: z.enum(['Efectivo', 'Transferencia', 'Tarjeta', 'Mixto']),
  cashAmount: z.coerce.number().min(0).max(100_000_000).default(0),
  transferAmount: z.coerce.number().min(0).max(100_000_000).default(0),
  cardAmount: z.coerce.number().min(0).max(100_000_000).default(0),
  reference: z.string().trim().max(120).default(''),
  notes: z.string().trim().max(300).default(''),
  idempotencyKey: z.string().uuid()
}).superRefine((data, ctx) => {
  const expected = data.paymentMethod === 'Efectivo' ? data.cashAmount : data.paymentMethod === 'Transferencia' ? data.transferAmount : data.paymentMethod === 'Tarjeta' ? data.cardAmount : data.cashAmount + data.transferAmount + data.cardAmount;
  if (Math.abs(expected - data.amount) > 0.009) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['amount'], message: 'El desglose debe coincidir con el importe del abono' });
  if ((data.paymentMethod === 'Transferencia' || data.paymentMethod === 'Tarjeta' || data.transferAmount > 0 || data.cardAmount > 0) && data.reference.length < 3) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['reference'], message: 'Captura la referencia de la transferencia' });
  }
});

export const deliverySignatureSchema = z.object({
  dataUrl: z.string().regex(/^data:image\/png;base64,/).max(300000),
  signedByName: z.string().trim().min(2).max(120),
  receivedBy: z.string().trim().min(2).max(120)
});

export const statusSchema = z.object({
  status: z.enum(ORDER_STATUSES),
  note: z.string().trim().max(300).default('')
});

export const cancelPaymentSchema = z.object({
  reason: z.string().trim().min(5).max(300)
});

export const expenseSchema = z.object({
  expenseDate: z.coerce.date().max(new Date(Date.now() + 86_400_000)).default(() => new Date()),
  concept: z.string().trim().min(2).max(200),
  category: z.string().trim().min(2).max(100),
  amount: z.coerce.number().positive().max(100_000_000),
  paymentMethod: z.enum(['Efectivo', 'Transferencia']),
  serviceOrderId: z.union([objectId, z.literal(''), z.null()]).default(null),
  notes: z.string().trim().max(500).default('')
});

export const expenseUpdateSchema = expenseSchema.partial().extend({ revision: z.number().int().min(0).optional() });

export const cancelExpenseSchema = z.object({ reason: z.string().trim().min(5).max(300) });

export const settingsSchema = z.object({
  businessName: z.string().trim().min(2).max(120),
  brandName: z.string().trim().min(2).max(120),
  slogan: z.string().trim().max(180).default(''),
  address: z.string().trim().max(300).default(''),
  postalCode: z.string().trim().max(10).default(''),
  phone: z.string().trim().max(30).default(''),
  email: z.union([z.string().trim().email().max(150), z.literal('')]).default(''),
  social: z.object({
    facebook: z.string().trim().max(200).default(''),
    instagram: z.string().trim().max(200).default(''),
    whatsapp: z.string().trim().max(30).default(''),
    website: z.string().trim().max(200).default('')
  }).default({}),
  logoUrl: z.string().trim().max(500).default(''),
  printFormat: z.enum(['a4', 'thermal58', 'thermal80']),
  ticketHeader: z.string().trim().max(300).default(''),
  ticketFooter: z.string().trim().max(500).default(''),
  timezone: z.string().trim().max(80).default('America/Mazatlan')
  ,themeMode: z.enum(['light', 'dark', 'system']).default('system'),
  primaryColor: z.string().regex(/^#[0-9a-f]{6}$/i).default('#2563eb'),
  fontFamily: z.enum(['system', 'inter', 'arial', 'georgia']).default('system'),
  fontScale: z.coerce.number().min(0.85).max(1.25).default(1)
  ,showThemeToggle: z.boolean().default(true)
  ,showUserName: z.boolean().default(true)
  ,showDateTime: z.boolean().default(true)
});

export const reportQuerySchema = z.object({
  start: z.coerce.date(),
  end: z.coerce.date(),
  status: z.enum(ORDER_STATUSES).optional()
}).refine((data) => data.start <= data.end, { message: 'La fecha inicial debe ser anterior a la final' });
