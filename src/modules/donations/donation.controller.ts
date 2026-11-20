import type { Request, Response } from 'express';
import httpStatus from 'http-status';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { sendSuccess } from '../../utils/ApiResponse.js';
import {
  createDonation,
  verifyDonation,
  rejectDonation,
  getMyDonationHistory,
  getDonations,
  getDonationById,
  getDonorDonationHistoryForAdmin,
} from './donation.service.js';

export const createDonationController = asyncHandler(
  async (req: Request, res: Response) => {
    const donation = await createDonation(req.body, req.user!);
    return sendSuccess(
      res,
      'Donation record created successfully',
      donation,
      httpStatus.CREATED,
    );
  },
);

export const verifyDonationController = asyncHandler(
  async (req: Request, res: Response) => {
    const donationId = Array.isArray(req.params.donationId)
      ? req.params.donationId[0]
      : req.params.donationId;
    const donation = await verifyDonation(
      donationId,
      req.user!,
      req.body,
    );
    return sendSuccess(
      res,
      'Donation verified and completed successfully. 90-day cooldown initiated.',
      donation,
      httpStatus.OK,
    );
  },
);

export const rejectDonationController = asyncHandler(
  async (req: Request, res: Response) => {
    const donationId = Array.isArray(req.params.donationId)
      ? req.params.donationId[0]
      : req.params.donationId;
    const donation = await rejectDonation(
      donationId,
      req.user!,
      req.body,
    );
    return sendSuccess(
      res,
      'Donation record rejected successfully',
      donation,
      httpStatus.OK,
    );
  },
);

export const getMyDonationHistoryController = asyncHandler(
  async (req: Request, res: Response) => {
    const result = await getMyDonationHistory(
      req.user!.id,
      req.query as unknown as Parameters<typeof getMyDonationHistory>[1],
    );
    return sendSuccess(
      res,
      'Donation history retrieved successfully',
      result,
      httpStatus.OK,
    );
  },
);

export const getDonationsController = asyncHandler(
  async (req: Request, res: Response) => {
    const result = await getDonations(
      req.query as unknown as Parameters<typeof getDonations>[0],
      req.user!,
    );
    return sendSuccess(
      res,
      'Donations retrieved successfully',
      result.data,
      httpStatus.OK,
      result.meta,
    );
  },
);

export const getDonationByIdController = asyncHandler(
  async (req: Request, res: Response) => {
    const donationId = Array.isArray(req.params.donationId)
      ? req.params.donationId[0]
      : req.params.donationId;
    const donation = await getDonationById(
      donationId,
      req.user!,
    );
    return sendSuccess(
      res,
      'Donation details retrieved successfully',
      donation,
      httpStatus.OK,
    );
  },
);

export const getDonorDonationHistoryForAdminController = asyncHandler(
  async (req: Request, res: Response) => {
    const donorId = Array.isArray(req.params.donorId)
      ? req.params.donorId[0]
      : req.params.donorId;
    const result = await getDonorDonationHistoryForAdmin(
      donorId,
      req.query as unknown as Parameters<typeof getDonorDonationHistoryForAdmin>[1],
      req.user!.role,
    );
    return sendSuccess(
      res,
      'Donor donation history retrieved successfully',
      result,
      httpStatus.OK,
    );
  },
);
