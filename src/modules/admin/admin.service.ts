import { prisma } from '../../config/database.js';
import {
  UserRole,
  UserStatus,
  RequestStatus,
  RequestUrgency,
  AssignmentStatus,
  DonationStatus,
  PaymentStatus,
} from '../../generated/prisma/enums.js';
import type { Prisma } from '../../generated/prisma/client.js';
import type {
  DashboardStats,
  DashboardOverviewDTO,
  RecentActivitiesResponseDTO,
  PlatformActivityItem,
  GetAuditLogsQueryDTO,
} from './admin.interface.js';
import type { PaginatedResult } from '../users/user.interface.js';
import { getCache, setCache } from '../../infrastructure/cache/cache.service.js';
import { isDonationCooldownActive } from '../donors/donor.utils.js';

const DASHBOARD_OVERVIEW_CACHE_KEY = 'pulsebridge:v1:admin:dashboard:overview';
const DASHBOARD_CACHE_TTL = 300; // 5 minutes

/**
 * Computes the complete administrative dashboard overview with multi-domain aggregations.
 */
export const getAdminDashboardOverview = async (
  forceRefresh: boolean = false
): Promise<DashboardOverviewDTO> => {
  if (!forceRefresh) {
    const cached = await getCache<DashboardOverviewDTO>(DASHBOARD_OVERVIEW_CACHE_KEY);
    if (cached) return cached;
  }

  const now = new Date();
  const startOfToday = new Date(now);
  startOfToday.setUTCHours(0, 0, 0, 0);

  const startOfMonth = new Date(now.getUTCFullYear(), now.getUTCMonth(), 1);

  // Parallel database aggregations across entities
  const [
    // Users
    totalUsers,
    donorUsers,
    requesterUsers,
    adminUsers,
    superAdminUsers,
    activeUsers,
    blockedUsers,
    verifiedUsers,
    unverifiedUsers,
    newUsersToday,
    newUsersThisMonth,

    // Donors
    totalDonors,
    availableDonors,
    unavailableDonors,
    verifiedDonors,
    unverifiedDonors,
    donorProfilesList,

    // Blood Requests
    totalRequests,
    pendingRequests,
    approvedRequests,
    matchingRequests,
    inProgressRequests,
    partiallyFulfilledRequests,
    fulfilledRequests,
    cancelledRequests,
    rejectedRequests,
    expiredRequests,
    emergencyRequests,
    urgentRequests,
    normalRequests,

    // Assignments
    totalAssignments,
    pendingAssignments,
    acceptedAssignments,
    rejectedAssignments,
    cancelledAssignments,
    completedAssignments,

    // Donations
    totalDonations,
    completedDonations,
    pendingDonations,
    rejectedDonations,
    donatedUnitsAgg,

    // Payments
    totalPayments,
    successfulPayments,
    pendingPayments,
    failedPayments,
    refundedPayments,
    paymentsByCurrency,

    // Notifications
    totalNotifications,
    unreadNotifications,
    notificationsByType,

    // Emergency stats
    activeEmergencyRequests,
    fulfilledEmergencyRequests,
  ] = await Promise.all([
    // User metrics
    prisma.user.count(),
    prisma.user.count({ where: { role: UserRole.DONOR } }),
    prisma.user.count({ where: { role: UserRole.REQUESTER } }),
    prisma.user.count({ where: { role: UserRole.ADMIN } }),
    prisma.user.count({ where: { role: UserRole.SUPER_ADMIN } }),
    prisma.user.count({ where: { status: UserStatus.ACTIVE } }),
    prisma.user.count({ where: { status: UserStatus.BLOCKED } }),
    prisma.user.count({ where: { emailVerified: true } }),
    prisma.user.count({ where: { emailVerified: false } }),
    prisma.user.count({ where: { createdAt: { gte: startOfToday } } }),
    prisma.user.count({ where: { createdAt: { gte: startOfMonth } } }),

    // Donor Profile metrics
    prisma.donorProfile.count(),
    prisma.donorProfile.count({ where: { isAvailable: true } }),
    prisma.donorProfile.count({ where: { isAvailable: false } }),
    prisma.donorProfile.count({ where: { isVerified: true } }),
    prisma.donorProfile.count({ where: { isVerified: false } }),
    prisma.donorProfile.findMany({
      select: {
        isAvailable: true,
        isVerified: true,
        hasMedicalRestriction: true,
        lastDonationDate: true,
        eligibleAt: true,
      },
    }),

    // Blood Request status breakdown
    prisma.bloodRequest.count(),
    prisma.bloodRequest.count({ where: { status: RequestStatus.PENDING } }),
    prisma.bloodRequest.count({ where: { status: RequestStatus.APPROVED } }),
    prisma.bloodRequest.count({ where: { status: RequestStatus.MATCHING } }),
    prisma.bloodRequest.count({ where: { status: RequestStatus.IN_PROGRESS } }),
    prisma.bloodRequest.count({ where: { status: RequestStatus.PARTIALLY_FULFILLED } }),
    prisma.bloodRequest.count({ where: { status: RequestStatus.FULFILLED } }),
    prisma.bloodRequest.count({ where: { status: RequestStatus.CANCELLED } }),
    prisma.bloodRequest.count({ where: { status: RequestStatus.REJECTED } }),
    prisma.bloodRequest.count({ where: { status: RequestStatus.EXPIRED } }),
    prisma.bloodRequest.count({ where: { urgency: RequestUrgency.EMERGENCY } }),
    prisma.bloodRequest.count({ where: { urgency: RequestUrgency.URGENT } }),
    prisma.bloodRequest.count({ where: { urgency: RequestUrgency.NORMAL } }),

    // Assignment status breakdown
    prisma.donorAssignment.count(),
    prisma.donorAssignment.count({ where: { status: AssignmentStatus.PENDING } }),
    prisma.donorAssignment.count({ where: { status: AssignmentStatus.ACCEPTED } }),
    prisma.donorAssignment.count({ where: { status: AssignmentStatus.REJECTED } }),
    prisma.donorAssignment.count({ where: { status: AssignmentStatus.CANCELLED } }),
    prisma.donorAssignment.count({ where: { status: AssignmentStatus.COMPLETED } }),

    // Donation metrics
    prisma.donation.count(),
    prisma.donation.count({ where: { status: DonationStatus.COMPLETED } }),
    prisma.donation.count({ where: { status: DonationStatus.PENDING } }),
    prisma.donation.count({ where: { status: DonationStatus.REJECTED } }),
    prisma.donation.aggregate({
      _sum: { unitsDonated: true },
      where: { status: DonationStatus.COMPLETED },
    }),

    // Payment metrics
    prisma.payment.count(),
    prisma.payment.count({
      where: { status: { in: [PaymentStatus.SUCCESS, PaymentStatus.PAID] } },
    }),
    prisma.payment.count({ where: { status: PaymentStatus.PENDING } }),
    prisma.payment.count({ where: { status: PaymentStatus.FAILED } }),
    prisma.payment.count({
      where: { status: { in: [PaymentStatus.REFUNDED, PaymentStatus.PARTIALLY_REFUNDED] } },
    }),
    prisma.payment.findMany({
      select: {
        amount: true,
        refundAmount: true,
        currency: true,
        status: true,
      },
    }),

    // Notification metrics
    prisma.notification.count(),
    prisma.notification.count({ where: { status: 'UNREAD' } }),
    prisma.notification.groupBy({
      by: ['type'],
      _count: { id: true },
    }),

    // Emergency blood request counts
    prisma.bloodRequest.count({
      where: {
        urgency: RequestUrgency.EMERGENCY,
        status: { in: [RequestStatus.APPROVED, RequestStatus.MATCHING, RequestStatus.IN_PROGRESS] },
      },
    }),
    prisma.bloodRequest.count({
      where: {
        urgency: RequestUrgency.EMERGENCY,
        status: RequestStatus.FULFILLED,
      },
    }),
  ]);

  // Compute eligibility accurately from donor profiles
  let eligibleCount = 0;
  let temporarilyIneligibleCount = 0;

  for (const donor of donorProfilesList) {
    const onCooldown = isDonationCooldownActive(donor.lastDonationDate, now);
    const hasRestriction = donor.hasMedicalRestriction;
    const isEligibleDate = donor.eligibleAt ? now >= donor.eligibleAt : true;

    if (!hasRestriction && !onCooldown && isEligibleDate) {
      eligibleCount++;
    } else {
      temporarilyIneligibleCount++;
    }
  }

  // Calculate currency breakdown safely
  const currencyMap = new Map<string, { total: number; refunded: number }>();
  let totalSuccessfulAmount = 0;
  let totalRefundedAmount = 0;

  for (const p of paymentsByCurrency) {
    const curr = p.currency || 'BDT';
    if (!currencyMap.has(curr)) {
      currencyMap.set(curr, { total: 0, refunded: 0 });
    }
    const entry = currencyMap.get(curr)!;
    const isSuccess = p.status === PaymentStatus.SUCCESS || p.status === PaymentStatus.PAID;

    if (isSuccess) {
      const amt = Number(p.amount) || 0;
      entry.total += amt;
      totalSuccessfulAmount += amt;
    }

    if (p.refundAmount) {
      const refAmt = Number(p.refundAmount) || 0;
      entry.refunded += refAmt;
      totalRefundedAmount += refAmt;
    }
  }

  const currencies = Array.from(currencyMap.entries()).map(([currency, data]) => ({
    currency,
    totalAmount: Number(data.total.toFixed(2)),
    refundedAmount: Number(data.refunded.toFixed(2)),
    netAmount: Number((data.total - data.refunded).toFixed(2)),
  }));

  const notificationTypeMap: Record<string, number> = {};
  for (const n of notificationsByType) {
    notificationTypeMap[n.type] = n._count.id;
  }

  const unfulfilledEmergencyRequests = emergencyRequests - fulfilledEmergencyRequests;

  const overview: DashboardOverviewDTO = {
    users: {
      total: totalUsers,
      donors: donorUsers,
      requesters: requesterUsers,
      admins: adminUsers,
      superAdmins: superAdminUsers,
      active: activeUsers,
      blocked: blockedUsers,
      verified: verifiedUsers,
      unverified: unverifiedUsers,
      newToday: newUsersToday,
      newThisMonth: newUsersThisMonth,
    },
    donors: {
      total: totalDonors,
      available: availableDonors,
      unavailable: unavailableDonors,
      eligible: eligibleCount,
      temporarilyIneligible: temporarilyIneligibleCount,
      verified: verifiedDonors,
      unverified: unverifiedDonors,
    },
    bloodRequests: {
      total: totalRequests,
      pending: pendingRequests,
      approved: approvedRequests,
      matching: matchingRequests,
      inProgress: inProgressRequests,
      partiallyFulfilled: partiallyFulfilledRequests,
      fulfilled: fulfilledRequests,
      cancelled: cancelledRequests,
      rejected: rejectedRequests,
      expired: expiredRequests,
      emergency: emergencyRequests,
      urgent: urgentRequests,
      normal: normalRequests,
    },
    assignments: {
      total: totalAssignments,
      pending: pendingAssignments,
      accepted: acceptedAssignments,
      rejected: rejectedAssignments,
      cancelled: cancelledAssignments,
      completed: completedAssignments,
    },
    donations: {
      total: totalDonations,
      completed: completedDonations,
      pending: pendingDonations,
      rejected: rejectedDonations,
      totalUnitsDonated: donatedUnitsAgg._sum.unitsDonated || 0,
    },
    payments: {
      totalTransactions: totalPayments,
      successful: successfulPayments,
      pending: pendingPayments,
      failed: failedPayments,
      refunded: refundedPayments,
      totalSuccessfulAmount: Number(totalSuccessfulAmount.toFixed(2)),
      totalRefundedAmount: Number(totalRefundedAmount.toFixed(2)),
      netCollectedAmount: Number((totalSuccessfulAmount - totalRefundedAmount).toFixed(2)),
      currencies,
    },
    notifications: {
      total: totalNotifications,
      sent: totalNotifications,
      read: totalNotifications - unreadNotifications,
      unread: unreadNotifications,
      byType: notificationTypeMap,
    },
    emergency: {
      activeRequests: activeEmergencyRequests,
      fulfilledRequests: fulfilledEmergencyRequests,
      unfulfilledRequests: Math.max(0, unfulfilledEmergencyRequests),
    },
  };

  void setCache(DASHBOARD_OVERVIEW_CACHE_KEY, overview, DASHBOARD_CACHE_TTL);
  return overview;
};

/**
 * Backward-compatible admin dashboard stats method.
 */
export const getAdminDashboard = async (forceRefresh: boolean = false): Promise<DashboardStats> => {
  const [overview, recentAuditLogs] = await Promise.all([
    getAdminDashboardOverview(forceRefresh),
    prisma.auditLog.findMany({
      take: 5,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        action: true,
        entity: true,
        createdAt: true,
        actor: {
          select: {
            name: true,
            email: true,
          },
        },
      },
    }),
  ]);

  return {
    users: {
      total: overview.users.total,
      active: overview.users.active,
      blocked: overview.users.blocked,
      deleted: overview.users.total - overview.users.active - overview.users.blocked,
      donors: overview.users.donors,
      admins: overview.users.admins + overview.users.superAdmins,
      requesters: overview.users.requesters,
    },
    bloodRequests: {
      total: overview.bloodRequests.total,
      pending: overview.bloodRequests.pending,
      approved: overview.bloodRequests.approved,
      fulfilled: overview.bloodRequests.fulfilled,
      matching: overview.bloodRequests.matching,
      inProgress: overview.bloodRequests.inProgress,
      partiallyFulfilled: overview.bloodRequests.partiallyFulfilled,
      cancelled: overview.bloodRequests.cancelled,
      expired: overview.bloodRequests.expired,
      rejected: overview.bloodRequests.rejected,
    },
    donations: {
      total: overview.donations.total,
      completed: overview.donations.completed,
      pending: overview.donations.pending,
    },
    recentAuditLogs,
    overview,
  };
};

/**
 * Retrieves chronological recent platform activity from audit logs and domain events.
 */
export const getRecentActivities = async (query: {
  page?: number;
  limit?: number;
  type?: string;
  startDate?: string;
  endDate?: string;
}): Promise<RecentActivitiesResponseDTO> => {
  const page = Math.max(1, Number(query.page) || 1);
  const limit = Math.max(1, Math.min(100, Number(query.limit) || 20));
  const skip = (page - 1) * limit;

  const where: Prisma.AuditLogWhereInput = {};

  if (query.type && query.type.trim()) {
    where.entity = { contains: query.type.trim(), mode: 'insensitive' };
  }

  if (query.startDate || query.endDate) {
    where.createdAt = {};
    if (query.startDate) where.createdAt.gte = new Date(query.startDate);
    if (query.endDate) where.createdAt.lte = new Date(query.endDate);
  }

  const [total, logs] = await Promise.all([
    prisma.auditLog.count({ where }),
    prisma.auditLog.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        actor: {
          select: {
            id: true,
            name: true,
            role: true,
          },
        },
      },
    }),
  ]);

  const activities: PlatformActivityItem[] = logs.map((log) => ({
    id: log.id,
    type: log.action || 'SYSTEM_ACTION',
    title: `${log.entity.toUpperCase()} ${log.action.replace(/_/g, ' ').toLowerCase()}`,
    description: `Action on ${log.entity} performed by ${log.actor ? log.actor.name : 'System'}`,
    actor: log.actor
      ? {
          id: log.actor.id,
          displayName: log.actor.name,
        }
      : null,
    resource: {
      type: log.entity,
      id: log.entityId || log.id,
    },
    createdAt: log.createdAt,
  }));

  return {
    activities,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit) || 1,
    },
  };
};

/**
 * Standard paginated audit logs retrieval.
 */
export const getAuditLogs = async (
  query: GetAuditLogsQueryDTO
): Promise<PaginatedResult<unknown>> => {
  const page = Math.max(1, Number(query.page) || 1);
  const limit = Math.max(1, Math.min(100, Number(query.limit) || 10));
  const skip = (page - 1) * limit;

  const where: Prisma.AuditLogWhereInput = {};

  if (query.action && query.action.trim()) {
    where.action = { contains: query.action.trim(), mode: 'insensitive' };
  }

  if (query.entity && query.entity.trim()) {
    where.entity = { contains: query.entity.trim(), mode: 'insensitive' };
  }

  if (query.actorId && query.actorId.trim()) {
    where.actorId = query.actorId.trim();
  }

  const [total, logs] = await Promise.all([
    prisma.auditLog.count({ where }),
    prisma.auditLog.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        actor: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
          },
        },
      },
    }),
  ]);

  return {
    data: logs,
    meta: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit) || 1,
    },
  };
};
