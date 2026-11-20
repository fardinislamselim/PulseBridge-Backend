import type { Request, Response } from 'express';
import httpStatus from 'http-status';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { sendSuccess } from '../../utils/ApiResponse.js';
import {
  getAdminDashboard,
  getAdminDashboardOverview,
  getRecentActivities,
  getAuditLogs,
} from './admin.service.js';
import {
  getUserAnalytics,
  getDonorAnalytics,
  getBloodRequestAnalytics,
  getDonationAnalytics,
  getAssignmentAnalytics,
  getEmergencyAnalytics,
  getPaymentAnalytics,
  getNotificationAnalytics,
  getGrowthAnalytics,
} from './admin-analytics.service.js';

/**
 * Legacy Dashboard endpoint (for backward compatibility).
 */
export const getAdminDashboardController = asyncHandler(async (_req: Request, res: Response) => {
  const stats = await getAdminDashboard();
  return sendSuccess(res, 'Admin dashboard metrics retrieved successfully', stats);
});

/**
 * Comprehensive Dashboard Overview.
 */
export const getDashboardOverviewController = asyncHandler(async (_req: Request, res: Response) => {
  const overview = await getAdminDashboardOverview();
  return sendSuccess(res, 'Dashboard overview retrieved successfully', overview);
});

/**
 * Recent platform activities with pagination and filters.
 */
export const getRecentActivitiesController = asyncHandler(async (req: Request, res: Response) => {
  const result = await getRecentActivities(req.query);
  return sendSuccess(
    res,
    'Recent platform activities retrieved successfully',
    result.activities,
    httpStatus.OK,
    result.pagination
  );
});

/**
 * User registration, role distribution & account status analytics.
 */
export const getUserAnalyticsController = asyncHandler(async (req: Request, res: Response) => {
  const analytics = await getUserAnalytics(req.query);
  return sendSuccess(res, 'User analytics retrieved successfully', analytics);
});

/**
 * Donor availability, eligibility & blood group analytics.
 */
export const getDonorAnalyticsController = asyncHandler(async (req: Request, res: Response) => {
  const analytics = await getDonorAnalytics(req.query);
  return sendSuccess(res, 'Donor analytics retrieved successfully', analytics);
});

/**
 * Blood request volume, status, urgency & fulfillment analytics.
 */
export const getBloodRequestAnalyticsController = asyncHandler(async (req: Request, res: Response) => {
  const analytics = await getBloodRequestAnalytics(req.query);
  return sendSuccess(res, 'Blood request analytics retrieved successfully', analytics);
});

/**
 * Verified completed donation analytics & timeline trends.
 */
export const getDonationAnalyticsController = asyncHandler(async (req: Request, res: Response) => {
  const analytics = await getDonationAnalytics(req.query);
  return sendSuccess(res, 'Donation analytics retrieved successfully', analytics);
});

/**
 * Assignment lifecycle, acceptance & completion rates.
 */
export const getAssignmentAnalyticsController = asyncHandler(async (req: Request, res: Response) => {
  const analytics = await getAssignmentAnalytics(req.query);
  return sendSuccess(res, 'Assignment analytics retrieved successfully', analytics);
});

/**
 * Emergency requests, response timings & escalation analytics.
 */
export const getEmergencyAnalyticsController = asyncHandler(async (req: Request, res: Response) => {
  const analytics = await getEmergencyAnalytics(req.query);
  return sendSuccess(res, 'Emergency response analytics retrieved successfully', analytics);
});

/**
 * Payment collections, refunds & currency-safe revenue analytics.
 */
export const getPaymentAnalyticsController = asyncHandler(async (req: Request, res: Response) => {
  const analytics = await getPaymentAnalytics(req.query);
  return sendSuccess(res, 'Payment analytics retrieved successfully', analytics);
});

/**
 * Notification delivery, read rates & alert volume analytics.
 */
export const getNotificationAnalyticsController = asyncHandler(async (req: Request, res: Response) => {
  const analytics = await getNotificationAnalytics(req.query);
  return sendSuccess(res, 'Notification analytics retrieved successfully', analytics);
});

/**
 * Platform growth, comparative period growth rates & monthly activity.
 */
export const getGrowthAnalyticsController = asyncHandler(async (req: Request, res: Response) => {
  const analytics = await getGrowthAnalytics(req.query);
  return sendSuccess(res, 'Platform growth analytics retrieved successfully', analytics);
});

/**
 * Paginated audit logs.
 */
export const getAuditLogsController = asyncHandler(async (req: Request, res: Response) => {
  const result = await getAuditLogs(req.query);
  return sendSuccess(
    res,
    'Audit logs retrieved successfully',
    result.data,
    httpStatus.OK,
    result.meta
  );
});
