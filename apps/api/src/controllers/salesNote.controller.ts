import type { Request, Response } from 'express';
import { getBusinessSettings } from '../models/BusinessSettings.js';
import { ServiceOrder } from '../models/ServiceOrder.js';
import { AppError } from '../utils/AppError.js';
import { createSalesNotePdf } from '../services/salesNotePdf.js';
import { pdfToBuffer } from '../utils/pdfBuffer.js';

export async function downloadSalesNoteController(req: Request, res: Response) {
  const [order, settings] = await Promise.all([ServiceOrder.findById(req.params.id), getBusinessSettings()]);
  if (!order) throw new AppError('Orden de servicio no encontrada.', 404);
  const doc = createSalesNotePdf(order.toObject(), {
    logoFilename: settings.logoFilename,
    businessName: settings.businessName,
    slogan: settings.slogan,
    address: settings.address,
    postalCode: settings.postalCode,
    phone: settings.phone,
    email: settings.email,
    timezone: settings.timezone,
    rightsText: settings.rightsText,
    supportPhone: settings.supportPhone,
    systemVersion: settings.systemVersion
  });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="nota-venta-${order.folio}.pdf"`);
  res.setHeader('Cache-Control', 'private, no-store');
  const buffer = await pdfToBuffer(doc);
  res.setHeader('Content-Length', buffer.length);
  res.send(buffer);
}
