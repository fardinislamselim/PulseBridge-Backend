import type { Request, Response } from 'express';
import httpStatus from 'http-status';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { sendSuccess } from '../../utils/ApiResponse.js';
import {
  getMyProfile,
  updateMyProfile,
  getUsers,
  getUserById,
  updateUserStatus,
  updateUserRole,
} from './user.service.js';

export const getMyProfileController = asyncHandler(async (req: Request, res: Response) => {
  const profile = await getMyProfile(req.user!.id);
  return sendSuccess(res, 'Profile retrieved successfully', profile);
});

export const updateMyProfileController = asyncHandler(async (req: Request, res: Response) => {
  const updatedProfile = await updateMyProfile(req.user!.id, req.body);
  return sendSuccess(res, 'Profile updated successfully', updatedProfile);
});

export const getUsersController = asyncHandler(async (req: Request, res: Response) => {
  const result = await getUsers(req.query);
  return sendSuccess(res, 'Users retrieved successfully', result.data, httpStatus.OK, result.meta);
});

export const getUserByIdController = asyncHandler(async (req: Request, res: Response) => {
  const userId = Array.isArray(req.params.userId) ? req.params.userId[0] : req.params.userId;
  const user = await getUserById(userId);
  return sendSuccess(res, 'User details retrieved successfully', user);
});

export const updateUserStatusController = asyncHandler(async (req: Request, res: Response) => {
  const userId = Array.isArray(req.params.userId) ? req.params.userId[0] : req.params.userId;
  const meta = {
    ipAddress: req.ip || req.socket.remoteAddress,
    userAgent: req.headers['user-agent'],
  };

  const updatedUser = await updateUserStatus(userId, req.body, req.user!, meta);
  return sendSuccess(res, 'User status updated successfully', updatedUser);
});

export const updateUserRoleController = asyncHandler(async (req: Request, res: Response) => {
  const userId = Array.isArray(req.params.userId) ? req.params.userId[0] : req.params.userId;
  const meta = {
    ipAddress: req.ip || req.socket.remoteAddress,
    userAgent: req.headers['user-agent'],
  };

  const updatedUser = await updateUserRole(userId, req.body, req.user!, meta);
  return sendSuccess(res, 'User role updated successfully', updatedUser);
});
