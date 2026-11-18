import type { UserRole, UserStatus } from '../../generated/prisma/enums.js';

export interface UserSummary {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  role: UserRole;
  status: UserStatus;
  emailVerified: boolean;
  createdAt: Date;
  updatedAt: Date;
}
