import { Router } from 'express';
import { body } from 'express-validator';
import { validate } from '../middleware/validate';
import {
  listCustomers,
  getCustomer,
  createCustomer,
  updateCustomer,
  deleteCustomer,
} from '../controllers/customerController';

const router = Router();

const customerValidation = [
  body('name').trim().notEmpty().withMessage('Name is required').isLength({ max: 150 }),
  body('mobile')
    .trim()
    .matches(/^[6-9]\d{9}$/)
    .withMessage('Enter a valid 10-digit mobile number'),
  body('email').optional({ values: 'falsy' }).isEmail().withMessage('Enter a valid email'),
  body('gstin')
    .optional({ values: 'falsy' })
    .matches(/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/)
    .withMessage('Enter a valid GSTIN'),
];

router.get('/', listCustomers);
router.get('/:id', getCustomer);
router.post('/', validate(customerValidation), createCustomer);
router.put('/:id', validate(customerValidation.map((v) => v.optional())), updateCustomer);
router.delete('/:id', deleteCustomer);

export default router;
