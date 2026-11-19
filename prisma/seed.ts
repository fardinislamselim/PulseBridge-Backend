import { prisma, connectDatabase, disconnectDatabase } from '../src/config/database.js';
import { env, config } from '../src/config/env.js';
import { hashPassword } from '../src/utils/password.js';
import {
  UserRole,
  UserStatus,
  BloodGroup,
  RequestStatus,
  RequestUrgency,
  AssignmentStatus,
  NotificationType,
  NotificationStatus,
} from '../src/generated/prisma/enums.js';

export const seedDatabase = async (): Promise<void> => {
  if (env.NODE_ENV === 'production') {
    console.warn('[Seed] Refusing to seed dummy data in production environment.');
    return;
  }

  console.log('[Seed] Commencing development database seed...');

  const connected = await connectDatabase();
  if (!connected) {
    throw new Error('[Seed] Unable to connect to the database.');
  }

  try {
    const seedAdminPassword =
      process.env.SEED_ADMIN_PASSWORD ||
      env.SEED_ADMIN_PASSWORD ||
      config.admin_password ||
      'AdminPassword123!';
    const defaultAdminPasswordHash = await hashPassword(seedAdminPassword);
    const superAdminPasswordHash = await hashPassword(config.admin_password || seedAdminPassword);
    const demoUserPasswordHash = await hashPassword('DemoPassword123!');

    // 1. Seed Default Administrator (admin@pulsebridge.com)
    // Safe idempotent upsert: never overwrite existing admin password on rerun
    const defaultAdminEmail = 'admin@pulsebridge.com';
    const existingDefaultAdmin = await prisma.user.findUnique({
      where: { email: defaultAdminEmail },
    });

    let defaultAdmin;
    if (existingDefaultAdmin) {
      defaultAdmin = await prisma.user.update({
        where: { id: existingDefaultAdmin.id },
        data: {
          role: UserRole.ADMIN,
          status: UserStatus.ACTIVE,
          emailVerified: true,
          name: existingDefaultAdmin.name || 'PulseBridge Administrator',
        },
      });
      console.log(`[Seed] Default Admin account verified (existing password preserved): ${defaultAdmin.email}`);
    } else {
      defaultAdmin = await prisma.user.create({
        data: {
          name: 'PulseBridge Administrator',
          email: defaultAdminEmail,
          password: defaultAdminPasswordHash,
          phone: '+8801700000001',
          role: UserRole.ADMIN,
          status: UserStatus.ACTIVE,
          emailVerified: true,
        },
      });
      console.log(`[Seed] Default Admin account created: ${defaultAdmin.email}`);
    }

    // 2. Seed Super Administrator User
    const superAdminEmail = 'superadmin@pulsebridge.com';
    const existingSuperAdmin = await prisma.user.findUnique({
      where: { email: superAdminEmail },
    });

    let superAdmin;
    if (existingSuperAdmin) {
      superAdmin = await prisma.user.update({
        where: { id: existingSuperAdmin.id },
        data: {
          name: config.admin_name || existingSuperAdmin.name,
          role: UserRole.SUPER_ADMIN,
          status: UserStatus.ACTIVE,
          emailVerified: true,
        },
      });
      console.log(`[Seed] Super Admin user verified: ${superAdmin.email}`);
    } else {
      superAdmin = await prisma.user.create({
        data: {
          name: config.admin_name || 'System Super Admin',
          email: superAdminEmail,
          password: superAdminPasswordHash,
          phone: '+8801700000000',
          role: UserRole.SUPER_ADMIN,
          status: UserStatus.ACTIVE,
          emailVerified: true,
        },
      });
      console.log(`[Seed] Super Admin user created: ${superAdmin.email}`);
    }

    // 3. Seed Demo Donor User & DonorProfile
    const donorUser = await prisma.user.upsert({
      where: { email: 'donor.john@pulsebridge.com' },
      update: {
        role: UserRole.DONOR,
        status: UserStatus.ACTIVE,
        emailVerified: true,
      },
      create: {
        name: 'John Doe',
        email: 'donor.john@pulsebridge.com',
        password: demoUserPasswordHash,
        phone: '+8801711111111',
        role: UserRole.DONOR,
        status: UserStatus.ACTIVE,
        emailVerified: true,
      },
    });

    const donorProfile = await prisma.donorProfile.upsert({
      where: { userId: donorUser.id },
      update: {
        bloodGroup: BloodGroup.O_POSITIVE,
        city: 'Dhaka',
        district: 'Dhaka',
        isAvailable: true,
        isVerified: false,
      },
      create: {
        userId: donorUser.id,
        bloodGroup: BloodGroup.O_POSITIVE,
        gender: 'Male',
        address: 'House 12, Road 5, Dhanmondi',
        city: 'Dhaka',
        district: 'Dhaka',
        isAvailable: true,
        isVerified: false,
        lastDonationDate: new Date('2026-08-15T00:00:00.000Z'),
        eligibleAt: new Date('2026-11-15T00:00:00.000Z'),
      },
    });
    console.log(`[Seed] Donor user and profile ensured: ${donorUser.email} (${donorProfile.bloodGroup})`);

    // 4. Seed Demo Requester User
    const requesterUser = await prisma.user.upsert({
      where: { email: 'recipient.alice@pulsebridge.com' },
      update: {
        role: UserRole.REQUESTER,
        status: UserStatus.ACTIVE,
        emailVerified: true,
      },
      create: {
        name: 'Alice Rahman',
        email: 'recipient.alice@pulsebridge.com',
        password: demoUserPasswordHash,
        phone: '+8801722222222',
        role: UserRole.REQUESTER,
        status: UserStatus.ACTIVE,
        emailVerified: true,
      },
    });
    console.log(`[Seed] Requester user ensured: ${requesterUser.email}`);

    // 5. Seed Demo Blood Request
    const existingRequest = await prisma.bloodRequest.findFirst({
      where: {
        requesterId: requesterUser.id,
        patientName: 'Farhana Rahman',
        bloodGroup: BloodGroup.O_POSITIVE,
      },
    });

    const bloodRequest = existingRequest
      ? await prisma.bloodRequest.update({
          where: { id: existingRequest.id },
          data: {
            status: RequestStatus.PENDING,
            urgency: RequestUrgency.URGENT,
          },
        })
      : await prisma.bloodRequest.create({
          data: {
            requesterId: requesterUser.id,
            patientName: 'Farhana Rahman',
            bloodGroup: BloodGroup.O_POSITIVE,
            unitsRequired: 2,
            hospitalName: 'Dhaka Medical College Hospital',
            hospitalAddress: 'Secretariat Road, Dhaka 1000',
            city: 'Dhaka',
            district: 'Dhaka',
            contactPerson: 'Alice Rahman',
            contactPhone: '+8801722222222',
            urgency: RequestUrgency.URGENT,
            status: RequestStatus.PENDING,
            requiredAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // In 24 hours
            details: 'Urgent need for elective surgery replacement blood.',
          },
        });
    console.log(`[Seed] Blood request ensured: ID ${bloodRequest.id} for ${bloodRequest.patientName}`);

    // 6. Seed Demo Donor Assignment
    const assignment = await prisma.donorAssignment.upsert({
      where: {
        requestId_donorProfileId: {
          requestId: bloodRequest.id,
          donorProfileId: donorProfile.id,
        },
      },
      update: {
        status: AssignmentStatus.PENDING,
      },
      create: {
        requestId: bloodRequest.id,
        donorProfileId: donorProfile.id,
        status: AssignmentStatus.PENDING,
        notes: 'Potential donor matched automatically based on blood group and city.',
      },
    });
    console.log(`[Seed] Donor assignment ensured: ID ${assignment.id}`);

    // 7. Seed Demo Notification
    await prisma.notification.create({
      data: {
        userId: donorUser.id,
        type: NotificationType.ASSIGNMENT,
        title: 'New Emergency Blood Request Match',
        message: 'An urgent O+ blood request in Dhaka matches your profile.',
        status: NotificationStatus.UNREAD,
        metadata: {
          requestId: bloodRequest.id,
          assignmentId: assignment.id,
        },
      },
    });
    console.log('[Seed] Demo notification created.');

    // 8. Seed Demo Audit Log
    await prisma.auditLog.create({
      data: {
        actorId: superAdmin.id,
        action: 'SEED_INITIAL_DATA',
        entity: 'System',
        metadata: {
          timestamp: new Date().toISOString(),
          seededBy: superAdmin.email,
        },
      },
    });
    console.log('[Seed] Demo audit log created.');

    console.log('[Seed] Database seeding completed successfully! ✨');
  } catch (error) {
    console.error('[Seed] Database seeding failed:', error);
    throw error;
  } finally {
    await disconnectDatabase();
  }
};

void seedDatabase();
