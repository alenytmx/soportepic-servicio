import fs from 'node:fs';
import path from 'node:path';
import PDFDocument from 'pdfkit';
import type { HydratedDocument } from 'mongoose';
import { getBusinessSettings } from '../models/BusinessSettings.js';
import { uploadDirectory } from '../middleware/upload.js';

type AnyOrder = HydratedDocument<Record<string, any>>;

function currency(value: number) {
  return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(value || 0);
}

function drawLine(doc: PDFKit.PDFDocument) {
  const y = doc.y + 3;
  doc.moveTo(doc.page.margins.left, y).lineTo(doc.page.width - doc.page.margins.right, y).strokeColor('#cbd5e1').stroke();
  doc.moveDown(0.6);
}

function ensureSpace(doc: PDFKit.PDFDocument, needed = 90) {
  if (doc.y + needed > doc.page.height - doc.page.margins.bottom) doc.addPage();
}

export async function createOrderPdf(order: AnyOrder, format: 'a4' | 'thermal58' | 'thermal80') {
  const settings = await getBusinessSettings();
  const thermal = format !== 'a4';
  const width = format === 'thermal58' ? 164.4 : format === 'thermal80' ? 226.8 : 595.28;
  const doc = new PDFDocument({
    size: thermal ? [width, 1200] : 'A4',
    margins: thermal ? { top: 12, left: 10, right: 10, bottom: 12 } : { top: 40, left: 45, right: 45, bottom: 45 },
    autoFirstPage: true,
    info: { Title: `Orden ${order.folio}`, Author: settings.businessName }
  });

  const fontSize = thermal ? 7 : 9;
  const logoPath = settings.logoFilename ? path.join(uploadDirectory, path.basename(settings.logoFilename)) : '';
  if (logoPath && fs.existsSync(logoPath)) {
    try { doc.image(logoPath, { fit: [thermal ? 70 : 95, thermal ? 42 : 62], align: 'center' }); doc.moveDown(0.4); } catch { /* usa encabezado de texto */ }
  }
  doc.font('Helvetica-Bold').fontSize(thermal ? 11 : 18).fillColor('#0f172a').text(settings.businessName, { align: 'center' });
  if (settings.slogan) doc.font('Helvetica').fontSize(fontSize).text(settings.slogan, { align: 'center' });
  if (settings.address) doc.text(settings.address, { align: 'center' });
  doc.text([settings.phone, settings.email].filter(Boolean).join(' · '), { align: 'center' });
  if (settings.ticketHeader) doc.text(settings.ticketHeader, { align: 'center' });
  drawLine(doc);

  doc.font('Helvetica-Bold').fontSize(thermal ? 10 : 14).text(`ORDEN ${order.folio}`, { align: 'center' });
  doc.font('Helvetica').fontSize(fontSize);
  doc.text(`Fecha: ${new Intl.DateTimeFormat('es-MX', { dateStyle: 'medium', timeStyle: 'short', timeZone: settings.timezone }).format(new Date(order.orderDate))}`);
  doc.text(`Registró: ${order.createdByName}`);
  doc.text(`Tipo: ${order.orderTypeName}`);
  doc.text(`Estado: ${order.status}`);
  drawLine(doc);

  doc.font('Helvetica-Bold').text('CLIENTE');
  doc.font('Helvetica').text(order.clientSnapshot.name);
  doc.text(`Teléfono: ${order.clientSnapshot.phone}`);
  if (order.clientSnapshot.email) doc.text(`Correo: ${order.clientSnapshot.email}`);
  if (order.clientSnapshot.address) doc.text(`Dirección: ${order.clientSnapshot.address}`);
  if (order.customerReference) doc.text(`Referencia: ${order.customerReference}`);

  order.equipment.forEach((item: any, index: number) => {
    ensureSpace(doc, thermal ? 80 : 110);
    drawLine(doc);
    doc.font('Helvetica-Bold').text(`EQUIPO ${index + 1}`);
    doc.font('Helvetica');
    doc.text(`${item.equipmentType} · ${item.brand || 'Sin marca'} ${item.model || ''}`.trim());
    if (item.serialNumber) doc.text(`Serie: ${item.serialNumber}`);
    if (item.accessories?.length) doc.text(`Accesorios: ${item.accessories.join(', ')}`);
    if (item.observations) doc.text(`Observaciones: ${item.observations}`);
  });

  if (order.materials?.length) {
    ensureSpace(doc);
    drawLine(doc);
    doc.font('Helvetica-Bold').text('REFACCIONES / MATERIALES');
    order.materials.forEach((item: any) => {
      doc.font('Helvetica').text(`${item.quantity} × ${item.description} — ${currency(item.quantity * item.unitCost)}`);
    });
  }

  ensureSpace(doc);
  drawLine(doc);
  doc.font('Helvetica-Bold').text('PAGOS');
  const appliedPayments = order.payments.filter((item: any) => item.status === 'Aplicado');
  if (!appliedPayments.length) doc.font('Helvetica').text('Sin abonos registrados.');
  appliedPayments.forEach((item: any) => {
    doc.font('Helvetica').text(`${new Intl.DateTimeFormat('es-MX', { dateStyle: 'short' }).format(new Date(item.paidAt))} · ${item.paymentMethod} · ${currency(item.amount)}`);
    if (item.paymentMethod === 'Mixto') doc.text(`Efectivo ${currency(item.cashAmount)} · Transferencia ${currency(item.transferAmount)} · Tarjeta ${currency(item.cardAmount)}`);
    if (item.reference) doc.text(`Referencia: ${item.reference}`);
  });
  doc.moveDown(0.4);
  doc.font('Helvetica-Bold');
  doc.text(`Total: ${currency(order.total)}`, { align: 'right' });
  doc.text(`Abonado: ${currency(order.paidAmount)}`, { align: 'right' });
  doc.text(`Saldo: ${currency(order.balance)}`, { align: 'right' });

  if (!thermal && order.photos?.length) {
    ensureSpace(doc, 220);
    doc.addPage();
    doc.font('Helvetica-Bold').fontSize(14).text(`Evidencias · ${order.folio}`);
    doc.moveDown();
    for (const photo of order.photos.slice(0, 5)) {
      const safeName = path.basename(photo.filename);
      const imagePath = path.join(uploadDirectory, safeName);
      if (!fs.existsSync(imagePath)) continue;
      ensureSpace(doc, 210);
      try {
        doc.image(imagePath, { fit: [230, 185], align: 'center' });
        doc.font('Helvetica').fontSize(8).text(photo.originalName, { align: 'center' });
        doc.moveDown();
      } catch {
        doc.font('Helvetica').fontSize(8).text(`No fue posible insertar: ${photo.originalName}`);
      }
    }
  }

  ensureSpace(doc, thermal ? 100 : 130);
  drawLine(doc);
  if (order.notes) doc.font('Helvetica').fontSize(fontSize).text(`Notas: ${order.notes}`);
  doc.moveDown(thermal ? 2 : 4);
  if (order.deliverySignature?.dataUrl) {
    try { doc.image(Buffer.from(order.deliverySignature.dataUrl.split(',')[1], 'base64'), { fit: [thermal ? 150 : 220, thermal ? 55 : 85], align: 'center' }); } catch { /* conserva el documento aunque una firma heredada esté dañada */ }
    doc.text(`${order.deliverySignature.receivedBy || order.clientSnapshot.name} · Entregado ${new Intl.DateTimeFormat('es-MX', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(order.deliverySignature.signedAt))}`, { align: 'center' });
  } else {
    doc.text('____________________________', { align: 'center' });
    doc.text('Firma del técnico que entrega', { align: 'center' });
  }
  doc.moveDown();
  if (settings.ticketFooter) doc.text(settings.ticketFooter, { align: 'center' });
  doc.text(`${settings.rightsText} · Soporte ${settings.supportPhone} · v${settings.systemVersion}`, { align: 'center' });

  return doc;
}
