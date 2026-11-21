import { Request, Response, NextFunction, RequestHandler } from 'express';

/** Wraps async route handlers so thrown errors reach the error middleware. */
export const asyncHandler =
  (fn: (req: Request, res: Response, next: NextFunction) => Promise<any>): RequestHandler =>
  (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };

/** Normalizes pagination/sort/search query params with safe defaults. */
export function parsePagination(
  query: Record<string, any>,
  allowedSortColumns: string[],
  defaultSort = 'id'
) {
  const page = Math.max(1, parseInt(query.page as string) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(query.limit as string) || 10));
  const offset = (page - 1) * limit;

  let sortBy = defaultSort;
  if (query.sortBy && allowedSortColumns.includes(query.sortBy)) {
    sortBy = query.sortBy;
  }
  const sortDir = query.sortDir === 'asc' ? 'ASC' : 'DESC';

  return { page, limit, offset, sortBy, sortDir };
}

export function buildPaginatedResponse<T>(
  data: T[],
  total: number,
  page: number,
  limit: number
) {
  return {
    data,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    },
  };
}

/** Generates a sequential code like INV-2026-000123 */
export function generateCode(prefix: string, id: number): string {
  const year = new Date().getFullYear();
  return `${prefix}-${year}-${String(id).padStart(6, '0')}`;
}

export class HttpError extends Error {
  statusCode: number;
  details?: any;
  constructor(statusCode: number, message: string, details?: any) {
    super(message);
    this.statusCode = statusCode;
    this.details = details;
  }
}
