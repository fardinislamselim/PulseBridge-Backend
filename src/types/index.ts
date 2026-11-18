import type { UserRole, UserStatus } from '../generated/prisma/enums.js';

export interface ServiceHealthStatus {
  database: 'connected' | 'disconnected';
  redis: 'connected' | 'disconnected';
}

export interface HealthCheckData {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  application: string;
  services: ServiceHealthStatus;
}

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  phone: string | null;
  role: UserRole;
  status: UserStatus;
  emailVerified: boolean;
  createdAt: Date;
  updatedAt: Date;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
      sessionId?: string;
    }
  }
}
