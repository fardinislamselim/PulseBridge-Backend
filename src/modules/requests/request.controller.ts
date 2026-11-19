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
} from './request.service.js';

export const createBloodRequestController = asyncHandler(
  async (req: Request, res: Response) => {
    const result = await createBloodRequest(req.user!.id, req.body, req.user!);
    return sendCreated(res, 'Blood request created successfully', result);
  }
);

export const getBloodRequestsController = asyncHandler(
  async (req: Request, res: Response) => {
    const query = req.query as unknown as Parameters<typeof getBloodRequests>[0];
    const result = await getBloodRequests(query, req.user);
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
    const query = req.query as unknown as Parameters<typeof getMyBloodRequests>[1];
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
    const result = await cancelBloodRequest(
      requestId,
      req.body?.cancellationReason,
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
    const result = await rejectBloodRequest(
      requestId,
      req.body.rejectionReason,
      req.user!
    );
    return sendSuccess(res, 'Blood request rejected successfully', result);
  }
);
