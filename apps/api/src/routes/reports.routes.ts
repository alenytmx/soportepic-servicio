import { Router } from 'express';
import { authenticate, requirePermission } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { reportQuerySchema } from './schemas.js';
import { downloadReportPdfController, getReportSummaryController } from '../controllers/reports.controller.js';

export const reportsRouter = Router();
reportsRouter.use(authenticate);

reportsRouter.get('/summary', requirePermission('reports:view'), validate(reportQuerySchema, 'query'), asyncHandler(getReportSummaryController));
reportsRouter.get('/pdf', requirePermission('reports:download'), validate(reportQuerySchema, 'query'), asyncHandler(downloadReportPdfController));
