import { Router } from 'express';
import { exportReport, getReportSummary } from '../controllers/reportController';

const router = Router();
router.get('/export/:type', exportReport);
router.get('/summary/:type', getReportSummary);

export default router;
