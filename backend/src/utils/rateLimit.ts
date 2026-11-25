import { Request, Response, NextFunction, RequestHandler } from 'express';

interface Bucket {
  count: number;
  resetAt: number;
}

interface RateLimitOptions {
  windowMs: number;
  max: number;
  /** Build the bucket key. Return null to skip limiting for this request. */
  keyFn: (req: Request) => string | null;
  message?: string;
}

/**
 * Minimal fixed-window rate limiter — no extra dependency required.
 *
 * Counters live in process memory, which is right for a single Node instance. If you
 * later run several instances behind a load balancer, swap this for a shared store
 * (e.g. `express-rate-limit` + Redis) — the call sites stay identical.
 *
 * NOTE: behind a reverse proxy (nginx, Cloudflare, a PaaS) set `app.set('trust proxy', 1)`
 * so `req.ip` is the real client address instead of the proxy's.
 */
export function rateLimit({ windowMs, max, keyFn, message }: RateLimitOptions): RequestHandler {
  const buckets = new Map<string, Bucket>();

  // Periodic sweep so the map can't grow without bound. unref() keeps it from holding the process open.
  setInterval(() => {
    const now = Date.now();
    for (const [key, b] of buckets) if (b.resetAt <= now) buckets.delete(key);
  }, Math.min(windowMs, 60_000)).unref();

  return (req: Request, res: Response, next: NextFunction) => {
    const key = keyFn(req);
    if (!key) return next();

    const now = Date.now();
    let bucket = buckets.get(key);
    if (!bucket || bucket.resetAt <= now) {
      bucket = { count: 0, resetAt: now + windowMs };
      buckets.set(key, bucket);
    }
    bucket.count += 1;

    if (bucket.count > max) {
      const retryAfter = Math.ceil((bucket.resetAt - now) / 1000);
      res.setHeader('Retry-After', String(retryAfter));
      return res.status(429).json({
        success: false,
        message: message || 'Too many attempts. Please wait a few minutes and try again.',
      });
    }
    next();
  };
}

export const clientIp = (req: Request): string => req.ip || req.socket.remoteAddress || 'unknown';
