// import { Router } from 'express';
// import { body } from 'express-validator';
// import { validate } from '../middleware/validate';
// import { requireAuth, requireRole } from '../middleware/auth';
// import {
//   login,
//   register,
//   logout,
//   me,
//   listUsers,
//   adminCreateUser,
//   updateUserRole,
//   updateUserStatus,
// } from '../controllers/authController';

// const router = Router();

// const emailField = body('email').trim().notEmpty().withMessage('Email is required').isEmail().withMessage('Enter a valid email address');

// // A real password policy — at least 8 chars, one letter, one number.
// // This is enforced both here (server, authoritative) and in the frontend form (UX).
// const passwordField = body('password')
//   .isLength({ min: 8 }).withMessage('Password must be at least 8 characters')
//   .matches(/[A-Za-z]/).withMessage('Password must contain at least one letter')
//   .matches(/[0-9]/).withMessage('Password must contain at least one number');

// const nameField = body('name').trim().notEmpty().withMessage('Name is required').isLength({ max: 100 }).withMessage('Name is too long');

// router.post(
//   '/login',
//   validate([
//     emailField,
//     body('password').notEmpty().withMessage('Password is required'),
//   ]),
//   login
// );

// router.post('/register', validate([nameField, emailField, passwordField]), register);

// router.post('/logout', requireAuth, logout);
// router.get('/me', requireAuth, me);

// // --- Admin-only user management ---
// router.get('/users', requireAuth, requireRole('admin'), listUsers);
// router.post(
//   '/users',
//   requireAuth,
//   requireRole('admin'),
//   validate([nameField, emailField, passwordField, body('role').isIn(['admin', 'user']).withMessage('Role must be admin or user')]),
//   adminCreateUser
// );
// router.patch('/users/:id/role', requireAuth, requireRole('admin'), updateUserRole);
// router.patch('/users/:id/status', requireAuth, requireRole('admin'), updateUserStatus);

// export default router;


import { Router } from 'express';
import { body } from 'express-validator';
import { validate } from '../middleware/validate';
import { requireAuth, requireRole } from '../middleware/auth';
import {
  login,
  register,
  logout,
  me,
  listUsers,
  adminCreateUser,
  updateUserRole,
  updateUserStatus,
} from '../controllers/authController';

const router = Router();

const emailField = body('email').trim().notEmpty().withMessage('Email is required').isEmail().withMessage('Enter a valid email address');

// A real password policy — at least 8 chars, one letter, one number.
// This is enforced both here (server, authoritative) and in the frontend form (UX).
const passwordField = body('password')
  .isLength({ min: 8 }).withMessage('Password must be at least 8 characters')
  .matches(/[A-Za-z]/).withMessage('Password must contain at least one letter')
  .matches(/[0-9]/).withMessage('Password must contain at least one number');

const nameField = body('name').trim().notEmpty().withMessage('Name is required').isLength({ max: 100 }).withMessage('Name is too long');

router.post(
  '/login',
  validate([
    emailField,
    body('password').notEmpty().withMessage('Password is required'),
  ]),
  login
);

router.post('/register', validate([nameField, emailField, passwordField]), register);

router.post('/logout', requireAuth, logout);
router.get('/me', requireAuth, me);

// --- Admin-only user management ---
router.get('/users', requireAuth, requireRole('admin'), listUsers);
router.post(
  '/users',
  requireAuth,
  requireRole('admin'),
  validate([nameField, emailField, passwordField, body('role').isIn(['admin', 'user', 'staff']).withMessage('Role must be admin, user or staff')]),
  adminCreateUser
);
router.patch('/users/:id/role', requireAuth, requireRole('admin'), updateUserRole);
router.patch('/users/:id/status', requireAuth, requireRole('admin'), updateUserStatus);

export default router;