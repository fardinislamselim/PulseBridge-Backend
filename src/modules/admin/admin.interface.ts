import type { BloodGroup, RequestUrgency, RequestStatus, AssignmentStatus, DonationStatus, PaymentProvider, PaymentPurpose, UserRole, UserStatus, NotificationType } from '../../generated/prisma/enums.js';

export interface DashboardOverviewDTO {
  users: {
    total: number;
    donors: number;
    requesters: number;
    admins: number;
    superAdmins: number;
    active: number;
    blocked: number;
    verified: number;
    unverified: number;
    newToday: number;
    newThisMonth: number;
  };
  donors: {
    total: number;
    available: number;
    unavailable: number;
    eligible: number;
    temporarilyIneligible: number;
    verified: number;
    unverified: number;
  };
  bloodRequests: {
    total: number;
    pending: number;
    approved: number;
    matching: number;
    inProgress: number;
    partiallyFulfilled: number;
    fulfilled: number;
    cancelled: number;
    rejected: number;
    expired: number;
    emergency: number;
    urgent: number;
    normal: number;
  };
  assignments: {
    total: number;
    pending: number;
    accepted: number;
    rejected: number;
    cancelled: number;
    completed: number;
  };
  donations: {
    total: number;
    completed: number;
    pending: number;
    rejected: number;
    totalUnitsDonated: number;
  };
  payments: {
    totalTransactions: number;
    successful: number;
    pending: number;
    failed: number;
    refunded: number;
    totalSuccessfulAmount: number;
    totalRefundedAmount: number;
    netCollectedAmount: number;
    currencies: Array<{
      currency: string;
      totalAmount: number;
      refundedAmount: number;
      netAmount: number;
    }>;
  };
  notifications: {
    total: number;
    sent: number;
    read: number;
    unread: number;
    byType: Record<string, number>;
  };
  emergency: {
    activeRequests: number;
    fulfilledRequests: number;
    unfulfilledRequests: number;
  };
}

// Retain compatibility with existing tests
export interface DashboardStats {
  users: {
    total: number;
    active: number;
    blocked: number;
    deleted: number;
    donors: number;
    admins: number;
    requesters?: number;
  };
  bloodRequests: {
    total: number;
    pending: number;
    approved: number;
    fulfilled: number;
    matching?: number;
    inProgress?: number;
    partiallyFulfilled?: number;
    cancelled?: number;
    expired?: number;
    rejected?: number;
  };
  donations: {
    total: number;
    completed?: number;
    pending?: number;
  };
  recentAuditLogs: Array<{
    id: string;
    action: string;
    entity: string;
    createdAt: Date;
    actor: { name: string; email: string } | null;
  }>;
  overview?: DashboardOverviewDTO;
}

export interface PlatformActivityItem {
  id: string;
  type: string;
  title: string;
  description: string;
  actor: {
    id: string;
    displayName: string;
  } | null;
  resource: {
    type: string;
    id: string;
  };
  createdAt: Date;
}

export interface RecentActivitiesResponseDTO {
  activities: PlatformActivityItem[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface UserAnalyticsDTO {
  period: string;
  startDate: string;
  endDate: string;
  summary: {
    totalRegistered: number;
    donors: number;
    requesters: number;
    admins: number;
    superAdmins: number;
    activeUsers: number;
    blockedUsers: number;
    verifiedUsers: number;
    unverifiedUsers: number;
    newToday: number;
    newThisWeek: number;
    newThisMonth: number;
    newThisYear: number;
  };
  growthTrend: Array<{ date: string; newUsers: number }>;
  roleDistribution: Record<string, number>;
  statusDistribution: Record<string, number>;
  districtDistribution: Array<{ district: string; count: number }>;
}

export interface DonorAnalyticsDTO {
  period: string;
  startDate: string;
  endDate: string;
  summary: {
    totalDonors: number;
    availableDonors: number;
    unavailableDonors: number;
    verifiedDonors: number;
    unverifiedDonors: number;
    eligibleDonors: number;
    temporarilyIneligibleDonors: number;
    onCooldown90Days: number;
    withActiveAssignments: number;
  };
  bloodGroupDistribution: Record<BloodGroup, number>;
  districtDistribution: Array<{ district: string; count: number; availableCount: number }>;
  newDonorsTrend: Array<{ date: string; newDonors: number }>;
  topDistricts: Array<{ district: string; count: number }>;
}

export interface BloodRequestAnalyticsDTO {
  period: string;
  startDate: string;
  endDate: string;
  summary: {
    totalRequests: number;
    createdToday: number;
    createdThisWeek: number;
    createdThisMonth: number;
    approvedRequests: number;
    pendingApprovalRequests: number;
    partiallyFulfilledRequests: number;
    fullyFulfilledRequests: number;
    cancelledRequests: number;
    rejectedRequests: number;
    expiredRequests: number;
  };
  byStatus: Record<RequestStatus, number>;
  byUrgency: Record<RequestUrgency, number>;
  byBloodGroup: Array<{
    bloodGroup: BloodGroup;
    count: number;
    unitsRequired: number;
    unitsFulfilled: number;
  }>;
  byDistrict: Array<{ district: string; count: number }>;
  metrics: {
    totalRequestedUnits: number;
    totalFulfilledUnits: number;
    remainingUnfulfilledUnits: number;
    fulfillmentRate: number;
    emergencyFulfillmentRate: number;
    averageHoursToApprove: number | null;
    averageHoursToFulfill: number | null;
  };
}

export interface DonationAnalyticsDTO {
  period: string;
  startDate: string;
  endDate: string;
  summary: {
    totalDonationRecords: number;
    completedDonations: number;
    pendingDonations: number;
    rejectedDonations: number;
    totalDonatedUnits: number;
    donationsToday: number;
    donationsThisWeek: number;
    donationsThisMonth: number;
    uniqueDonorsCount: number;
  };
  byBloodGroup: Array<{ bloodGroup: BloodGroup; count: number; units: number }>;
  byDistrict: Array<{ district: string; count: number }>;
  donationTrend: Array<{ date: string; count: number; units: number }>;
  monthlyGrowth: Array<{ month: string; count: number; growthPercentage: number | null }>;
  topDonors: Array<{
    donorId: string;
    displayName: string;
    bloodGroup: BloodGroup | null;
    completedDonations: number;
    totalUnits: number;
  }>;
}

export interface AssignmentAnalyticsDTO {
  period: string;
  startDate: string;
  endDate: string;
  summary: {
    totalAssignments: number;
    pendingAssignments: number;
    acceptedAssignments: number;
    rejectedAssignments: number;
    cancelledAssignments: number;
    completedAssignments: number;
    activeAssignments: number;
  };
  rates: {
    acceptanceRate: number;
    rejectionRate: number;
    completionRate: number;
    matchingSuccessRate: number;
  };
  timings: {
    averageHoursToAccept: number | null;
    averageHoursToComplete: number | null;
  };
}

export interface EmergencyAnalyticsDTO {
  period: string;
  startDate: string;
  endDate: string;
  summary: {
    totalEmergencyRequests: number;
    activeEmergencyRequests: number;
    pendingEmergencyApprovals: number;
    approvedEmergencyRequests: number;
    matchingEmergencyRequests: number;
    partiallyFulfilledEmergencyRequests: number;
    fullyFulfilledEmergencyRequests: number;
    expiredEmergencyRequests: number;
    cancelledEmergencyRequests: number;
  };
  fulfillmentRate: number;
  responseTimings: {
    averageHoursToApprove: number | null;
    averageHoursToFirstAcceptance: number | null;
    averageHoursToFulfillment: number | null;
  };
  byBloodGroup: Record<BloodGroup, number>;
  byDistrict: Array<{ district: string; count: number }>;
  emergencyAlertDelivery: {
    totalNotifications: number;
    read: number;
    unread: number;
  };
  requiresAttentionCount: number;
}

export interface PaymentAnalyticsDTO {
  period: string;
  startDate: string;
  endDate: string;
  summary: {
    totalTransactions: number;
    successfulPayments: number;
    pendingPayments: number;
    failedPayments: number;
    cancelledPayments: number;
    refundedPayments: number;
    partiallyRefundedPayments: number;
  };
  financials: {
    totalSuccessfulAmount: number;
    totalRefundedAmount: number;
    netCollectedAmount: number;
    averageTransactionAmount: number;
  };
  rates: {
    successRate: number;
    failureRate: number;
    refundRate: number;
  };
  byProvider: {
    sslcommerz: { count: number; totalAmount: number; refundedAmount: number };
    stripe: { count: number; totalAmount: number; refundedAmount: number };
  };
  byCurrency: Array<{
    currency: string;
    successfulAmount: number;
    refundedAmount: number;
    netAmount: number;
  }>;
  timelineTrend: Array<{
    date: string;
    collected: number;
    refunded: number;
    net: number;
  }>;
}

export interface NotificationAnalyticsDTO {
  period: string;
  startDate: string;
  endDate: string;
  summary: {
    totalNotifications: number;
    sentNotifications: number;
    readNotifications: number;
    unreadNotifications: number;
    readRatePercent: number;
  };
  byType: Record<NotificationType, number>;
  emergencyAlerts: {
    total: number;
    read: number;
    unread: number;
  };
  timelineTrend: Array<{ date: string; count: number }>;
}

export interface GrowthAnalyticsDTO {
  periods: {
    currentPeriod: { start: string; end: string };
    previousPeriod: { start: string; end: string };
  };
  metrics: {
    users: { current: number; previous: number; growthPercentage: number | null };
    donors: { current: number; previous: number; growthPercentage: number | null };
    bloodRequests: { current: number; previous: number; growthPercentage: number | null };
    completedDonations: { current: number; previous: number; growthPercentage: number | null };
    emergencyRequests: { current: number; previous: number; growthPercentage: number | null };
    payments: { current: number; previous: number; growthPercentage: number | null };
  };
  monthlyPlatformActivity: Array<{
    month: string;
    users: number;
    requests: number;
    donations: number;
  }>;
}

export interface GetAuditLogsQueryDTO {
  page?: number;
  limit?: number;
  action?: string;
  entity?: string;
  actorId?: string;
}
