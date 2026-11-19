import { prisma } from '../config/database.js';
import { NotificationType, NotificationStatus } from '../generated/prisma/enums.js';
import type { Prisma } from '../generated/prisma/client.js';

export interface CreateNotificationParams {
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  metadata?: Record<string, unknown>;
}

/**
 * Creates an in-app notification record in the database.
 * Fails gracefully without throwing an error if notification cannot be persisted.
 */
export const createNotification = async (
  params: CreateNotificationParams
): Promise<void> => {
  try {
    await prisma.notification.create({
      data: {
        userId: params.userId,
        type: params.type,
        title: params.title,
        message: params.message,
        status: NotificationStatus.UNREAD,
        metadata: (params.metadata || {}) as Prisma.InputJsonValue,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[NotificationService] Failed to create notification for user ${params.userId}: ${message}`);
  }
};
