export interface DashboardStats {
  users: {
    total: number;
    active: number;
    blocked: number;
    deleted: number;
    donors: number;
    admins: number;
  };
  bloodRequests: {
    total: number;
    pending: number;
    approved: number;
    fulfilled: number;
  };
  donations: {
    total: number;
  };
  recentAuditLogs: Array<{
    id: string;
    action: string;
    entity: string;
    createdAt: Date;
    actor: { name: string; email: string } | null;
  }>;
}

export interface GetAuditLogsQueryDTO {
  page?: number;
  limit?: number;
  action?: string;
  entity?: string;
  actorId?: string;
}
