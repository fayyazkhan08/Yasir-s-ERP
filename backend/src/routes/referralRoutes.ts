import { Router } from 'express';
import {
  listReferrals,
  createReferral,
  markReferralSuccessful,
  getAvailableRewards,
} from '../controllers/referralController';

const router = Router();

router.get('/', listReferrals);
router.get('/rewards/available', getAvailableRewards);
router.post('/', createReferral);
router.patch('/:id/mark-successful', markReferralSuccessful);

export default router;
