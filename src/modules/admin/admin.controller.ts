import type { Request, Response } from 'express';
import httpStatus from 'http-status';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { sendSuccess } from '../../utils/ApiResponse.js';
import { getAdminDashboard, getAuditLogs } from './admin.service.js';

export const getAdminDashboardController = asyncHandler(async (_req: Request, res: Response) => {
  const stats = await getAdminDashboard();
  return sendSuccess(res, 'Admin dashboard metrics retrieved successfully', stats);
});

export const getAuditLogsController = asyncHandler(async (req: Request, res: Response) => {
  const result = await getAuditLogs(req.query);
  return sendSuccess(res, 'Audit logs retrieved successfully', result.data, httpStatus.OK, result.meta);
});