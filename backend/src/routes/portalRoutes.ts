import { Router } from 'express';
import { body, param } from 'express-validator';
import { validate } from '../middleware/validate';
import { requirePasswordCurrent, requirePortalAuth } from '../middleware/portalAuth';
import { changePassword } from '../controllers/portalAuthController';
import {
  cancelWithdrawal,
  createWithdrawal,
  getDashboard,
  getMe,
  getSubscription,
  listCommissions,
  listReferrals,
  listTransactions,
  listWithdrawals,
} from '../controllers/portalController';
import { newPasswordRules } from '../utils/portalValidation';

const router = Router();

// Everything below requires a valid customer session.
router.use(requirePortalAuth);

// These two stay available while a temporary password is still active, so the customer can fix it.
router.get('/me', getMe);
router.post(
  '/change-password',
  validate([body('current_password').notEmpty().withMessage('Current password is required'), newPasswordRules('new_password')]),
  changePassword
);

// Everything else is blocked (server-side) until the temporary password has been replaced.
router.use(requirePasswordCurrent);

router.get('/dashboard', getDashboard);
router.get('/subscription', getSubscription);
router.get('/referrals', listReferrals);
router.get('/commissions', listCommissions);
router.get('/transactions', listTransactions);
router.get('/withdrawals', listWithdrawals);

router.post(
  '/withdrawals',
  validate([
    body('amount')
      .custom((v) => /^\d{1,9}(\.\d{1,2})?$/.test(String(v)) && Number(v) > 0)
      .withMessage('Enter a valid amount (up to 2 decimal places)'),
    body('payout_method').isIn(['upi', 'bank_transfer']).withMessage('Choose UPI or bank transfer'),
    body('upi_id')
      .if(body('payout_method').equals('upi'))
      .trim()
      .matches(/^[A-Za-z0-9._-]{2,64}@[A-Za-z][A-Za-z0-9]{1,31}$/)
      .withMessage('Enter a valid UPI ID, e.g. name@bank'),
    body('bank_account_name')
      .if(body('payout_method').equals('bank_transfer'))
      .trim()
      .isLength({ min: 2, max: 150 })
      .withMessage("Enter the account holder's name"),
    body('bank_account_number')
      .if(body('payout_method').equals('bank_transfer'))
      .trim()
      .matches(/^\d{9,18}$/)
      .withMessage('Account number must be 9–18 digits'),
    body('bank_ifsc')
      .if(body('payout_method').equals('bank_transfer'))
      .trim()
      .toUpperCase()
      .matches(/^[A-Z]{4}0[A-Z0-9]{6}$/)
      .withMessage('Enter a valid 11-character IFSC code'),
  ]),
  createWithdrawal
);
router.post('/withdrawals/:id/cancel', validate([param('id').isInt({ min: 1 }).withMessage('Invalid request id')]), cancelWithdrawal);

export default router;
