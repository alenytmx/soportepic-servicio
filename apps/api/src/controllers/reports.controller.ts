import type { Request, Response } from 'express';
import { z } from 'zod';
import { getBusinessSettings } from '../models/BusinessSettings.js';
import { createReportPdf } from '../services/reportPdf.js';
import { getReportSummary } from '../services/reportSummary.js';
import { reportQuerySchema } from '../routes/schemas.js';
import { pdfToBuffer } from '../utils/pdfBuffer.js';

type ReportQuery = z.infer<typeof reportQuerySchema>;

function progress(req: Request, stage: string, percent: number, message: string) {
  if (!req.user) return;
  req.app.get('io')?.to(`user:${req.user.id}`).emit('reports:progress', { stage, percent, message });
}

export async function getReportSummaryController(req: Request, res: Response) {
  const { start, end, status } = req.validatedQuery as ReportQuery;
  const data = await getReportSummary(start, end, status);
  res.json({ data });
}

export async function downloadReportPdfController(req: Request, res: Response) {
  const { start, end, status } = req.validatedQuery as ReportQuery;
  progress(req, 'preparing', 10, 'Preparando información del periodo…');
  const [summary, settings] = await Promise.all([getReportSummary(start, end, status), getBusinessSettings()]);
  progress(req, 'rendering', 65, 'Diseñando gráfica y resumen financiero…');

  const doc = createReportPdf(summary, {
    logoFilename: settings.logoFilename,
    businessName: settings.businessName,
    slogan: settings.slogan,
    address: settings.address,
    phone: settings.phone,
    email: settings.email,
    timezone: settings.timezone,
    rightsText: settings.rightsText,
    supportPhone: settings.supportPhone,
    systemVersion: settings.systemVersion
  });
  const filename = `reporte-${start.toISOString().slice(0, 10)}-${end.toISOString().slice(0, 10)}.pdf`;
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.setHeader('Cache-Control', 'private, no-store');
  const buffer = await pdfToBuffer(doc);
  res.setHeader('Content-Length', buffer.length);
  progress(req, 'downloading', 90, 'Enviando el archivo PDF…');
  res.send(buffer);
  progress(req, 'completed', 100, 'Reporte PDF abierto.');
}
