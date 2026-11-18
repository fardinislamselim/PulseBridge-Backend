import type { Response } from 'express';
import httpStatus from 'http-status';

export type TMeta = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

export type TResponseData<T> = {
  success: boolean;
  statusCode: number;
  message: string;
  data: T;
  meta?: TMeta;
};

export const sendResponse = <T>(res: Response, data: TResponseData<T>): Response => {
  return res.status(data.statusCode).json({
    success: data.success,
    statusCode: data.statusCode,
    message: data.message,
    data: data.data,
    ...(data.meta ? { meta: data.meta } : {}),
  });
};

export const sendSuccess = <T = unknown>(
  res: Response,
  message: string,
  data?: T,
  statusCode = httpStatus.OK,
  meta?: TMeta
): Response => {
  return sendResponse(res, {
    success: true,
    statusCode,
    message,
    data: (data !== undefined ? data : {}) as T,
    meta,
  });
};

export const sendCreated = <T = unknown>(res: Response, message: string, data?: T): Response => {
  return sendResponse(res, {
    success: true,
    statusCode: httpStatus.CREATED,
    message,
    data: (data !== undefined ? data : {}) as T,
  });
};

export const formatResponse = <T = unknown>(
  message: string,
  data: T,
  statusCode = httpStatus.OK,
  meta?: TMeta
): TResponseData<T> => ({
  success: true,
  statusCode,
  message,
  data,
  ...(meta ? { meta } : {}),
});
