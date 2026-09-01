import fs from 'node:fs';
import path from 'node:path';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import morgan from 'morgan';
import { env } from './config/env.js';
import { requestContext } from './middleware/requestContext.js';
import { rejectUnsafePayload, sameOriginForMutations } from './middleware/security.js';
import { errorHandler, notFound } from './middleware/errorHandler.js';
import { authenticate } from './middleware/auth.js';
import { uploadDirectory } from './middleware/upload.js';
import { asyncHandler } from './utils/asyncHandler.js';
import { AppError } from './utils/AppError.js';
import { ServiceOrder } from './models/ServiceOrder.js';
import { authRouter } from './routes/auth.routes.js';
import { usersRouter } from './routes/users.routes.js';
import { clientsRouter } from './routes/clients.routes.js';
import { orderTypesRouter } from './routes/order-types.routes.js';
import { ordersRouter } from './routes/orders.routes.js';
import { expensesRouter } from './routes/expenses.routes.js';
import { settingsRouter } from './routes/settings.routes.js';
import { reportsRouter } from './routes/reports.routes.js';
import { auditRouter } from './routes/audit.routes.js';
import { quotationTypesRouter } from './routes/quotation-types.routes.js';
import { quotationsRouter } from './routes/quotations.routes.js';
import { warrantiesRouter } from './routes/warranties.routes.js';
import { databaseState, isDatabaseReady } from './config/db.js';
import { isAllowedOrigin } from './utils/origin.js';

export const app = express();

app.disable('x-powered-by');
app.set('trust proxy', env.TRUST_PROXY);
app.use(requestContext);
app.use(helmet({ crossOriginResourcePolicy: { policy: 'same-origin' } }));
app.use(cors({
  origin: (origin, callback) => callback(null, isAllowedOrigin(origin)),
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS']
}));
app.use(compression());
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: false, limit: '1mb' }));
app.use(cookieParser());
app.use(rejectUnsafePayload);
app.use(sameOriginForMutations(isAllowedOrigin));
if (env.NODE_ENV !== 'test') app.use(morgan(env.NODE_ENV === 'production' ? 'combined' : 'dev'));

app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    version: '1.3.0',
    timestamp: new Date().toISOString(),
    database: {
      connected: isDatabaseReady(),
      connecting: databaseState.connecting,
      lastError: databaseState.lastError,
      lastAttemptAt: databaseState.lastAttemptAt
    }
  });
});

app.use('/api', (req, res, next) => {
  if (isDatabaseReady()) return next();
  res.status(503).json({
    message: 'MongoDB no esta conectado. Inicia el servicio de MongoDB o revisa MONGODB_URI en apps/api/.env.',
    code: 'DATABASE_UNAVAILABLE',
    details: databaseState.lastError,
    requestId: req.requestId
  });
});

app.use('/api/auth', authRouter);
app.use('/api/users', usersRouter);
app.use('/api/clients', clientsRouter);
app.use('/api/order-types', orderTypesRouter);
app.use('/api/quotation-types', quotationTypesRouter);
app.use('/api/quotations', quotationsRouter);
app.use('/api/service-orders', ordersRouter);
app.use('/api/warranties', warrantiesRouter);
app.use('/api/expenses', expensesRouter);
app.use('/api/settings', settingsRouter);
app.use('/api/reports', reportsRouter);
app.use('/api/audit', auditRouter);

app.get('/api/files/:filename', authenticate, asyncHandler(async (req, res) => {
  const rawFilename = String(req.params.filename || '');
  const filename = path.basename(rawFilename);
  if (!filename || filename !== rawFilename) throw new AppError('Nombre de archivo invalido.', 400);
  const referenced = await ServiceOrder.exists({ 'photos.filename': filename });
  const filePath = path.join(uploadDirectory, filename);
  if (!referenced || !fs.existsSync(filePath)) throw new AppError('Evidencia no encontrada.', 404);
  res.setHeader('Cache-Control', 'private, max-age=3600');
  res.sendFile(filePath);
}));

const webDist = path.resolve(process.cwd(), '../web/dist');
if (env.NODE_ENV === 'production' && fs.existsSync(webDist)) {
  app.use(express.static(webDist, { index: false, maxAge: '1h' }));
  app.use((req, res, next) => {
    if (req.path.startsWith('/api/')) return next();
    res.setHeader('Cache-Control', 'no-cache');
    res.sendFile(path.join(webDist, 'index.html'));
  });
}

app.use(notFound);
app.use(errorHandler);
