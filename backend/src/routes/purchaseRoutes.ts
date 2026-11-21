import { Router } from 'express';
import {
  listSuppliers,
  createSupplier,
  listPurchases,
  getPurchase,
  createPurchase,
} from '../controllers/purchaseController';

const router = Router();

router.get('/suppliers', listSuppliers);
router.post('/suppliers', createSupplier);

router.get('/', listPurchases);
router.get('/:id', getPurchase);
router.post('/', createPurchase);

export default router;
