import { Router } from 'express';
import {
  listInvoices,
  getInvoice,
  createInvoice,
  previewInvoice,
  updateInvoiceStatus,
  downloadInvoicePdf,
} from '../controllers/invoiceController';

const router = Router();

router.get('/', listInvoices);
router.post('/preview', previewInvoice);
router.get('/:id', getInvoice);
router.post('/', createInvoice);
router.patch('/:id/status', updateInvoiceStatus);
router.get('/:id/pdf', downloadInvoicePdf);

export default router;
