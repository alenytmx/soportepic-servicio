import PDFDocument from 'pdfkit';
import fs from 'node:fs';
import path from 'node:path';
import { uploadDirectory } from '../middleware/upload.js';
import type { ReportSummary } from './reportSummary.js';

export interface ReportPdfSettings {
  logoFilename?: string;
  businessName: string;
  slogan?: string;
  address?: string;
  phone?: string;
  email?: string;
  timezone: string;
  rightsText: string;
  supportPhone: string;
  systemVersion: string;
}

const colors = {
  navy: '#0f172a',
  blue: '#2563eb',
  blueSoft: '#dbeafe',
  slate: '#64748b',
  border: '#e2e8f0',
  soft: '#f8fafc',
  green: '#15803d',
  amber: '#b45309',
  white: '#ffffff'
};

function currency(value: number) {
  return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(value || 0);
}

function date(value: Date, timezone: string) {
  try {
    return new Intl.DateTimeFormat('es-MX', { dateStyle: 'medium', timeZone: timezone }).format(value);
  } catch {
    return new Intl.DateTimeFormat('es-MX', { dateStyle: 'medium' }).format(value);
  }
}

function card(doc: PDFKit.PDFDocument, x: number, y: number, width: number, label: string, value: string, accent: string) {
  doc.roundedRect(x, y, width, 66, 8).fillAndStroke(colors.soft, colors.border);
  doc.rect(x, y, 5, 66).fill(accent);
  doc.font('Helvetica').fontSize(8).fillColor(colors.slate).text(label.toUpperCase(), x + 15, y + 13, { width: width - 25 });
  doc.font('Helvetica-Bold').fontSize(15).fillColor(colors.navy).text(value, x + 15, y + 32, { width: width - 25 });
}

function sectionTitle(doc: PDFKit.PDFDocument, title: string, x: number, y: number, width: number) {
  doc.font('Helvetica-Bold').fontSize(11).fillColor(colors.navy).text(title, x, y, { width });
  doc.moveTo(x, y + 18).lineTo(x + width, y + 18).strokeColor(colors.border).lineWidth(1).stroke();
}

function summaryTable(
  doc: PDFKit.PDFDocument,
  x: number,
  y: number,
  width: number,
  title: string,
  rows: { label: string; value: string }[],
  empty: string
) {
  sectionTitle(doc, title, x, y, width);
  const visible = rows.slice(0, 5);
  if (!visible.length) {
    doc.font('Helvetica').fontSize(8).fillColor(colors.slate).text(empty, x, y + 30, { width });
    return;
  }
  visible.forEach((row, index) => {
    const rowY = y + 28 + index * 18;
    if (index % 2 === 0) doc.rect(x, rowY - 3, width, 18).fill(colors.soft);
    doc.font('Helvetica').fontSize(8).fillColor(colors.navy).text(row.label, x + 7, rowY, { width: width * 0.58 - 7, ellipsis: true });
    doc.font('Helvetica-Bold').text(row.value, x + width * 0.58, rowY, { width: width * 0.42 - 7, align: 'right' });
  });
  if (rows.length > visible.length) {
    doc.font('Helvetica-Oblique').fontSize(7).fillColor(colors.slate).text(`+ ${rows.length - visible.length} categoría(s) adicional(es) en el CSV`, x, y + 121, { width, align: 'right' });
  }
}

export function createReportPdf(summary: ReportSummary, settings: ReportPdfSettings) {
  const doc = new PDFDocument({
    size: 'A4',
    layout: 'landscape',
    margins: { top: 30, right: 36, bottom: 34, left: 36 },
    info: { Title: `Reporte ${date(summary.period.start, settings.timezone)} - ${date(summary.period.end, settings.timezone)}`, Author: settings.businessName }
  });
  const contentWidth = doc.page.width - 72;

  doc.rect(0, 0, doc.page.width, 86).fill(colors.navy);
  const logoPath = settings.logoFilename ? path.join(uploadDirectory, path.basename(settings.logoFilename)) : '';
  if (logoPath && fs.existsSync(logoPath)) { try { doc.image(logoPath, 36, 14, { fit: [62, 58] }); } catch { /* conserva encabezado */ } }
  const titleX = logoPath && fs.existsSync(logoPath) ? 112 : 36;
  doc.font('Helvetica-Bold').fontSize(20).fillColor(colors.white).text(settings.businessName || 'Soportepic Servicio', titleX, 25, { width: 400 });
  const businessLine = [settings.slogan, settings.phone, settings.email].filter(Boolean).join(' · ');
  if (businessLine) doc.font('Helvetica').fontSize(8).fillColor('#cbd5e1').text(businessLine, titleX, 53, { width: 470 });
  doc.font('Helvetica-Bold').fontSize(14).fillColor(colors.white).text('REPORTE OPERATIVO', 520, 26, { width: 285, align: 'right' });
  doc.font('Helvetica').fontSize(8).fillColor('#cbd5e1').text(`${date(summary.period.start, settings.timezone)} al ${date(summary.period.end, settings.timezone)}`, 520, 50, { width: 285, align: 'right' });

  const cardGap = 10;
  const cardWidth = (contentWidth - cardGap * 3) / 4;
  card(doc, 36, 105, cardWidth, 'Cobrado', currency(summary.totals.collected), colors.green);
  card(doc, 36 + (cardWidth + cardGap), 105, cardWidth, 'Facturado', currency(summary.totals.billed), colors.blue);
  card(doc, 36 + (cardWidth + cardGap) * 2, 105, cardWidth, 'Gastos', currency(summary.totals.expenses), colors.amber);
  card(doc, 36 + (cardWidth + cardGap) * 3, 105, cardWidth, 'Utilidad estimada', currency(summary.totals.estimatedProfit), summary.totals.estimatedProfit >= 0 ? colors.green : '#dc2626');

  sectionTitle(doc, 'Órdenes por estado', 36, 195, contentWidth);
  const chartRows = summary.ordersByStatus;
  const maxCount = Math.max(1, ...chartRows.map((item) => item.count));
  const labelWidth = 125;
  const valueWidth = 42;
  const barWidth = contentWidth - labelWidth - valueWidth - 12;
  if (!chartRows.length) {
    doc.font('Helvetica').fontSize(9).fillColor(colors.slate).text('No hay órdenes en este periodo.', 36, 229);
  } else {
    chartRows.forEach((item, index) => {
      const y = 226 + index * 20;
      doc.font('Helvetica').fontSize(8).fillColor(colors.navy).text(item._id, 36, y + 2, { width: labelWidth - 8, ellipsis: true });
      doc.roundedRect(36 + labelWidth, y, barWidth, 12, 3).fill(colors.blueSoft);
      doc.roundedRect(36 + labelWidth, y, Math.max(5, barWidth * item.count / maxCount), 12, 3).fill(index === 0 ? colors.blue : '#60a5fa');
      doc.font('Helvetica-Bold').fontSize(8).fillColor(colors.navy).text(String(item.count), 36 + labelWidth + barWidth + 8, y + 2, { width: valueWidth, align: 'right' });
    });
  }

  const tableY = 405;
  const tableGap = 24;
  const tableWidth = (contentWidth - tableGap) / 2;
  summaryTable(doc, 36, tableY, tableWidth, 'Abonos por forma de pago', summary.paymentsByMethod.map((item) => ({ label: `${item._id} · ${item.count} movimiento(s)`, value: currency(item.total) })), 'Sin abonos aplicados.');
  summaryTable(doc, 36 + tableWidth + tableGap, tableY, tableWidth, 'Gastos por categoría', summary.expensesByCategory.map((item) => ({ label: item.category, value: currency(item.total) })), 'Sin gastos activos.');

  const footerY = doc.page.height - doc.page.margins.bottom - 10;
  doc.moveTo(36, footerY - 7).lineTo(doc.page.width - 36, footerY - 7).strokeColor(colors.border).stroke();
  doc.font('Helvetica').fontSize(7).fillColor(colors.slate).text(`${settings.rightsText} · Soporte ${settings.supportPhone} · v${settings.systemVersion}`, 36, footerY, { width: contentWidth * 0.7 });
  doc.text(`Generado ${new Intl.DateTimeFormat('es-MX', { dateStyle: 'medium', timeStyle: 'short', timeZone: settings.timezone }).format(new Date())}`, 36 + contentWidth * 0.7, footerY, { width: contentWidth * 0.3, align: 'right' });

  return doc;
}
