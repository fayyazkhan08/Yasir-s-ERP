import { Router } from 'express';
import {
  listVendors,
  getVendor,
  getVendorLowStock,
  createVendor,
  updateVendor,
  deleteVendor,
} from '../controllers/vendorController';

const router = Router();

router.get('/', listVendors);
router.get('/:id', getVendor);
router.get('/:id/low-stock', getVendorLowStock);
router.post('/', createVendor);
router.put('/:id', updateVendor);
router.delete('/:id', deleteVendor);

export default router;