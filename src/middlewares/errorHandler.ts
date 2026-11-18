import type { Request, Response, NextFunction, ErrorRequestHandler } from 'express';
import { ZodError } from 'zod';
import httpStatus from 'http-status';
import { Prisma } from '../generated/prisma/client.js';
import { AppError } from '../utils/AppError.js';
import { env } from '../config/env.js';

export const errorHandler: ErrorRequestHandler = (
  err: unknown,
  req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _next: NextFunction
): void => {
  let statusCode: number = httpStatus.INTERNAL_SERVER_ERROR;
  let message = 'Internal Server Error';
  let error: Record<string, unknown> = { name: 'InternalServerError' };
  let validationErrors: Array<{ field: string; message: string }> | undefined;

  if (env.NODE_ENV !== 'test') {
    console.error(`[Error] ${req.method} ${req.originalUrl}:`, err);
  }

  if (err instanceof AppError) {
    statusCode = err.statusCode;
    message = err.message;
    error = { name: 'AppError' };
  } else if (err instanceof ZodError) {
    statusCode = httpStatus.BAD_REQUEST;
    message = 'Request validation failed';
    validationErrors = err.issues.map((issue) => ({
      field: issue.path.join('.'),
      message: issue.message,
    }));
    error = {
      name: 'ZodError',
      issues: validationErrors,
    };
  } else if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2002') {
      statusCode = httpStatus.CONFLICT;
      message = 'A record with this unique value already exists';
      error = {
        name: 'PrismaClientKnownRequestError',
        code: err.code,
        target: err.meta?.target,
      };
    } else if (err.code === 'P2025') {
      statusCode = httpStatus.NOT_FOUND;
      message = 'Record not found';
      error = {
        name: 'PrismaClientKnownRequestError',
        code: err.code,
      };
    } else if (err.code === 'P2003') {
      statusCode = httpStatus.BAD_REQUEST;
      message = 'Invalid reference identifier provided';
      error = {
        name: 'PrismaClientKnownRequestError',
        code: err.code,
        field: err.meta?.field_name,
      };
    } else {
      statusCode = httpStatus.BAD_REQUEST;
      message = 'Database operation failed';
      error = {
        name: 'PrismaClientKnownRequestError',
        code: err.code,
      };
    }
  } else if (
    err instanceof SyntaxError &&
    'status' in err &&
    err.status === httpStatus.BAD_REQUEST
  ) {
    statusCode = httpStatus.BAD_REQUEST;
    message = 'Invalid JSON payload received';
    error = { name: 'SyntaxError', details: err.message };
  } else if (err instanceof Error) {
    statusCode = httpStatus.INTERNAL_SERVER_ERROR;
    message = env.NODE_ENV === 'development' ? err.message : 'Internal Server Error';
    error = { name: err.name || 'Error' };
  }

  const responsePayload: Record<string, unknown> = {
    success: false,
    statusCode,
    message,
  };

  if (validationErrors) {
    responsePayload.errors = validationErrors;
  }

  responsePayload.error = error;

  res.status(statusCode).json(responsePayload);
};
