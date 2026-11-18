import type { Request, Response, NextFunction } from 'express';
import httpStatus from 'http-status';
import { AppError } from '../utils/AppError.js';

export const notFound = (req: Request, _res: Response, next: NextFunction): void => {
  const error = new AppError(
    httpStatus.NOT_FOUND,
    `Route not found: ${req.method} ${req.originalUrl}`
  );
  next(error);
};
