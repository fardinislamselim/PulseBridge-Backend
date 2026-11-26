import { prisma } from '../../config/database.js';
import { redisClient } from '../../config/redis.js';
import { RequestStatus, AssignmentStatus, NotificationType } from '../../generated/prisma/enums.js';
import { TERMINAL_STATUSES } from './request.constant.js';
import { validateBloodRequestTransition } from './request.utils.js';
import { createNotification } from '../../services/notification.service.js';
import { sendBloodRequestStatusEmail } from '../../services/email.service.js';
import { logAuditEvent } from '../../services/audit.service.js';
import type { Prisma } from '../../generated/prisma/client.js';

let expirationIntervalTimer: NodeJS.Timeout | null = null;

export interface ExpirationResult {
  processedCount: number;
  expiredIds: string[];
}

/**
 * Expire an individual overdue blood request safely within a database transaction.
 */
export const expireOverdueRequest = async (
  requestId: string,
  actorId?: string,
  reason?: string
) => {
  const expirationReason =
    reason || 'Request exceeded the required date/time without complete fulfillment.';

  // 1. Transactional status change, assignment release, and history creation
  const result = await prisma.$transaction(async (tx) => {
    const existing = await tx.bloodRequest.findUnique({
      where: { id: requestId },
      include: {
        requester: true,
        assignments: {
          where: {
            status: { in: [AssignmentStatus.PENDING, AssignmentStatus.ACCEPTED] },
          },
          include: {
            donorProfile: {
              include: { user: true },
            },
          },
        },
      },
    });

    if (!existing) {
      throw new Error(`Blood request not found: ${requestId}`);
    }

    if (TERMINAL_STATUSES.includes(existing.status)) {
      throw new Error(`Cannot expire request in terminal status '${existing.status}'`);
    }

    // Verify request is actually overdue
    if (new Date(existing.requiredAt) > new Date()) {
      throw new Error(`Cannot expire request that is not yet overdue (neededAt: ${existing.requiredAt})`);
    }

    // Validate lifecycle transition
    validateBloodRequestTransition(existing.status, RequestStatus.EXPIRED);

    const now = new Date();

    // Update request to EXPIRED
    const updated = await tx.bloodRequest.update({
      where: { id: requestId },
      data: {
        status: RequestStatus.EXPIRED,
        expiredAt: now,
      },
    });

    // Release all active donor assignments
    await tx.donorAssignment.updateMany({
      where: {
        requestId,
        status: { in: [AssignmentStatus.PENDING, AssignmentStatus.ACCEPTED] },
      },
      data: {
        status: AssignmentStatus.CANCELLED,
        notes: 'Assignment released due to blood request expiration',
      },
    });

    // Record immutable history log
    await tx.bloodRequestHistory.create({
      data: {
        bloodRequestId: requestId,
        actorId: actorId ?? null,
        action: 'EXPIRED',
        previousStatus: existing.status,
        newStatus: RequestStatus.EXPIRED,
        previousUrgency: existing.urgency,
        newUrgency: existing.urgency,
        reason: expirationReason,
        metadata: {
          expiredAt: now.toISOString(),
          activeAssignmentsReleased: existing.assignments.length,
          actorType: actorId ? 'ADMIN' : 'SYSTEM_EXPIRATION_JOB',
        } as Prisma.InputJsonValue,
      },
    });

    // Audit log
    await logAuditEvent({
      actorId: actorId ?? null,
      action: 'BLOOD_REQUEST_EXPIRED',
      entity: 'BloodRequest',
      entityId: requestId,
      metadata: {
        previousStatus: existing.status,
        newStatus: RequestStatus.EXPIRED,
        reason: expirationReason,
        releasedAssignmentsCount: existing.assignments.length,
      },
    });

    return {
      updated,
      requester: existing.requester,
      releasedAssignments: existing.assignments,
    };
  });

  // 2. Notifications & Emails outside the transaction
  try {
    // Notify requester
    await createNotification({
      userId: result.requester.id,
      type: NotificationType.REQUEST,
      title: 'Blood Request Expired',
      message: `Your blood request for ${result.updated.patientName} has expired as it passed the deadline (${new Date(
        result.updated.requiredAt
      ).toLocaleString()}).`,
      metadata: { requestId: result.updated.id, status: RequestStatus.EXPIRED },
    });

    void sendBloodRequestStatusEmail(result.requester.email, {
      recipientName: result.requester.name,
      patientName: result.updated.patientName,
      bloodGroup: result.updated.bloodGroup,
      units: result.updated.unitsRequired,
      hospitalName: result.updated.hospitalName,
      status: 'EXPIRED',
      reason: expirationReason,
    });

    // Notify affected assigned donors
    for (const assignment of result.releasedAssignments) {
      if (assignment.donorProfile?.user) {
        await createNotification({
          userId: assignment.donorProfile.user.id,
          type: NotificationType.ASSIGNMENT,
          title: 'Donation Request Expired',
          message: `The blood donation request for ${result.updated.patientName} has expired. Your assignment has been safely released.`,
          metadata: { requestId: result.updated.id, assignmentId: assignment.id },
        });
      }
    }
  } catch (notifyErr) {
    console.error(`[Expiration] Failed to send expiration notifications for request ${requestId}:`, notifyErr);
  }

  return result.updated;
};

/**
 * Periodically processes all overdue active blood requests.
 * Uses a distributed Redis lock to prevent multiple instances from overlapping.
 */
export const processOverdueBloodRequests = async (): Promise<ExpirationResult> => {
  const lockKey = 'lock:blood-request-expiration';
  let lockAcquired = false;

  try {
    if (redisClient.isOpen) {
      const lockRes = await redisClient.set(lockKey, '1', {
        NX: true,
        EX: 55, // 55 seconds TTL
      });
      lockAcquired = lockRes === 'OK';
      if (!lockAcquired) {
        // Another instance is already processing overdue requests
        return { processedCount: 0, expiredIds: [] };
      }
    }

    const now = new Date();

    // Find all overdue eligible requests
    const overdueRequests = await prisma.bloodRequest.findMany({
      where: {
        status: {
          in: [
            RequestStatus.PENDING,
            RequestStatus.APPROVED,
            RequestStatus.MATCHING,
            RequestStatus.IN_PROGRESS,
            RequestStatus.PARTIALLY_FULFILLED,
          ],
        },
        requiredAt: { lte: now },
      },
      select: { id: true },
    });

    const expiredIds: string[] = [];

    for (const req of overdueRequests) {
      try {
        await expireOverdueRequest(
          req.id,
          undefined,
          'Automatic system expiration: Request exceeded required deadline without complete fulfillment'
        );
        expiredIds.push(req.id);
      } catch (err) {
        console.error(`[Expiration] Failed to expire request ${req.id}:`, err);
      }
    }

    if (expiredIds.length > 0) {
      console.log(`[Expiration] Successfully expired ${expiredIds.length} overdue blood request(s).`);
    }

    return { processedCount: expiredIds.length, expiredIds };
  } finally {
    if (lockAcquired && redisClient.isOpen) {
      try {
        await redisClient.del(lockKey);
      } catch {
        // ignore lock release error
      }
    }
  }
};

/**
 * Starts the periodic background cron for expiring overdue blood requests.
 */
export const startBloodRequestExpirationCron = (intervalMs = 60000): void => {
  if (process.env.VERCEL === '1') {
    return;
  }
  if (expirationIntervalTimer) {
    clearInterval(expirationIntervalTimer);
  }
  // Run once shortly after startup
  setTimeout(() => void processOverdueBloodRequests(), 5000);

  expirationIntervalTimer = setInterval(() => {
    void processOverdueBloodRequests();
  }, intervalMs);

  console.log(`[Expiration] Background expiration service started (interval: ${intervalMs}ms).`);
};

/**
 * Stops the periodic background cron for clean shutdown.
 */
export const stopBloodRequestExpirationCron = (): void => {
  if (expirationIntervalTimer) {
    clearInterval(expirationIntervalTimer);
    expirationIntervalTimer = null;
    console.log('[Expiration] Background expiration service stopped.');
  }
};
