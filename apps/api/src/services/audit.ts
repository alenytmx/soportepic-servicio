import type { Request } from 'express';
import { AuditLog } from '../models/AuditLog.js';

export async function audit(req: Request, action: string, entity: string, entityId?: string, details?: unknown) {
  if (!req.user) return;
  await AuditLog.create({
    userId: req.user._id,
    username: req.user.username,
    action,
    entity,
    entityId,
    details,
    ip: req.ip,
    requestId: req.requestId
  });
}
