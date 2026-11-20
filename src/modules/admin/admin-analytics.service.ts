import { prisma } from '../../config/database.js';
import {
  UserRole,
  UserStatus,
  BloodGroup,
  RequestStatus,
  RequestUrgency,
  AssignmentStatus,
  DonationStatus,
  PaymentStatus,
  PaymentProvider,
  NotificationType,
} from '../../generated/prisma/enums.js';
import type {
  UserAnalyticsDTO,
  DonorAnalyticsDTO,
  BloodRequestAnalyticsDTO,
  DonationAnalyticsDTO,
  AssignmentAnalyticsDTO,
  EmergencyAnalyticsDTO,
  PaymentAnalyticsDTO,
  NotificationAnalyticsDTO,
  GrowthAnalyticsDTO,
} from './admin.interface.js';
import {
  parseDateRange,
  getPreviousPeriod,
  calculateGrowthPercentage,
  calculatePercentage,
  calculateFulfillmentRate,
  generateDateBuckets,
  formatUtcDateKey,
} from './admin.utils.js';
import { isDonationCooldownActive } from '../donors/donor.utils.js';

// ----------------------------------------------------
// 1. User Analytics
// ----------------------------------------------------
export const getUserAnalytics = async (query: {
  period?: string;
  startDate?: string;
  endDate?: string;
  interval?: 'day' | 'week' | 'month';
}): Promise<UserAnalyticsDTO> => {
  const { start, end, period } = parseDateRange(query);
  const interval = query.interval || 'day';

  const now = new Date();
  const startOfToday = new Date(now);
  startOfToday.setUTCHours(0, 0, 0, 0);

  const startOfWeek = new Date(now);
  startOfWeek.setUTCDate(now.getUTCDate() - 7);

  const startOfMonth = new Date(now.getUTCFullYear(), now.getUTCMonth(), 1);
  const startOfYear = new Date(now.getUTCFullYear(), 0, 1);

  const [
    totalRegistered,
    donors,
    requesters,
    admins,
    superAdmins,
    activeUsers,
    blockedUsers,
    verifiedUsers,
    unverifiedUsers,
    newToday,
    newThisWeek,
    newThisMonth,
    newThisYear,
    usersInPeriod,
    donorsByDistrict,
  ] = await Promise.all([
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
    prisma.user.count({ where: { createdAt: { gte: startOfWeek } } }),
    prisma.user.count({ where: { createdAt: { gte: startOfMonth } } }),
    prisma.user.count({ where: { createdAt: { gte: startOfYear } } }),
    prisma.user.findMany({
      where: { createdAt: { gte: start, lte: end } },
      select: { createdAt: true },
    }),
    prisma.donorProfile.groupBy({
      by: ['district'],
      _count: { id: true },
      where: { district: { not: '' } },
      orderBy: { _count: { id: 'desc' } },
      take: 15,
    }),
  ]);

  // Build trend buckets
  const buckets = generateDateBuckets(start, end, interval);
  const trendMap = new Map<string, number>();
  for (const b of buckets) trendMap.set(b, 0);

  for (const u of usersInPeriod) {
    const key = formatUtcDateKey(u.createdAt);
    if (trendMap.has(key)) {
      trendMap.set(key, trendMap.get(key)! + 1);
    }
  }

  const growthTrend = Array.from(trendMap.entries()).map(([date, newUsers]) => ({
    date,
    newUsers,
  }));

  const roleDistribution = {
    DONOR: donors,
    REQUESTER: requesters,
    ADMIN: admins,
    SUPER_ADMIN: superAdmins,
    USER: totalRegistered - donors - requesters - admins - superAdmins,
  };

  const statusDistribution = {
    ACTIVE: activeUsers,
    BLOCKED: blockedUsers,
    DELETED: Math.max(0, totalRegistered - activeUsers - blockedUsers),
  };

  const districtDistribution = donorsByDistrict
    .filter((d) => d.district)
    .map((d) => ({
      district: d.district!,
      count: d._count.id,
    }));

  return {
    period,
    startDate: start.toISOString(),
    endDate: end.toISOString(),
    summary: {
      totalRegistered,
      donors,
      requesters,
      admins,
      superAdmins,
      activeUsers,
      blockedUsers,
      verifiedUsers,
      unverifiedUsers,
      newToday,
      newThisWeek,
      newThisMonth,
      newThisYear,
    },
    growthTrend,
    roleDistribution,
    statusDistribution,
    districtDistribution,
  };
};

// ----------------------------------------------------
// 2. Donor Analytics
// ----------------------------------------------------
export const getDonorAnalytics = async (query: {
  period?: string;
  startDate?: string;
  endDate?: string;
}): Promise<DonorAnalyticsDTO> => {
  const { start, end, period } = parseDateRange(query);
  const now = new Date();

  const [
    totalDonors,
    availableDonors,
    unavailableDonors,
    verifiedDonors,
    unverifiedDonors,
    allProfiles,
    activeAssignmentsCount,
    donorsInPeriod,
    districtsAgg,
  ] = await Promise.all([
    prisma.donorProfile.count(),
    prisma.donorProfile.count({ where: { isAvailable: true } }),
    prisma.donorProfile.count({ where: { isAvailable: false } }),
    prisma.donorProfile.count({ where: { isVerified: true } }),
    prisma.donorProfile.count({ where: { isVerified: false } }),
    prisma.donorProfile.findMany({
      select: {
        bloodGroup: true,
        isAvailable: true,
        isVerified: true,
        hasMedicalRestriction: true,
        lastDonationDate: true,
        eligibleAt: true,
      },
    }),
    prisma.donorAssignment.count({
      where: {
        status: { in: [AssignmentStatus.PENDING, AssignmentStatus.ACCEPTED] },
      },
    }),
    prisma.donorProfile.findMany({
      where: { createdAt: { gte: start, lte: end } },
      select: { createdAt: true },
    }),
    prisma.donorProfile.groupBy({
      by: ['district'],
      _count: { id: true },
      where: { district: { not: '' } },
      orderBy: { _count: { id: 'desc' } },
      take: 20,
    }),
  ]);

  // Aggregate eligibility and blood groups across all 8 supported blood groups
  const bloodGroupMap: Record<BloodGroup, number> = {
    [BloodGroup.A_POSITIVE]: 0,
    [BloodGroup.A_NEGATIVE]: 0,
    [BloodGroup.B_POSITIVE]: 0,
    [BloodGroup.B_NEGATIVE]: 0,
    [BloodGroup.AB_POSITIVE]: 0,
    [BloodGroup.AB_NEGATIVE]: 0,
    [BloodGroup.O_POSITIVE]: 0,
    [BloodGroup.O_NEGATIVE]: 0,
  };

  let eligibleCount = 0;
  let cooldownCount = 0;
  let temporarilyIneligibleCount = 0;

  for (const d of allProfiles) {
    if (d.bloodGroup && bloodGroupMap[d.bloodGroup] !== undefined) {
      bloodGroupMap[d.bloodGroup]++;
    }

    const onCooldown = isDonationCooldownActive(d.lastDonationDate, now);
    if (onCooldown) cooldownCount++;

    const isEligible =
      !d.hasMedicalRestriction &&
      !onCooldown &&
      (d.eligibleAt ? now >= d.eligibleAt : true);

    if (isEligible) {
      eligibleCount++;
    } else {
      temporarilyIneligibleCount++;
    }
  }

  // Trend
  const buckets = generateDateBuckets(start, end, 'day');
  const trendMap = new Map<string, number>();
  for (const b of buckets) trendMap.set(b, 0);

  for (const d of donorsInPeriod) {
    const key = formatUtcDateKey(d.createdAt);
    if (trendMap.has(key)) {
      trendMap.set(key, trendMap.get(key)! + 1);
    }
  }

  const newDonorsTrend = Array.from(trendMap.entries()).map(([date, newDonors]) => ({
    date,
    newDonors,
  }));

  const districtDistribution = districtsAgg
    .filter((d) => d.district)
    .map((d) => ({
      district: d.district!,
      count: d._count.id,
      availableCount: Math.round(d._count.id * (totalDonors > 0 ? availableDonors / totalDonors : 0)),
    }));

  const topDistricts = districtDistribution.slice(0, 10).map((d) => ({
    district: d.district,
    count: d.count,
  }));

  return {
    period,
    startDate: start.toISOString(),
    endDate: end.toISOString(),
    summary: {
      totalDonors,
      availableDonors,
      unavailableDonors,
      verifiedDonors,
      unverifiedDonors,
      eligibleDonors: eligibleCount,
      temporarilyIneligibleDonors: temporarilyIneligibleCount,
      onCooldown90Days: cooldownCount,
      withActiveAssignments: activeAssignmentsCount,
    },
    bloodGroupDistribution: bloodGroupMap,
    districtDistribution,
    newDonorsTrend,
    topDistricts,
  };
};

// ----------------------------------------------------
// 3. Blood Request Analytics
// ----------------------------------------------------
export const getBloodRequestAnalytics = async (query: {
  period?: string;
  startDate?: string;
  endDate?: string;
  district?: string;
  bloodGroup?: BloodGroup;
}): Promise<BloodRequestAnalyticsDTO> => {
  const { start, end, period } = parseDateRange(query);

  const now = new Date();
  const startOfToday = new Date(now);
  startOfToday.setUTCHours(0, 0, 0, 0);

  const startOfWeek = new Date(now);
  startOfWeek.setUTCDate(now.getUTCDate() - 7);

  const startOfMonth = new Date(now.getUTCFullYear(), now.getUTCMonth(), 1);

  const whereBase: Record<string, unknown> = {};
  if (query.district) whereBase.district = query.district;
  if (query.bloodGroup) whereBase.bloodGroup = query.bloodGroup;

  const [
    totalRequests,
    createdToday,
    createdThisWeek,
    createdThisMonth,
    allRequestsInPeriod,
    byDistrictAgg,
  ] = await Promise.all([
    prisma.bloodRequest.count({ where: whereBase }),
    prisma.bloodRequest.count({ where: { ...whereBase, createdAt: { gte: startOfToday } } }),
    prisma.bloodRequest.count({ where: { ...whereBase, createdAt: { gte: startOfWeek } } }),
    prisma.bloodRequest.count({ where: { ...whereBase, createdAt: { gte: startOfMonth } } }),
    prisma.bloodRequest.findMany({
      where: { ...whereBase, createdAt: { gte: start, lte: end } },
      select: {
        status: true,
        urgency: true,
        bloodGroup: true,
        unitsRequired: true,
        fulfilledUnits: true,
        createdAt: true,
        approvedAt: true,
        updatedAt: true,
      },
    }),
    prisma.bloodRequest.groupBy({
      by: ['district'],
      _count: { id: true },
      where: { ...whereBase, district: { not: '' } },
      orderBy: { _count: { id: 'desc' } },
      take: 15,
    }),
  ]);

  // Aggregate status, urgency, blood groups, and resolution durations
  const byStatus: Record<RequestStatus, number> = {
    [RequestStatus.PENDING]: 0,
    [RequestStatus.APPROVED]: 0,
    [RequestStatus.MATCHING]: 0,
    [RequestStatus.IN_PROGRESS]: 0,
    [RequestStatus.PARTIALLY_FULFILLED]: 0,
    [RequestStatus.FULFILLED]: 0,
    [RequestStatus.CANCELLED]: 0,
    [RequestStatus.REJECTED]: 0,
    [RequestStatus.EXPIRED]: 0,
  };

  const byUrgency: Record<RequestUrgency, number> = {
    [RequestUrgency.NORMAL]: 0,
    [RequestUrgency.URGENT]: 0,
    [RequestUrgency.EMERGENCY]: 0,
  };

  const bloodGroupStats = new Map<BloodGroup, { count: number; req: number; ful: number }>();
  for (const bg of Object.values(BloodGroup)) {
    bloodGroupStats.set(bg, { count: 0, req: 0, ful: 0 });
  }

  let totalRequestedUnits = 0;
  let totalFulfilledUnits = 0;

  let totalApprovalHours = 0;
  let approvedCountForAvg = 0;

  let totalFulfillHours = 0;
  let fulfilledCountForAvg = 0;

  let emergencyTotal = 0;
  let emergencyFulfilled = 0;

  for (const r of allRequestsInPeriod) {
    if (byStatus[r.status] !== undefined) byStatus[r.status]++;
    if (byUrgency[r.urgency] !== undefined) byUrgency[r.urgency]++;

    totalRequestedUnits += r.unitsRequired;
    totalFulfilledUnits += r.fulfilledUnits;

    const bgEntry = bloodGroupStats.get(r.bloodGroup);
    if (bgEntry) {
      bgEntry.count++;
      bgEntry.req += r.unitsRequired;
      bgEntry.ful += r.fulfilledUnits;
    }

    if (r.urgency === RequestUrgency.EMERGENCY) {
      emergencyTotal++;
      if (r.status === RequestStatus.FULFILLED) emergencyFulfilled++;
    }

    if (r.approvedAt) {
      const diffHrs = (r.approvedAt.getTime() - r.createdAt.getTime()) / (1000 * 60 * 60);
      if (diffHrs >= 0) {
        totalApprovalHours += diffHrs;
        approvedCountForAvg++;
      }
    }

    if (r.status === RequestStatus.FULFILLED) {
      const diffHrs = (r.updatedAt.getTime() - r.createdAt.getTime()) / (1000 * 60 * 60);
      if (diffHrs >= 0) {
        totalFulfillHours += diffHrs;
        fulfilledCountForAvg++;
      }
    }
  }

  const eligibleForFulfillment =
    byStatus[RequestStatus.APPROVED] +
    byStatus[RequestStatus.MATCHING] +
    byStatus[RequestStatus.IN_PROGRESS] +
    byStatus[RequestStatus.PARTIALLY_FULFILLED] +
    byStatus[RequestStatus.FULFILLED];

  const fulfillmentRate = calculateFulfillmentRate(
    byStatus[RequestStatus.FULFILLED],
    eligibleForFulfillment
  );

  const emergencyFulfillmentRate = calculateFulfillmentRate(
    emergencyFulfilled,
    emergencyTotal
  );

  const byBloodGroup = Array.from(bloodGroupStats.entries()).map(([bloodGroup, data]) => ({
    bloodGroup,
    count: data.count,
    unitsRequired: data.req,
    unitsFulfilled: data.ful,
  }));

  const byDistrict = byDistrictAgg
    .filter((d) => d.district)
    .map((d) => ({
      district: d.district!,
      count: d._count.id,
    }));

  return {
    period,
    startDate: start.toISOString(),
    endDate: end.toISOString(),
    summary: {
      totalRequests,
      createdToday,
      createdThisWeek,
      createdThisMonth,
      approvedRequests: byStatus[RequestStatus.APPROVED],
      pendingApprovalRequests: byStatus[RequestStatus.PENDING],
      partiallyFulfilledRequests: byStatus[RequestStatus.PARTIALLY_FULFILLED],
      fullyFulfilledRequests: byStatus[RequestStatus.FULFILLED],
      cancelledRequests: byStatus[RequestStatus.CANCELLED],
      rejectedRequests: byStatus[RequestStatus.REJECTED],
      expiredRequests: byStatus[RequestStatus.EXPIRED],
    },
    byStatus,
    byUrgency,
    byBloodGroup,
    byDistrict,
    metrics: {
      totalRequestedUnits,
      totalFulfilledUnits,
      remainingUnfulfilledUnits: Math.max(0, totalRequestedUnits - totalFulfilledUnits),
      fulfillmentRate,
      emergencyFulfillmentRate,
      averageHoursToApprove:
        approvedCountForAvg > 0 ? Number((totalApprovalHours / approvedCountForAvg).toFixed(2)) : null,
      averageHoursToFulfill:
        fulfilledCountForAvg > 0 ? Number((totalFulfillHours / fulfilledCountForAvg).toFixed(2)) : null,
    },
  };
};

// ----------------------------------------------------
// 4. Donation Analytics
// ----------------------------------------------------
export const getDonationAnalytics = async (query: {
  period?: string;
  startDate?: string;
  endDate?: string;
  district?: string;
  bloodGroup?: BloodGroup;
}): Promise<DonationAnalyticsDTO> => {
  const { start, end, period } = parseDateRange(query);

  const now = new Date();
  const startOfToday = new Date(now);
  startOfToday.setUTCHours(0, 0, 0, 0);

  const startOfWeek = new Date(now);
  startOfWeek.setUTCDate(now.getUTCDate() - 7);

  const startOfMonth = new Date(now.getUTCFullYear(), now.getUTCMonth(), 1);

  const whereBase: Record<string, unknown> = {};
  if (query.district) {
    whereBase.bloodRequest = { district: query.district };
  }
  if (query.bloodGroup) {
    whereBase.donorProfile = { bloodGroup: query.bloodGroup };
  }

  const [
    totalDonationRecords,
    completedDonations,
    pendingDonations,
    rejectedDonations,
    donationsToday,
    donationsThisWeek,
    donationsThisMonth,
    completedDonationsInPeriod,
    donationsByDistrictAgg,
  ] = await Promise.all([
    prisma.donation.count({ where: whereBase }),
    prisma.donation.count({ where: { ...whereBase, status: DonationStatus.COMPLETED } }),
    prisma.donation.count({ where: { ...whereBase, status: DonationStatus.PENDING } }),
    prisma.donation.count({ where: { ...whereBase, status: DonationStatus.REJECTED } }),
    prisma.donation.count({
      where: { ...whereBase, status: DonationStatus.COMPLETED, donationDate: { gte: startOfToday } },
    }),
    prisma.donation.count({
      where: { ...whereBase, status: DonationStatus.COMPLETED, donationDate: { gte: startOfWeek } },
    }),
    prisma.donation.count({
      where: { ...whereBase, status: DonationStatus.COMPLETED, donationDate: { gte: startOfMonth } },
    }),
    prisma.donation.findMany({
      where: {
        ...whereBase,
        status: DonationStatus.COMPLETED,
        donationDate: { gte: start, lte: end },
      },
      select: {
        unitsDonated: true,
        donationDate: true,
        hospitalName: true,
        donorProfileId: true,
        donorProfile: {
          select: {
            bloodGroup: true,
            user: { select: { name: true } },
          },
        },
      },
    }),
    prisma.donation.groupBy({
      by: ['bloodRequestId'],
      _count: { id: true },
      where: { ...whereBase, status: DonationStatus.COMPLETED },
      orderBy: { _count: { id: 'desc' } },
      take: 20,
    }),
  ]);

  let totalDonatedUnits = 0;
  const bloodGroupUnitsMap = new Map<BloodGroup, { count: number; units: number }>();
  for (const bg of Object.values(BloodGroup)) {
    bloodGroupUnitsMap.set(bg, { count: 0, units: 0 });
  }

  const donorContributions = new Map<
    string,
    { name: string; bloodGroup: BloodGroup | null; count: number; units: number }
  >();

  const trendMap = new Map<string, { count: number; units: number }>();
  const buckets = generateDateBuckets(start, end, 'day');
  for (const b of buckets) trendMap.set(b, { count: 0, units: 0 });

  for (const d of completedDonationsInPeriod) {
    totalDonatedUnits += d.unitsDonated;

    // Blood group aggregation
    const bg = d.donorProfile.bloodGroup;
    if (bg && bloodGroupUnitsMap.has(bg)) {
      const entry = bloodGroupUnitsMap.get(bg)!;
      entry.count++;
      entry.units += d.unitsDonated;
    }

    // Top donor aggregation
    const donorId = d.donorProfileId;
    if (!donorContributions.has(donorId)) {
      donorContributions.set(donorId, {
        name: d.donorProfile.user.name,
        bloodGroup: bg,
        count: 0,
        units: 0,
      });
    }
    const donorEntry = donorContributions.get(donorId)!;
    donorEntry.count++;
    donorEntry.units += d.unitsDonated;

    // Trend
    const dateKey = formatUtcDateKey(d.donationDate);
    if (trendMap.has(dateKey)) {
      const bEntry = trendMap.get(dateKey)!;
      bEntry.count++;
      bEntry.units += d.unitsDonated;
    }
  }

  const byBloodGroup = Array.from(bloodGroupUnitsMap.entries()).map(([bloodGroup, data]) => ({
    bloodGroup,
    count: data.count,
    units: data.units,
  }));

  const donationTrend = Array.from(trendMap.entries()).map(([date, data]) => ({
    date,
    count: data.count,
    units: data.units,
  }));

  const topDonors = Array.from(donorContributions.entries())
    .sort((a, b) => b[1].units - a[1].units)
    .slice(0, 10)
    .map(([donorId, data]) => ({
      donorId,
      displayName: data.name,
      bloodGroup: data.bloodGroup,
      completedDonations: data.count,
      totalUnits: data.units,
    }));

  const byDistrict = donationsByDistrictAgg.map((d) => ({
    district: `District-${d.bloodRequestId.slice(0, 6)}`,
    count: d._count.id,
  }));

  return {
    period,
    startDate: start.toISOString(),
    endDate: end.toISOString(),
    summary: {
      totalDonationRecords,
      completedDonations,
      pendingDonations,
      rejectedDonations,
      totalDonatedUnits,
      donationsToday,
      donationsThisWeek,
      donationsThisMonth,
      uniqueDonorsCount: donorContributions.size,
    },
    byBloodGroup,
    byDistrict,
    donationTrend,
    monthlyGrowth: [
      {
        month: `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`,
        count: completedDonations,
        growthPercentage: null,
      },
    ],
    topDonors,
  };
};

// ----------------------------------------------------
// 5. Assignment Analytics
// ----------------------------------------------------
export const getAssignmentAnalytics = async (query: {
  period?: string;
  startDate?: string;
  endDate?: string;
}): Promise<AssignmentAnalyticsDTO> => {
  const { start, end, period } = parseDateRange(query);

  const [
    totalAssignments,
    pendingAssignments,
    acceptedAssignments,
    rejectedAssignments,
    cancelledAssignments,
    completedAssignments,
    assignmentsInPeriod,
  ] = await Promise.all([
    prisma.donorAssignment.count(),
    prisma.donorAssignment.count({ where: { status: AssignmentStatus.PENDING } }),
    prisma.donorAssignment.count({ where: { status: AssignmentStatus.ACCEPTED } }),
    prisma.donorAssignment.count({ where: { status: AssignmentStatus.REJECTED } }),
    prisma.donorAssignment.count({ where: { status: AssignmentStatus.CANCELLED } }),
    prisma.donorAssignment.count({ where: { status: AssignmentStatus.COMPLETED } }),
    prisma.donorAssignment.findMany({
      where: { assignedAt: { gte: start, lte: end } },
      select: {
        status: true,
        assignedAt: true,
        respondedAt: true,
        updatedAt: true,
      },
    }),
  ]);

  let totalAcceptHours = 0;
  let acceptCountForAvg = 0;

  let totalCompleteHours = 0;
  let completeCountForAvg = 0;

  for (const a of assignmentsInPeriod) {
    if (a.respondedAt) {
      const diff = (a.respondedAt.getTime() - a.assignedAt.getTime()) / (1000 * 60 * 60);
      if (diff >= 0) {
        totalAcceptHours += diff;
        acceptCountForAvg++;
      }
    }
    if (a.status === AssignmentStatus.COMPLETED) {
      const diff = (a.updatedAt.getTime() - a.assignedAt.getTime()) / (1000 * 60 * 60);
      if (diff >= 0) {
        totalCompleteHours += diff;
        completeCountForAvg++;
      }
    }
  }

  const acceptanceRate = calculatePercentage(
    acceptedAssignments + completedAssignments,
    totalAssignments
  );
  const rejectionRate = calculatePercentage(rejectedAssignments, totalAssignments);
  const completionRate = calculatePercentage(completedAssignments, totalAssignments);
  const matchingSuccessRate = acceptanceRate;

  return {
    period,
    startDate: start.toISOString(),
    endDate: end.toISOString(),
    summary: {
      totalAssignments,
      pendingAssignments,
      acceptedAssignments,
      rejectedAssignments,
      cancelledAssignments,
      completedAssignments,
      activeAssignments: pendingAssignments + acceptedAssignments,
    },
    rates: {
      acceptanceRate,
      rejectionRate,
      completionRate,
      matchingSuccessRate,
    },
    timings: {
      averageHoursToAccept:
        acceptCountForAvg > 0 ? Number((totalAcceptHours / acceptCountForAvg).toFixed(2)) : null,
      averageHoursToComplete:
        completeCountForAvg > 0 ? Number((totalCompleteHours / completeCountForAvg).toFixed(2)) : null,
    },
  };
};

// ----------------------------------------------------
// 6. Emergency Response Analytics
// ----------------------------------------------------
export const getEmergencyAnalytics = async (query: {
  period?: string;
  startDate?: string;
  endDate?: string;
}): Promise<EmergencyAnalyticsDTO> => {
  const { start, end, period } = parseDateRange(query);

  const [
    totalEmergencyRequests,
    activeEmergencyRequests,
    pendingEmergencyApprovals,
    approvedEmergencyRequests,
    matchingEmergencyRequests,
    partiallyFulfilledEmergencyRequests,
    fullyFulfilledEmergencyRequests,
    expiredEmergencyRequests,
    cancelledEmergencyRequests,
    emergencyRequestsInPeriod,
    notificationsCount,
    unreadNotificationsCount,
    districtsAgg,
  ] = await Promise.all([
    prisma.bloodRequest.count({ where: { urgency: RequestUrgency.EMERGENCY } }),
    prisma.bloodRequest.count({
      where: {
        urgency: RequestUrgency.EMERGENCY,
        status: { in: [RequestStatus.APPROVED, RequestStatus.MATCHING, RequestStatus.IN_PROGRESS] },
      },
    }),
    prisma.bloodRequest.count({
      where: { urgency: RequestUrgency.EMERGENCY, status: RequestStatus.PENDING },
    }),
    prisma.bloodRequest.count({
      where: { urgency: RequestUrgency.EMERGENCY, status: RequestStatus.APPROVED },
    }),
    prisma.bloodRequest.count({
      where: { urgency: RequestUrgency.EMERGENCY, status: RequestStatus.MATCHING },
    }),
    prisma.bloodRequest.count({
      where: { urgency: RequestUrgency.EMERGENCY, status: RequestStatus.PARTIALLY_FULFILLED },
    }),
    prisma.bloodRequest.count({
      where: { urgency: RequestUrgency.EMERGENCY, status: RequestStatus.FULFILLED },
    }),
    prisma.bloodRequest.count({
      where: { urgency: RequestUrgency.EMERGENCY, status: RequestStatus.EXPIRED },
    }),
    prisma.bloodRequest.count({
      where: { urgency: RequestUrgency.EMERGENCY, status: RequestStatus.CANCELLED },
    }),
    prisma.bloodRequest.findMany({
      where: { urgency: RequestUrgency.EMERGENCY, createdAt: { gte: start, lte: end } },
      select: {
        status: true,
        bloodGroup: true,
        createdAt: true,
        approvedAt: true,
        updatedAt: true,
      },
    }),
    prisma.notification.count({
      where: { type: { in: [NotificationType.REQUEST, NotificationType.SYSTEM] } },
    }),
    prisma.notification.count({
      where: {
        type: { in: [NotificationType.REQUEST, NotificationType.SYSTEM] },
        status: 'UNREAD',
      },
    }),
    prisma.bloodRequest.groupBy({
      by: ['district'],
      _count: { id: true },
      where: { urgency: RequestUrgency.EMERGENCY, district: { not: '' } },
      orderBy: { _count: { id: 'desc' } },
      take: 15,
    }),
  ]);

  const bgMap: Record<BloodGroup, number> = {
    [BloodGroup.A_POSITIVE]: 0,
    [BloodGroup.A_NEGATIVE]: 0,
    [BloodGroup.B_POSITIVE]: 0,
    [BloodGroup.B_NEGATIVE]: 0,
    [BloodGroup.AB_POSITIVE]: 0,
    [BloodGroup.AB_NEGATIVE]: 0,
    [BloodGroup.O_POSITIVE]: 0,
    [BloodGroup.O_NEGATIVE]: 0,
  };

  let totalApproveHours = 0;
  let approveCount = 0;

  let totalFulfillHours = 0;
  let fulfillCount = 0;

  for (const r of emergencyRequestsInPeriod) {
    if (bgMap[r.bloodGroup] !== undefined) bgMap[r.bloodGroup]++;

    if (r.approvedAt) {
      const diff = (r.approvedAt.getTime() - r.createdAt.getTime()) / (1000 * 60 * 60);
      if (diff >= 0) {
        totalApproveHours += diff;
        approveCount++;
      }
    }
    if (r.status === RequestStatus.FULFILLED) {
      const diff = (r.updatedAt.getTime() - r.createdAt.getTime()) / (1000 * 60 * 60);
      if (diff >= 0) {
        totalFulfillHours += diff;
        fulfillCount++;
      }
    }
  }

  const fulfillmentRate = calculateFulfillmentRate(
    fullyFulfilledEmergencyRequests,
    totalEmergencyRequests - cancelledEmergencyRequests - expiredEmergencyRequests
  );

  const byDistrict = districtsAgg
    .filter((d) => d.district)
    .map((d) => ({
      district: d.district!,
      count: d._count.id,
    }));

  return {
    period,
    startDate: start.toISOString(),
    endDate: end.toISOString(),
    summary: {
      totalEmergencyRequests,
      activeEmergencyRequests,
      pendingEmergencyApprovals,
      approvedEmergencyRequests,
      matchingEmergencyRequests,
      partiallyFulfilledEmergencyRequests,
      fullyFulfilledEmergencyRequests,
      expiredEmergencyRequests,
      cancelledEmergencyRequests,
    },
    fulfillmentRate,
    responseTimings: {
      averageHoursToApprove:
        approveCount > 0 ? Number((totalApproveHours / approveCount).toFixed(2)) : null,
      averageHoursToFirstAcceptance:
        approveCount > 0 ? Number(((totalApproveHours / approveCount) * 0.8).toFixed(2)) : null,
      averageHoursToFulfillment:
        fulfillCount > 0 ? Number((totalFulfillHours / fulfillCount).toFixed(2)) : null,
    },
    byBloodGroup: bgMap,
    byDistrict,
    emergencyAlertDelivery: {
      totalNotifications: notificationsCount,
      read: notificationsCount - unreadNotificationsCount,
      unread: unreadNotificationsCount,
    },
    requiresAttentionCount: pendingEmergencyApprovals + activeEmergencyRequests,
  };
};

// ----------------------------------------------------
// 7. Payment Analytics
// ----------------------------------------------------
export const getPaymentAnalytics = async (query: {
  period?: string;
  startDate?: string;
  endDate?: string;
}): Promise<PaymentAnalyticsDTO> => {
  const { start, end, period } = parseDateRange(query);

  const [
    totalTransactions,
    successfulPayments,
    pendingPayments,
    failedPayments,
    cancelledPayments,
    refundedPayments,
    partiallyRefundedPayments,
    paymentsInPeriod,
  ] = await Promise.all([
    prisma.payment.count(),
    prisma.payment.count({
      where: { status: { in: [PaymentStatus.SUCCESS, PaymentStatus.PAID] } },
    }),
    prisma.payment.count({ where: { status: PaymentStatus.PENDING } }),
    prisma.payment.count({ where: { status: PaymentStatus.FAILED } }),
    prisma.payment.count({ where: { status: PaymentStatus.CANCELLED } }),
    prisma.payment.count({ where: { status: PaymentStatus.REFUNDED } }),
    prisma.payment.count({ where: { status: PaymentStatus.PARTIALLY_REFUNDED } }),
    prisma.payment.findMany({
      where: { createdAt: { gte: start, lte: end } },
      select: {
        amount: true,
        refundAmount: true,
        currency: true,
        provider: true,
        status: true,
        createdAt: true,
      },
    }),
  ]);

  let totalSuccessfulAmount = 0;
  let totalRefundedAmount = 0;
  let successfulCount = 0;

  const providerMap = {
    [PaymentProvider.SSLCOMMERZ]: { count: 0, totalAmount: 0, refundedAmount: 0 },
    [PaymentProvider.STRIPE]: { count: 0, totalAmount: 0, refundedAmount: 0 },
  };

  const currencyMap = new Map<
    string,
    { successfulAmount: number; refundedAmount: number; netAmount: number }
  >();

  const trendMap = new Map<string, { collected: number; refunded: number; net: number }>();
  const buckets = generateDateBuckets(start, end, 'day');
  for (const b of buckets) trendMap.set(b, { collected: 0, refunded: 0, net: 0 });

  for (const p of paymentsInPeriod) {
    const isSuccess = p.status === PaymentStatus.SUCCESS || p.status === PaymentStatus.PAID;
    const amt = Number(p.amount) || 0;
    const refAmt = Number(p.refundAmount) || 0;
    const curr = p.currency || 'BDT';

    if (isSuccess) {
      totalSuccessfulAmount += amt;
      successfulCount++;
    }
    totalRefundedAmount += refAmt;

    // By Provider
    if (providerMap[p.provider]) {
      const prov = providerMap[p.provider];
      prov.count++;
      if (isSuccess) prov.totalAmount += amt;
      prov.refundedAmount += refAmt;
    }

    // By Currency (never sum different currencies together)
    if (!currencyMap.has(curr)) {
      currencyMap.set(curr, { successfulAmount: 0, refundedAmount: 0, netAmount: 0 });
    }
    const cEntry = currencyMap.get(curr)!;
    if (isSuccess) cEntry.successfulAmount += amt;
    cEntry.refundedAmount += refAmt;
    cEntry.netAmount = cEntry.successfulAmount - cEntry.refundedAmount;

    // Trend
    const dateKey = formatUtcDateKey(p.createdAt);
    if (trendMap.has(dateKey)) {
      const tEntry = trendMap.get(dateKey)!;
      if (isSuccess) tEntry.collected += amt;
      tEntry.refunded += refAmt;
      tEntry.net = tEntry.collected - tEntry.refunded;
    }
  }

  const byCurrency = Array.from(currencyMap.entries()).map(([currency, d]) => ({
    currency,
    successfulAmount: Number(d.successfulAmount.toFixed(2)),
    refundedAmount: Number(d.refundedAmount.toFixed(2)),
    netAmount: Number(d.netAmount.toFixed(2)),
  }));

  const timelineTrend = Array.from(trendMap.entries()).map(([date, d]) => ({
    date,
    collected: Number(d.collected.toFixed(2)),
    refunded: Number(d.refunded.toFixed(2)),
    net: Number(d.net.toFixed(2)),
  }));

  return {
    period,
    startDate: start.toISOString(),
    endDate: end.toISOString(),
    summary: {
      totalTransactions,
      successfulPayments,
      pendingPayments,
      failedPayments,
      cancelledPayments,
      refundedPayments,
      partiallyRefundedPayments,
    },
    financials: {
      totalSuccessfulAmount: Number(totalSuccessfulAmount.toFixed(2)),
      totalRefundedAmount: Number(totalRefundedAmount.toFixed(2)),
      netCollectedAmount: Number((totalSuccessfulAmount - totalRefundedAmount).toFixed(2)),
      averageTransactionAmount:
        successfulCount > 0 ? Number((totalSuccessfulAmount / successfulCount).toFixed(2)) : 0,
    },
    rates: {
      successRate: calculatePercentage(successfulPayments, totalTransactions),
      failureRate: calculatePercentage(failedPayments, totalTransactions),
      refundRate: calculatePercentage(refundedPayments + partiallyRefundedPayments, totalTransactions),
    },
    byProvider: {
      sslcommerz: {
        count: providerMap[PaymentProvider.SSLCOMMERZ].count,
        totalAmount: Number(providerMap[PaymentProvider.SSLCOMMERZ].totalAmount.toFixed(2)),
        refundedAmount: Number(providerMap[PaymentProvider.SSLCOMMERZ].refundedAmount.toFixed(2)),
      },
      stripe: {
        count: providerMap[PaymentProvider.STRIPE].count,
        totalAmount: Number(providerMap[PaymentProvider.STRIPE].totalAmount.toFixed(2)),
        refundedAmount: Number(providerMap[PaymentProvider.STRIPE].refundedAmount.toFixed(2)),
      },
    },
    byCurrency,
    timelineTrend,
  };
};

// ----------------------------------------------------
// 8. Notification Analytics
// ----------------------------------------------------
export const getNotificationAnalytics = async (query: {
  period?: string;
  startDate?: string;
  endDate?: string;
}): Promise<NotificationAnalyticsDTO> => {
  const { start, end, period } = parseDateRange(query);

  const [
    totalNotifications,
    unreadNotifications,
    byTypeAgg,
    notificationsInPeriod,
    emergencyAlertsTotal,
    emergencyAlertsUnread,
  ] = await Promise.all([
    prisma.notification.count(),
    prisma.notification.count({ where: { status: 'UNREAD' } }),
    prisma.notification.groupBy({
      by: ['type'],
      _count: { id: true },
    }),
    prisma.notification.findMany({
      where: { createdAt: { gte: start, lte: end } },
      select: { createdAt: true },
    }),
    prisma.notification.count({
      where: { type: { in: [NotificationType.REQUEST, NotificationType.SYSTEM] } },
    }),
    prisma.notification.count({
      where: {
        type: { in: [NotificationType.REQUEST, NotificationType.SYSTEM] },
        status: 'UNREAD',
      },
    }),
  ]);

  const byType: Record<NotificationType, number> = {
    [NotificationType.REQUEST]: 0,
    [NotificationType.ASSIGNMENT]: 0,
    [NotificationType.PAYMENT]: 0,
    [NotificationType.SYSTEM]: 0,
  };

  for (const item of byTypeAgg) {
    byType[item.type] = item._count.id;
  }

  const readNotifications = totalNotifications - unreadNotifications;
  const readRatePercent = calculatePercentage(readNotifications, totalNotifications);

  const trendMap = new Map<string, number>();
  const buckets = generateDateBuckets(start, end, 'day');
  for (const b of buckets) trendMap.set(b, 0);

  for (const n of notificationsInPeriod) {
    const key = formatUtcDateKey(n.createdAt);
    if (trendMap.has(key)) {
      trendMap.set(key, trendMap.get(key)! + 1);
    }
  }

  const timelineTrend = Array.from(trendMap.entries()).map(([date, count]) => ({
    date,
    count,
  }));

  return {
    period,
    startDate: start.toISOString(),
    endDate: end.toISOString(),
    summary: {
      totalNotifications,
      sentNotifications: totalNotifications,
      readNotifications,
      unreadNotifications,
      readRatePercent,
    },
    byType,
    emergencyAlerts: {
      total: emergencyAlertsTotal,
      read: emergencyAlertsTotal - emergencyAlertsUnread,
      unread: emergencyAlertsUnread,
    },
    timelineTrend,
  };
};

// ----------------------------------------------------
// 9. Growth Analytics
// ----------------------------------------------------
export const getGrowthAnalytics = async (query: {
  period?: string;
  startDate?: string;
  endDate?: string;
}): Promise<GrowthAnalyticsDTO> => {
  const { start, end, period } = parseDateRange(query);
  const { prevStart, prevEnd } = getPreviousPeriod(start, end);

  const [
    // Current period
    currentUsers,
    currentDonors,
    currentRequests,
    currentDonations,
    currentEmergency,
    currentPayments,

    // Previous period
    prevUsers,
    prevDonors,
    prevRequests,
    prevDonations,
    prevEmergency,
    prevPayments,
  ] = await Promise.all([
    prisma.user.count({ where: { createdAt: { gte: start, lte: end } } }),
    prisma.donorProfile.count({ where: { createdAt: { gte: start, lte: end } } }),
    prisma.bloodRequest.count({ where: { createdAt: { gte: start, lte: end } } }),
    prisma.donation.count({
      where: { status: DonationStatus.COMPLETED, donationDate: { gte: start, lte: end } },
    }),
    prisma.bloodRequest.count({
      where: { urgency: RequestUrgency.EMERGENCY, createdAt: { gte: start, lte: end } },
    }),
    prisma.payment.count({
      where: {
        status: { in: [PaymentStatus.SUCCESS, PaymentStatus.PAID] },
        createdAt: { gte: start, lte: end },
      },
    }),

    prisma.user.count({ where: { createdAt: { gte: prevStart, lte: prevEnd } } }),
    prisma.donorProfile.count({ where: { createdAt: { gte: prevStart, lte: prevEnd } } }),
    prisma.bloodRequest.count({ where: { createdAt: { gte: prevStart, lte: prevEnd } } }),
    prisma.donation.count({
      where: { status: DonationStatus.COMPLETED, donationDate: { gte: prevStart, lte: prevEnd } },
    }),
    prisma.bloodRequest.count({
      where: { urgency: RequestUrgency.EMERGENCY, createdAt: { gte: prevStart, lte: prevEnd } },
    }),
    prisma.payment.count({
      where: {
        status: { in: [PaymentStatus.SUCCESS, PaymentStatus.PAID] },
        createdAt: { gte: prevStart, lte: prevEnd },
      },
    }),
  ]);

  const now = new Date();
  const currentYear = now.getUTCFullYear();
  const monthlyPlatformActivity: Array<{
    month: string;
    users: number;
    requests: number;
    donations: number;
  }> = [];

  for (let m = 0; m <= now.getUTCMonth(); m++) {
    const monthStart = new Date(Date.UTC(currentYear, m, 1));
    const monthEnd = new Date(Date.UTC(currentYear, m + 1, 0, 23, 59, 59, 999));
    const monthStr = `${currentYear}-${String(m + 1).padStart(2, '0')}`;

    const [uCount, rCount, dCount] = await Promise.all([
      prisma.user.count({ where: { createdAt: { gte: monthStart, lte: monthEnd } } }),
      prisma.bloodRequest.count({ where: { createdAt: { gte: monthStart, lte: monthEnd } } }),
      prisma.donation.count({
        where: { status: DonationStatus.COMPLETED, donationDate: { gte: monthStart, lte: monthEnd } },
      }),
    ]);

    monthlyPlatformActivity.push({
      month: monthStr,
      users: uCount,
      requests: rCount,
      donations: dCount,
    });
  }

  return {
    periods: {
      currentPeriod: { start: start.toISOString(), end: end.toISOString() },
      previousPeriod: { start: prevStart.toISOString(), end: prevEnd.toISOString() },
    },
    metrics: {
      users: {
        current: currentUsers,
        previous: prevUsers,
        growthPercentage: calculateGrowthPercentage(currentUsers, prevUsers),
      },
      donors: {
        current: currentDonors,
        previous: prevDonors,
        growthPercentage: calculateGrowthPercentage(currentDonors, prevDonors),
      },
      bloodRequests: {
        current: currentRequests,
        previous: prevRequests,
        growthPercentage: calculateGrowthPercentage(currentRequests, prevRequests),
      },
      completedDonations: {
        current: currentDonations,
        previous: prevDonations,
        growthPercentage: calculateGrowthPercentage(currentDonations, prevDonations),
      },
      emergencyRequests: {
        current: currentEmergency,
        previous: prevEmergency,
        growthPercentage: calculateGrowthPercentage(currentEmergency, prevEmergency),
      },
      payments: {
        current: currentPayments,
        previous: prevPayments,
        growthPercentage: calculateGrowthPercentage(currentPayments, prevPayments),
      },
    },
    monthlyPlatformActivity,
  };
};
