import { body } from 'express-validator';

/**
 * Same policy as the staff signup: 8+ characters with at least a letter and a number.
 * Max 72 because bcrypt silently ignores anything past 72 bytes.
 */
export const newPasswordRules = (field: string) =>
  body(field)
    .isLength({ min: 8, max: 72 }).withMessage('Password must be 8–72 characters')
    .matches(/[A-Za-z]/).withMessage('Password must contain at least one letter')
    .matches(/[0-9]/).withMessage('Password must contain at least one number');
