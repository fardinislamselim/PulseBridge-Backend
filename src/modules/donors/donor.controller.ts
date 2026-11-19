import type { Request, Response } from 'express';
import httpStatus from 'http-status';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { sendSuccess } from '../../utils/ApiResponse.js';
import {
  getMyDonorProfile,
  updateMyDonorProfile,
  updateMyDonorAvailability,
  checkDonorEligibility,
  getDonorById,
  getDonors,
  getNearbyDonors,
  adminVerifyDonor,
  adminRestrictDonor,
  searchDonors,
} from './donor.service.js';
import type { DonorSearchQueryDTO, CompatibleDonorsQueryDTO } from './donor.interface.js';

export const getMyDonorProfileController = asyncHandler(
  async (req: Request, res: Response) => {
    const profile = await getMyDonorProfile(req.user!.id);
    return sendSuccess(res, 'Donor profile retrieved successfully', profile);
  },
);

export const updateMyDonorProfileController = asyncHandler(
  async (req: Request, res: Response) => {
    const updatedProfile = await updateMyDonorProfile(req.user!.id, req.body);
    return sendSuccess(res, 'Donor profile updated successfully', updatedProfile);
  },
);

export const updateMyDonorAvailabilityController = asyncHandler(
  async (req: Request, res: Response) => {
    const updatedProfile = await updateMyDonorAvailability(
      req.user!.id,
      req.body.isAvailable,
    );
    return sendSuccess(
      res,
      'Donor availability updated successfully',
      updatedProfile,
    );
  },
);

export const getDonorEligibilityController = asyncHandler(
  async (req: Request, res: Response) => {
    const eligibility = await checkDonorEligibility(req.user!.id);
    return sendSuccess(
      res,
      'Donor eligibility status evaluated successfully',
      eligibility,
    );
  },
);

export const getNearbyDonorsController = asyncHandler(
  async (req: Request, res: Response) => {
    const query = req.query as unknown as Parameters<typeof getNearbyDonors>[0];
    const donors = await getNearbyDonors(query, req.user);
    return sendSuccess(res, 'Nearby donors retrieved successfully', donors);
  },
);

export const getDonorByIdController = asyncHandler(
  async (req: Request, res: Response) => {
    const donorId = Array.isArray(req.params.donorId)
      ? req.params.donorId[0]
      : req.params.donorId;
    const donor = await getDonorById(donorId, req.user);
    return sendSuccess(res, 'Donor retrieved successfully', donor);
  },
);

export const getDonorsController = asyncHandler(
  async (req: Request, res: Response) => {
    const query = req.query as unknown as Parameters<typeof getDonors>[0];
    const result = await getDonors(query, req.user);
    return sendSuccess(
      res,
      'Donors retrieved successfully',
      result.data,
      httpStatus.OK,
      result.meta,
    );
  },
);

export const adminVerifyDonorController = asyncHandler(
  async (req: Request, res: Response) => {
    const donorId = Array.isArray(req.params.donorId)
      ? req.params.donorId[0]
      : req.params.donorId;
    const updatedDonor = await adminVerifyDonor(
      donorId,
      req.body.isVerified,
      req.user,
    );
    return sendSuccess(
      res,
      'Donor verification status updated successfully',
      updatedDonor,
    );
  },
);

export const adminRestrictDonorController = asyncHandler(
  async (req: Request, res: Response) => {
    const donorId = Array.isArray(req.params.donorId)
      ? req.params.donorId[0]
      : req.params.donorId;
    const updatedDonor = await adminRestrictDonor(
      donorId,
      req.body,
      req.user,
    );
    return sendSuccess(
      res,
      'Donor medical restrictions updated successfully',
      updatedDonor,
    );
  },
);

export const searchDonorsController = asyncHandler(
  async (req: Request, res: Response) => {
    const query = req.query as unknown as DonorSearchQueryDTO;
    const result = await searchDonors(query, req.user);
    return sendSuccess(
      res,
      'Donors retrieved successfully',
      result.data,
      httpStatus.OK,
      result.meta,
    );
  },
);

export const getCompatibleDonorsController = asyncHandler(
  async (req: Request, res: Response) => {
    const query = req.query as unknown as CompatibleDonorsQueryDTO;
    const result = await searchDonors(
      {
        recipientBloodGroup: query.recipientBloodGroup,
        district: query.district,
        city: query.city,
        area: query.area,
        isAvailable: query.isAvailable,
        eligibleOnly: query.eligibleOnly,
        page: query.page,
        limit: query.limit,
      },
      req.user,
    );
    return sendSuccess(
      res,
      'Compatible donors retrieved successfully',
      result.data,
      httpStatus.OK,
      result.meta,
    );
  },
);
