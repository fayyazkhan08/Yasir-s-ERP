import { Router } from 'express';
import {
  listPlans,
  listSubscriptions,
  createSubscription,
  cancelSubscription,
} from '../controllers/subscriptionController';

const router = Router();

router.get('/plans', listPlans);
router.get('/', listSubscriptions);
router.post('/', createSubscription);
router.patch('/:id/cancel', cancelSubscription);

export default router;
