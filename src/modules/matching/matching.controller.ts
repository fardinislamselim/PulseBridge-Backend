import type { Request, Response } from 'express';
import httpStatus from 'http-status';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { sendSuccess } from '../../utils/ApiResponse.js';
import { evaluateCompatibility, findEligibleDonors } from './matching.service.js';
import type { BloodGroup } from '../../generated/prisma/enums.js';
import type { FindDonorsQueryDTO } from './matching.interface.js';

export const getCompatibilityController = asyncHandler(
  async (req: Request, res: Response) => {
    const { donorBloodGroup, recipientBloodGroup } = req.query as {
      donorBloodGroup?: BloodGroup;
      recipientBloodGroup?: BloodGroup;
    };

    const result = evaluateCompatibility(donorBloodGroup, recipientBloodGroup);

    let message = 'Blood compatibility evaluated successfully';
    if (donorBloodGroup && !recipientBloodGroup) {
      message = 'Compatible recipient blood groups retrieved successfully';
    } else if (!donorBloodGroup && recipientBloodGroup) {
      message = 'Compatible donor blood groups retrieved successfully';
    }

    return sendSuccess(res, message, result, httpStatus.OK);
  }
);

export const findEligibleDonorsController = asyncHandler(
  async (req: Request, res: Response) => {
    const query = {
      ...req.query,
      ...(req.params.requestId ? { requestId: req.params.requestId } : {}),
    } as unknown as FindDonorsQueryDTO;

    const result = await findEligibleDonors(query, req.user);

    return sendSuccess(
      res,
      'Compatible and eligible donors retrieved successfully',
      result,
      httpStatus.OK
    );
  }
);
