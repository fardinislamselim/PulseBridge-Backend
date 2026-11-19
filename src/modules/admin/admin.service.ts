import { prisma } from '../../config/database.js';
import { UserRole, UserStatus, RequestStatus } from '../../generated/prisma/enums.js';
import type { Prisma } from '../../generated/prisma/client.js';
import type { DashboardStats, GetAuditLogsQueryDTO } from './admin.interface.js';
import type { PaginatedResult } from '../users/user.interface.js';

export const getAdminDashboard = async (): Promise<DashboardStats> => {
  const [
    totalUsers,
    activeUsers,
    blockedUsers,
    deletedUsers,
    donorUsers,
    adminUsers,
    totalRequests,
    pendingRequests,
    approvedRequests,
    fulfilledRequests,
    totalDonations,
    recentAuditLogs,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { status: UserStatus.ACTIVE } }),
    prisma.user.count({ where: { status: UserStatus.BLOCKED } }),
    prisma.user.count({ where: { status: UserStatus.DELETED } }),
    prisma.user.count({ where: { role: UserRole.DONOR } }),
    prisma.user.count({
      where: { OR: [{ role: UserRole.ADMIN }, { role: UserRole.SUPER_ADMIN }] },
    }),
    prisma.bloodRequest.count(),
    prisma.bloodRequest.count({ where: { status: RequestStatus.PENDING } }),
    prisma.bloodRequest.count({ where: { status: RequestStatus.APPROVED } }),
    prisma.bloodRequest.count({ where: { status: RequestStatus.FULFILLED } }),
    prisma.donation.count(),
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
      total: totalUsers,
      active: activeUsers,
      blocked: blockedUsers,
      deleted: deletedUsers,
      donors: donorUsers,
      admins: adminUsers,
    },
    bloodRequests: {
      total: totalRequests,
      pending: pendingRequests,
      approved: approvedRequests,
      fulfilled: fulfilledRequests,
    },
    donations: {
      total: totalDonations,
    },
    recentAuditLogs,
  };
};

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
