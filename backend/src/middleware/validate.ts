import { Request, Response, NextFunction } from 'express';
import { validationResult, ValidationChain } from 'express-validator';

/** Runs express-validator chains, then returns 422 with field errors if any fail. */
export const validate = (chains: ValidationChain[]) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    await Promise.all(chains.map((chain) => chain.run(req)));
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(422).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array().map((e) => ({
          field: 'path' in e ? (e as any).path : undefined,
          message: e.msg,
        })),
      });
    }
    next();
  };
};
