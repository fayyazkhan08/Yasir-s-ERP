import { Router } from 'express';
import { body } from 'express-validator';
import { validate } from '../middleware/validate';
import { login, logout, register } from '../controllers/portalAuthController';
import { clientIp, rateLimit } from '../utils/rateLimit';
import { REFERRAL_CODE_PATTERN } from '../utils/portalHelpers';
import { newPasswordRules } from '../utils/portalValidation';

const router = Router();

const email = body('email').trim().notEmpty().withMessage('Email is required').isEmail().withMessage('Enter a valid email address');

// Brute-force protection on the two public endpoints.
// Login is limited per IP+email (stops guessing one account) AND per IP (stops spraying many accounts).
const loginPerAccount = rateLimit({
  windowMs: 15 * 60_000,
  max: 10,
  keyFn: (req) => `login:${clientIp(req)}:${String(req.body?.email || '').toLowerCase().trim()}`,
});
const loginPerIp = rateLimit({ windowMs: 15 * 60_000, max: 50, keyFn: (req) => `login-ip:${clientIp(req)}` });
const registerPerIp = rateLimit({
  windowMs: 60 * 60_000,
  max: 10,
  keyFn: (req) => `register:${clientIp(req)}`,
  message: 'Too many sign-ups from this network. Please try again later.',
});

router.post(
  '/register',
  registerPerIp,
  validate([
    body('name').trim().isLength({ min: 2, max: 100 }).withMessage('Name must be 2–100 characters'),
    body('mobile').trim().matches(/^[6-9]\d{9}$/).withMessage('Enter a valid 10-digit mobile number'),
    email,
    newPasswordRules('password'),
    body('referral_code')
      .optional({ values: 'falsy' })
      .trim()
      .matches(REFERRAL_CODE_PATTERN)
      .withMessage('Referral code looks invalid'),
  ]),
  register
);

router.post(
  '/login',
  loginPerIp,
  validate([email, body('password').notEmpty().withMessage('Password is required')]),
  loginPerAccount,
  login
);

router.post('/logout', logout);

export default router;
