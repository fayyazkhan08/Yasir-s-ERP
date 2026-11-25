import { Router } from 'express';
import {
  listDealerOrders,
  trackingSummary,
  listKnownDealers,
  getDealerOrder,
  createDealerOrder,
  updateDealerOrder,
  deleteDealerOrder,
  addTrackingEvent,
} from '../controllers/dealerOrderController';

const router = Router();

// Fixed paths must come before '/:id'
router.get('/summary', trackingSummary);
router.get('/dealers', listKnownDealers);

router.get('/', listDealerOrders);
router.post('/', createDealerOrder);
router.get('/:id', getDealerOrder);
router.put('/:id', updateDealerOrder);
router.delete('/:id', deleteDealerOrder);
router.post('/:id/tracking', addTrackingEvent);

export default router;