import rateLimit from 'express-rate-limit';
import type { Request, Response } from 'express';
import httpStatus from 'http-status';

export const globalRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit: 100, // Limit each IP to 100 requests per 15 minutes
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req: Request, res: Response) => {
    res.status(httpStatus.TOO_MANY_REQUESTS).json({
      success: false,
      statusCode: httpStatus.TOO_MANY_REQUESTS,
      message: 'Too many requests, please try again later',
      error: { name: 'RateLimitError' },
    });
  },
});
