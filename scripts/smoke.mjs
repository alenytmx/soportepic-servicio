process.env.NODE_ENV = 'test';
import { writeFile } from 'node:fs/promises';
const { app } = await import('../apps/api/dist/app.js');
const express = (await import('express')).default;
const { validate } = await import('../apps/api/dist/middleware/validate.js');
const { paginationQuery } = await import('../apps/api/dist/routes/schemas.js');

const server = app.listen(0, '127.0.0.1');
await new Promise((resolve) => server.once('listening', resolve));
const address = server.address();
if (!address || typeof address === 'string') throw new Error('No se obtuvo el puerto de prueba.');

try {
  const response = await fetch(`http://127.0.0.1:${address.port}/api/health`);
  const payload = await response.json();
  if (!response.ok || payload.ok !== true || payload.version !== '1.3.0' || payload.database?.connected !== false) throw new Error('La verificacion de salud fallo.');
  console.log('Smoke test correcto: API y compilacion listas.');
} finally {
  await new Promise((resolve) => server.close(resolve));
}

const queryApp = express();
queryApp.get('/query-test', validate(paginationQuery, 'query'), (req, res) => res.json(req.validatedQuery));
const queryServer = queryApp.listen(0, '127.0.0.1');
await new Promise((resolve) => queryServer.once('listening', resolve));
const queryAddress = queryServer.address();
if (!queryAddress || typeof queryAddress === 'string') throw new Error('No se obtuvo el puerto de prueba de consultas.');

try {
  const response = await fetch(`http://127.0.0.1:${queryAddress.port}/query-test?page=2&limit=6`);
  const payload = await response.json();
  if (!response.ok || payload.page !== 2 || payload.limit !== 6 || payload.active !== 'true') {
    throw new Error('La validacion de consultas de Express 5 fallo.');
  }
  console.log('Regresion correcta: query parameters compatibles con Express 5.');
} finally {
  await new Promise((resolve) => queryServer.close(resolve));
}

const { createReportPdf } = await import('../apps/api/dist/services/reportPdf.js');
const samplePdf = createReportPdf({
  period: { start: new Date('2026-08-01T07:00:00.000Z'), end: new Date('2026-09-01T06:59:59.999Z') },
  totals: { orders: 12, billed: 18450, collected: 14200, outstanding: 4250, expenses: 3100, unrecordedMaterialCosts: 850, netCash: 11100, estimatedProfit: 10250 },
  paymentsByMethod: [{ _id: 'Efectivo', total: 9200, count: 8 }, { _id: 'Transferencia', total: 5000, count: 3 }],
  ordersByStatus: [
    { _id: 'Pendiente', count: 4, total: 5400, balance: 2100 },
    { _id: 'En reparacion', count: 3, total: 6200, balance: 950 },
    { _id: 'Finalizado', count: 3, total: 4550, balance: 0 },
    { _id: 'Entregado', count: 2, total: 2300, balance: 0 }
  ],
  expensesByCategory: [{ category: 'Refacciones', total: 2100 }, { category: 'Herramientas', total: 650 }, { category: 'Servicios', total: 350 }]
}, {
  businessName: 'Soportepic Servicio',
  slogan: 'Reparacion de celulares y computadoras',
  phone: '311-135-45-85',
  email: 'contacto@ejemplo.com',
  timezone: 'America/Mazatlan',
  rightsText: 'Derechos reservados Soportepic',
  supportPhone: '311-135-45-85',
  systemVersion: '1.2.1'
});
const pdfBuffer = await new Promise((resolve, reject) => {
  const chunks = [];
  samplePdf.on('data', (chunk) => chunks.push(chunk));
  samplePdf.on('end', () => resolve(Buffer.concat(chunks)));
  samplePdf.on('error', reject);
  samplePdf.end();
});
if (!pdfBuffer.subarray(0, 4).equals(Buffer.from('%PDF')) || pdfBuffer.length < 2_000) throw new Error(`La generacion del reporte PDF fallo (${pdfBuffer.length} bytes).`);
if (process.env.REPORT_SAMPLE_PATH) await writeFile(process.env.REPORT_SAMPLE_PATH, pdfBuffer);
console.log('PDF correcto: reporte con resumen y grafica generado.');

const { calculateOrderTotal } = await import('../apps/api/dist/utils/orderTotals.js');
const correctedOrderTotal = calculateOrderTotal(2500, [{ quantity: 1, unitCost: 250 }]);
if (correctedOrderTotal !== 2750) throw new Error(`El total de servicio y refacciones es incorrecto: ${correctedOrderTotal}.`);
console.log('Calculo correcto: servicio $2,500.00 + refaccion $250.00 = total y saldo $2,750.00.');

const { createSalesNotePdf } = await import('../apps/api/dist/services/salesNotePdf.js');
const sampleSalesNote = createSalesNotePdf({
  folio: 'OS-000002',
  orderDate: new Date('2026-08-21T18:00:00.000Z'),
  orderTypeName: 'Reparacion',
  clientSnapshot: { name: 'Javier Ejemplo', phone: '311-000-0000', email: 'cliente@ejemplo.com', address: 'Centro, Tepic, Nayarit, 63000' },
  customerReference: 'Equipo recibido en mostrador',
  equipment: [{ equipmentType: 'Laptop', brand: 'Lenovo', model: 'ThinkPad' }],
  materials: [{ description: 'Tapa para laptop', quantity: 1, unitCost: 250, supplier: 'Proveedor local' }],
  serviceAmount: 2500,
  total: 2750,
  paidAmount: 0,
  balance: 2750,
  notes: 'Garantia sujeta a revision del equipo.'
}, {
  businessName: 'Soportepic Servicio',
  slogan: 'Reparacion de celulares y computadoras',
  address: 'Tepic, Nayarit',
  postalCode: '63000',
  phone: '311-135-45-85',
  email: 'contacto@ejemplo.com',
  timezone: 'America/Mazatlan',
  rightsText: 'Derechos reservados Soportepic',
  supportPhone: '311-135-45-85',
  systemVersion: '1.2.1'
});
const salesNoteBuffer = await new Promise((resolve, reject) => {
  const chunks = [];
  sampleSalesNote.on('data', (chunk) => chunks.push(chunk));
  sampleSalesNote.on('end', () => resolve(Buffer.concat(chunks)));
  sampleSalesNote.on('error', reject);
  sampleSalesNote.end();
});
if (!salesNoteBuffer.subarray(0, 4).equals(Buffer.from('%PDF')) || salesNoteBuffer.length < 2_000) throw new Error(`La nota de venta PDF fallo (${salesNoteBuffer.length} bytes).`);
if (process.env.SALES_NOTE_SAMPLE_PATH) await writeFile(process.env.SALES_NOTE_SAMPLE_PATH, salesNoteBuffer);
console.log('PDF correcto: nota de venta con servicio, refaccion, total y saldo generada.');
