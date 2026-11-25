// import { Router } from 'express';
// import {
//   listInventory,
//   getLowStockItems,
//   getInventoryItem,
//   createInventoryItem,
//   updateInventoryItem,
//   adjustStock,
//   deleteInventoryItem,
// } from '../controllers/inventoryController';

// const router = Router();

// router.get('/', listInventory);
// router.get('/low-stock', getLowStockItems);
// router.get('/:id', getInventoryItem);
// router.post('/', createInventoryItem);
// router.put('/:id', updateInventoryItem);
// router.post('/:id/adjust', adjustStock);
// router.delete('/:id', deleteInventoryItem);

// export default router;


import { Router } from 'express';
import {
  listInventory,
  getLowStockItems,
  listSupplierOptions,
  getInventoryItem,
  createInventoryItem,
  updateInventoryItem,
  adjustStock,
  deleteInventoryItem,
} from '../controllers/inventoryController';

const router = Router();

router.get('/', listInventory);
router.get('/low-stock', getLowStockItems);
router.get('/suppliers', listSupplierOptions);
router.get('/:id', getInventoryItem);
router.post('/', createInventoryItem);
router.put('/:id', updateInventoryItem);
router.post('/:id/adjust', adjustStock);
router.delete('/:id', deleteInventoryItem);

export default router;