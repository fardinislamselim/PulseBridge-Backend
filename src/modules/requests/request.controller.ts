import type { Request, Response } from 'express';
import httpStatus from 'http-status';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { sendCreated, sendSuccess } from '../../utils/ApiResponse.js';
import {
  createBloodRequest,
  getBloodRequests,
  getMyBloodRequests,
  getBloodRequestById,
  updateBloodRequest,
  cancelBloodRequest,
  approveBloodRequest,
  rejectBloodRequest,
  updateBloodRequestUrgency,
  expireBloodRequest,
  getBloodRequestHistory,
  getAdminBloodRequests,
  getAdminBloodRequestById,
} from './request.service.js';
import type {
  GetBloodRequestsQueryDTO,
  AdminGetBloodRequestsQueryDTO,
} from './request.interface.js';

export const createBloodRequestController = asyncHandler(
  async (req: Request, res: Response) => {
    const result = await createBloodRequest(req.user!.id, req.body, req.user!);
    return sendCreated(res, 'Blood request created successfully', result);
  }
);

export const getBloodRequestsController = asyncHandler(
  async (req: Request, res: Response) => {
    const query = req.query as unknown as GetBloodRequestsQueryDTO;
    const result = await getBloodRequests(query);
    return sendSuccess(
      res,
      'Blood requests retrieved successfully',
      result.data,
      httpStatus.OK,
      result.meta
    );
  }
);

export const getMyBloodRequestsController = asyncHandler(
  async (req: Request, res: Response) => {
    const query = req.query as unknown as GetBloodRequestsQueryDTO;
    const result = await getMyBloodRequests(req.user!.id, query);
    return sendSuccess(
      res,
      'My blood requests retrieved successfully',
      result.data,
      httpStatus.OK,
      result.meta
    );
  }
);

export const getBloodRequestByIdController = asyncHandler(
  async (req: Request, res: Response) => {
    const requestId = Array.isArray(req.params.requestId)
      ? req.params.requestId[0]
      : req.params.requestId;
    const result = await getBloodRequestById(requestId, req.user);
    return sendSuccess(res, 'Blood request retrieved successfully', result);
  }
);

export const updateBloodRequestController = asyncHandler(
  async (req: Request, res: Response) => {
    const requestId = Array.isArray(req.params.requestId)
      ? req.params.requestId[0]
      : req.params.requestId;
    const result = await updateBloodRequest(requestId, req.body, req.user!);
    return sendSuccess(res, 'Blood request updated successfully', result);
  }
);

export const cancelBloodRequestController = asyncHandler(
  async (req: Request, res: Response) => {
    const requestId = Array.isArray(req.params.requestId)
      ? req.params.requestId[0]
      : req.params.requestId;
    const cancellationReason = req.body?.cancellationReason || req.body?.reason;
    const result = await cancelBloodRequest(
      requestId,
      cancellationReason,
      req.user!
    );
    return sendSuccess(res, 'Blood request cancelled successfully', result);
  }
);

export const approveBloodRequestController = asyncHandler(
  async (req: Request, res: Response) => {
    const requestId = Array.isArray(req.params.requestId)
      ? req.params.requestId[0]
      : req.params.requestId;
    const result = await approveBloodRequest(requestId, req.user!);
    return sendSuccess(res, 'Blood request approved successfully', result);
  }
);

export const rejectBloodRequestController = asyncHandler(
  async (req: Request, res: Response) => {
    const requestId = Array.isArray(req.params.requestId)
      ? req.params.requestId[0]
      : req.params.requestId;
    const rejectionReason = req.body?.rejectionReason || req.body?.reason || 'Administrative rejection';
    const result = await rejectBloodRequest(
      requestId,
      rejectionReason,
      req.user!
    );
    return sendSuccess(res, 'Blood request rejected successfully', result);
  }
);

export const updateBloodRequestUrgencyController = asyncHandler(
  async (req: Request, res: Response) => {
    const requestId = Array.isArray(req.params.requestId)
      ? req.params.requestId[0]
      : req.params.requestId;
    const result = await updateBloodRequestUrgency(requestId, req.body, req.user!);
    return sendSuccess(res, 'Blood request urgency updated successfully', result);
  }
);

export const expireBloodRequestController = asyncHandler(
  async (req: Request, res: Response) => {
    const requestId = Array.isArray(req.params.requestId)
      ? req.params.requestId[0]
      : req.params.requestId;
    const result = await expireBloodRequest(requestId, req.user!, req.body?.reason);
    return sendSuccess(res, 'Blood request expired successfully', result);
  }
);

export const getBloodRequestHistoryController = asyncHandler(
  async (req: Request, res: Response) => {
    const requestId = Array.isArray(req.params.requestId)
      ? req.params.requestId[0]
      : req.params.requestId;
    const result = await getBloodRequestHistory(requestId, req.user!);
    return sendSuccess(res, 'Blood request lifecycle history retrieved successfully', result);
  }
);

export const getAdminBloodRequestsController = asyncHandler(
  async (req: Request, res: Response) => {
    const query = req.query as unknown as AdminGetBloodRequestsQueryDTO;
    const result = await getAdminBloodRequests(query);
    return sendSuccess(
      res,
      'Administrative blood requests retrieved successfully',
      result.data,
      httpStatus.OK,
      result.meta
    );
  }
);

export const getAdminBloodRequestByIdController = asyncHandler(
  async (req: Request, res: Response) => {
    const requestId = Array.isArray(req.params.requestId)
      ? req.params.requestId[0]
      : req.params.requestId;
    const result = await getAdminBloodRequestById(requestId);
    return sendSuccess(res, 'Administrative blood request details retrieved successfully', result);
  }
);
