import { Router } from 'express';
import { body, param } from 'express-validator';
import { validate } from '../middleware/validate';
import {
  createPortalAccount,
  listPortalAccounts,
  listWithdrawals,
  markWithdrawalPaid,
  rejectWithdrawal,
  resetPortalPassword,
  setPortalAccountStatus,
} from '../controllers/portalAdminController';

// Mounted in server.ts behind requireAuth + requireRole('admin'); nothing here is reachable by a customer or a non-admin staff user.
const router = Router();

const idParam = (name: string) => param(name).isInt({ min: 1 }).withMessage('Invalid id');

router.get('/withdrawals', listWithdrawals);
router.patch(
  '/withdrawals/:id/pay',
  validate([
    idParam('id'),
    body('payout_reference').trim().isLength({ min: 3, max: 100 }).withMessage('Enter the payment reference (UTR / transaction id)'),
    body('admin_note').optional({ values: 'falsy' }).trim().isLength({ max: 255 }),
  ]),
  markWithdrawalPaid
);
router.patch(
  '/withdrawals/:id/reject',
  validate([idParam('id'), body('admin_note').trim().isLength({ min: 3, max: 255 }).withMessage('Give the customer a reason for the rejection')]),
  rejectWithdrawal
);

router.get('/accounts', listPortalAccounts);
router.post(
  '/customers/:customerId/account',
  validate([idParam('customerId'), body('email').optional({ values: 'falsy' }).isEmail().withMessage('Enter a valid email')]),
  createPortalAccount
);
router.post('/customers/:customerId/reset-password', validate([idParam('customerId')]), resetPortalPassword);
router.patch(
  '/customers/:customerId/account-status',
  validate([idParam('customerId'), body('status').isIn(['active', 'inactive']).withMessage('Status must be active or inactive')]),
  setPortalAccountStatus
);

export default router;
