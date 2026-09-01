import { Router } from 'express';
import { z } from 'zod';
import { authenticate, requirePermission } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { AuditLog } from '../models/AuditLog.js';
import { escapeRegex } from '../utils/normalize.js';

export const auditRouter = Router();
auditRouter.use(authenticate);

const querySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().max(100).default('')
});

auditRouter.get('/', requirePermission('audit:view'), validate(querySchema, 'query'), asyncHandler(async (req, res) => {
  const { page, limit, search } = req.validatedQuery as z.infer<typeof querySchema>;
  const filter = search ? { $or: ['username', 'action', 'entity', 'entityId'].map((field) => ({ [field]: new RegExp(escapeRegex(search), 'i') })) } : {};
  const [data, total] = await Promise.all([
    AuditLog.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit),
    AuditLog.countDocuments(filter)
  ]);
  res.json({ data, pagination: { page, limit, total, pages: Math.ceil(total / limit) } });
}));
