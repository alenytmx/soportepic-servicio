import fs from 'node:fs';
import path from 'node:path';
import PDFDocument from 'pdfkit';
import { calculateMaterialsTotal } from '../utils/orderTotals.js';

type AnyOrder = Record<string, any>;

export interface SalesNoteSettings {
  logoFilename?: string;
  businessName: string;
  slogan?: string;
  address?: string;
  postalCode?: string;
  phone?: string;
  email?: string;
  timezone: string;
  rightsText: string;
  supportPhone: string;
  systemVersion: string;
}

const palette = {
  navy: '#0f172a',
  blue: '#2563eb',
  blueSoft: '#eff6ff',
  slate: '#64748b',
  border: '#cbd5e1',
  soft: '#f8fafc',
  green: '#15803d',
  white: '#ffffff'
};

function currency(value: number) {
  return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(Number(value || 0));
}

function formatDate(value: Date | string, timezone: string) {
  try {
    return new Intl.DateTimeFormat('es-MX', { dateStyle: 'long', timeZone: timezone }).format(new Date(value));
  } catch {
    return new Intl.DateTimeFormat('es-MX', { dateStyle: 'long' }).format(new Date(value));
  }
}

function findBundledLogo(filename?: string) {
  if (filename) {
    const uploaded = path.join(path.resolve(process.cwd(), 'uploads'), path.basename(filename));
    if (fs.existsSync(uploaded)) return uploaded;
  }
  const roots = [path.resolve(process.cwd(), 'apps/api/assets'), path.resolve(process.cwd(), 'assets')];
  for (const root of roots) {
    for (const filename of ['business-logo.png', 'business-logo.jpg', 'business-logo.jpeg']) {
      const candidate = path.join(root, filename);
      if (fs.existsSync(candidate)) return candidate;
    }
  }
  return null;
}

function drawLogo(doc: PDFKit.PDFDocument, settings: SalesNoteSettings) {
  const logo = findBundledLogo(settings.logoFilename);
  if (logo) {
    try {
      doc.image(logo, 40, 32, { fit: [82, 62], align: 'center', valign: 'center' });
      return;
    } catch {
      // Si el archivo no es una imagen válida, se usa el distintivo de respaldo.
    }
  }
  const initials = settings.businessName.split(/\s+/).filter(Boolean).slice(0, 2).map((word) => word[0]).join('').toUpperCase() || 'SP';
  doc.roundedRect(40, 32, 72, 62, 9).fill(palette.blue);
  doc.font('Helvetica-Bold').fontSize(22).fillColor(palette.white).text(initials, 40, 52, { width: 72, align: 'center' });
}

function drawFooter(doc: PDFKit.PDFDocument, settings: SalesNoteSettings) {
  const width = doc.page.width - 80;
  doc.moveTo(40, 767).lineTo(doc.page.width - 40, 767).strokeColor(palette.border).lineWidth(1).stroke();
  doc.font('Helvetica-Bold').fontSize(11).fillColor(palette.navy).text('UN PLACER HACER NEGOCIOS', 40, 777, { width, align: 'center' });
  doc.font('Helvetica').fontSize(7).fillColor(palette.slate).text(`${settings.rightsText} - Soporte ${settings.supportPhone} - v${settings.systemVersion}`, 40, 792, { width, align: 'center' });
}

function drawTableHeader(doc: PDFKit.PDFDocument, y: number) {
  doc.rect(40, y, 515, 25).fill(palette.navy);
  doc.font('Helvetica-Bold').fontSize(8).fillColor(palette.white);
  doc.text('CANT.', 47, y + 8, { width: 38, align: 'center' });
  doc.text('DESCRIPCIÓN', 92, y + 8, { width: 205 });
  doc.text('IMPUESTO', 302, y + 8, { width: 68, align: 'right' });
  doc.text('PRECIO', 375, y + 8, { width: 80, align: 'right' });
  doc.text('IMPORTE', 460, y + 8, { width: 88, align: 'right' });
  return y + 25;
}

function drawContinuationHeader(doc: PDFKit.PDFDocument, order: AnyOrder) {
  doc.font('Helvetica-Bold').fontSize(13).fillColor(palette.navy).text(`NOTA DE VENTA ${order.folio} - CONTINUACIÓN`, 40, 38, { width: 515 });
  doc.moveTo(40, 60).lineTo(555, 60).strokeColor(palette.border).stroke();
}

export function createSalesNotePdf(order: AnyOrder, settings: SalesNoteSettings) {
  const doc = new PDFDocument({
    size: 'A4',
    margins: { top: 30, right: 40, bottom: 36, left: 40 },
    info: { Title: `Nota de venta ${order.folio}`, Author: settings.businessName }
  });
  const serviceAmount = Number(order.serviceAmount ?? order.total - calculateMaterialsTotal(order.materials || []));
  const equipment = (order.equipment || []).map((item: AnyOrder) => [item.equipmentType, item.brand, item.model].filter(Boolean).join(' ')).join(', ');
  const items = [
    { quantity: 1, description: `${order.orderTypeName || 'Servicio técnico'}${equipment ? ` - ${equipment}` : ''}`, tax: 0, price: serviceAmount, amount: serviceAmount },
    ...(order.materials || []).map((item: AnyOrder) => ({ quantity: item.quantity, description: item.description, tax: 0, price: item.unitCost, amount: item.quantity * item.unitCost }))
  ];

  drawLogo(doc, settings);
  doc.font('Helvetica-Bold').fontSize(17).fillColor(palette.navy).text(settings.businessName, 132, 34, { width: 260 });
  if (settings.slogan) doc.font('Helvetica').fontSize(8).fillColor(palette.slate).text(settings.slogan, 132, 57, { width: 260 });
  const companyAddress = [settings.address, settings.postalCode ? `C.P. ${settings.postalCode}` : ''].filter(Boolean).join(' - ');
  if (companyAddress) doc.text(companyAddress, 132, 71, { width: 280 });
  doc.text([settings.phone, settings.email].filter(Boolean).join(' - '), 132, 84, { width: 280 });
  doc.font('Helvetica-Bold').fontSize(16).fillColor(palette.blue).text('NOTA DE VENTA', 397, 36, { width: 158, align: 'right' });
  doc.font('Helvetica-Bold').fontSize(10).fillColor(palette.navy).text(order.folio.replace(/^OS-/, 'NV-'), 397, 62, { width: 158, align: 'right' });
  doc.font('Helvetica').fontSize(8).fillColor(palette.slate).text(`Fecha: ${formatDate(order.orderDate, settings.timezone)}`, 397, 79, { width: 158, align: 'right' });
  doc.moveTo(40, 111).lineTo(555, 111).strokeColor(palette.border).stroke();

  doc.roundedRect(40, 127, 515, 83, 7).fillAndStroke(palette.soft, palette.border);
  doc.font('Helvetica-Bold').fontSize(8).fillColor(palette.blue).text('DATOS DEL CLIENTE', 54, 140);
  doc.font('Helvetica-Bold').fontSize(10).fillColor(palette.navy).text(order.clientSnapshot.name, 54, 157, { width: 250, ellipsis: true });
  doc.font('Helvetica').fontSize(8).fillColor(palette.slate).text(`Dirección: ${order.clientSnapshot.address || 'No registrada'}`, 54, 176, { width: 300, ellipsis: true });
  doc.text(`Teléfono: ${order.clientSnapshot.phone || 'No registrado'}`, 370, 143, { width: 170 });
  doc.text(`Correo: ${order.clientSnapshot.email || 'No registrado'}`, 370, 161, { width: 170, ellipsis: true });
  if (order.customerReference) doc.text(`Referencia: ${order.customerReference}`, 370, 179, { width: 170, ellipsis: true });

  let y = drawTableHeader(doc, 229);
  items.forEach((item, index) => {
    if (y + 31 > 700) {
      drawFooter(doc, settings);
      doc.addPage();
      drawContinuationHeader(doc, order);
      y = drawTableHeader(doc, 76);
    }
    if (index % 2 === 0) doc.rect(40, y, 515, 30).fill(palette.soft);
    doc.font('Helvetica').fontSize(8).fillColor(palette.navy);
    doc.text(String(item.quantity), 47, y + 9, { width: 38, align: 'center' });
    doc.text(item.description, 92, y + 8, { width: 205, height: 15, ellipsis: true });
    doc.text(currency(item.tax), 302, y + 9, { width: 68, align: 'right' });
    doc.text(currency(item.price), 375, y + 9, { width: 80, align: 'right' });
    doc.font('Helvetica-Bold').text(currency(item.amount), 460, y + 9, { width: 88, align: 'right' });
    doc.moveTo(40, y + 30).lineTo(555, y + 30).strokeColor('#e2e8f0').stroke();
    y += 30;
  });

  if (y + 155 > 750) {
    drawFooter(doc, settings);
    doc.addPage();
    drawContinuationHeader(doc, order);
    y = 82;
  }
  const summaryX = 350;
  y += 18;
  doc.roundedRect(summaryX, y, 205, 112, 7).fillAndStroke(palette.blueSoft, '#bfdbfe');
  const summaryRows: Array<[string, string]> = [
    ['Subtotal', currency(order.total)],
    ['Impuesto de venta', currency(0)],
    ['TOTAL', currency(order.total)],
    ['Abonado', currency(order.paidAmount)],
    ['Saldo', currency(order.balance)]
  ];
  summaryRows.forEach(([label, value], index) => {
    const rowY = y + 12 + index * 19;
    doc.font(index === 2 || index === 4 ? 'Helvetica-Bold' : 'Helvetica').fontSize(index === 2 ? 10 : 8).fillColor(index === 4 ? palette.green : palette.navy);
    doc.text(label, summaryX + 12, rowY, { width: 92 });
    doc.text(value, summaryX + 105, rowY, { width: 88, align: 'right' });
  });
  doc.font('Helvetica').fontSize(7).fillColor(palette.slate).text('Impuestos mostrados en $0.00 mientras la orden no tenga una tasa fiscal configurada.', 40, y + 12, { width: 285 });
  if (order.notes) doc.text(`Notas: ${order.notes}`, 40, y + 35, { width: 285, height: 55, ellipsis: true });
  drawFooter(doc, settings);

  return doc;
}
