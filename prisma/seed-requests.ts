import { prisma, connectDatabase, disconnectDatabase } from '../src/config/database.js';
import { env } from '../src/config/env.js';
import { hashPassword } from '../src/utils/password.js';
import { UserRole, UserStatus, BloodGroup, RequestStatus, RequestUrgency } from '../src/generated/prisma/enums.js';

interface SeedRequesterConfig {
  email: string;
  name: string;
  phone: string;
}

const SEED_REQUESTERS: SeedRequesterConfig[] = [
  {
    email: 'recipient.alice@pulsebridge.com',
    name: 'Alice Rahman',
    phone: '+8801722222222',
  },
  {
    email: 'requester.dr.kabeer@pulsebridge.com',
    name: 'Dr. Tariqul Kabeer',
    phone: '+8801750000001',
  },
  {
    email: 'requester.shams@pulsebridge.com',
    name: 'Shamsul Alam',
    phone: '+8801850000002',
  },
  {
    email: 'requester.roksana@pulsebridge.com',
    name: 'Roksana Parveen',
    phone: '+8801750000003',
  },
];

interface SeedRequestItem {
  requesterEmail: string;
  patientName: string;
  bloodGroup: BloodGroup;
  unitsRequired: number;
  fulfilledUnits?: number;
  hospitalName: string;
  hospitalAddress: string;
  area: string;
  city: string;
  district: string;
  latitude: number;
  longitude: number;
  contactPerson: string;
  contactPhone: string;
  urgency: RequestUrgency;
  status: RequestStatus;
  hoursUntilRequired: number;
  details: string;
}

// 20+ diverse realistic hospital blood requests across Bangladesh
const SEED_REQUESTS: SeedRequestItem[] = [
  // 1. Dhaka - DMCH (O_POSITIVE, EMERGENCY, APPROVED)
  {
    requesterEmail: 'recipient.alice@pulsebridge.com',
    patientName: 'Mohammad Farhad',
    bloodGroup: BloodGroup.O_POSITIVE,
    unitsRequired: 3,
    fulfilledUnits: 0,
    hospitalName: 'Dhaka Medical College Hospital (DMCH)',
    hospitalAddress: 'Secretariat Road, Ramna, Dhaka 1000',
    area: 'Ramna',
    city: 'Dhaka',
    district: 'Dhaka',
    latitude: 23.7258,
    longitude: 90.3976,
    contactPerson: 'Alice Rahman (Attendant)',
    contactPhone: '+8801722222222',
    urgency: RequestUrgency.EMERGENCY,
    status: RequestStatus.APPROVED,
    hoursUntilRequired: 6,
    details: 'Urgent emergency transfusion needed for polytrauma patient admitted in ICU Ward 5.',
  },
  // 2. Dhaka - BSMMU (O_NEGATIVE, URGENT, APPROVED)
  {
    requesterEmail: 'requester.dr.kabeer@pulsebridge.com',
    patientName: 'Taslima Begum',
    bloodGroup: BloodGroup.O_NEGATIVE,
    unitsRequired: 2,
    fulfilledUnits: 0,
    hospitalName: 'Bangabandhu Sheikh Mujib Medical University (BSMMU)',
    hospitalAddress: 'Shahbag, Dhaka 1000',
    area: 'Shahbag',
    city: 'Dhaka',
    district: 'Dhaka',
    latitude: 23.7388,
    longitude: 90.3956,
    contactPerson: 'Dr. Tariqul Kabeer',
    contactPhone: '+8801750000001',
    urgency: RequestUrgency.URGENT,
    status: RequestStatus.APPROVED,
    hoursUntilRequired: 14,
    details: 'Rare blood group required for scheduled C-section backup in Department of Obstetrics.',
  },
  // 3. Dhaka - Evercare Hospital (A_POSITIVE, NORMAL, APPROVED)
  {
    requesterEmail: 'requester.shams@pulsebridge.com',
    patientName: 'Ahsan Habib',
    bloodGroup: BloodGroup.A_POSITIVE,
    unitsRequired: 2,
    fulfilledUnits: 0,
    hospitalName: 'Evercare Hospital Dhaka',
    hospitalAddress: 'Plot 81, Block E, Bashundhara R/A, Dhaka 1229',
    area: 'Bashundhara R/A',
    city: 'Dhaka',
    district: 'Dhaka',
    latitude: 23.8103,
    longitude: 90.4312,
    contactPerson: 'Shamsul Alam',
    contactPhone: '+8801850000002',
    urgency: RequestUrgency.NORMAL,
    status: RequestStatus.APPROVED,
    hoursUntilRequired: 48,
    details: 'Elective orthopedic hip replacement surgery planned for tomorrow morning.',
  },
  // 4. Dhaka - Square Hospital (A_NEGATIVE, EMERGENCY, APPROVED)
  {
    requesterEmail: 'requester.roksana@pulsebridge.com',
    patientName: 'Kazi Nazmul',
    bloodGroup: BloodGroup.A_NEGATIVE,
    unitsRequired: 2,
    fulfilledUnits: 0,
    hospitalName: 'Square Hospital',
    hospitalAddress: '18/F Bir Uttam Qazi Nuruzzaman Sarak, West Panthapath, Dhaka 1205',
    area: 'Panthapath',
    city: 'Dhaka',
    district: 'Dhaka',
    latitude: 23.7534,
    longitude: 90.3817,
    contactPerson: 'Roksana Parveen',
    contactPhone: '+8801750000003',
    urgency: RequestUrgency.EMERGENCY,
    status: RequestStatus.APPROVED,
    hoursUntilRequired: 8,
    details: 'Critical bleeding due to gastrointestinal ulcer rupture in surgical ICU.',
  },
  // 5. Dhaka - United Hospital (B_POSITIVE, URGENT, APPROVED)
  {
    requesterEmail: 'recipient.alice@pulsebridge.com',
    patientName: 'Mahir Faisal',
    bloodGroup: BloodGroup.B_POSITIVE,
    unitsRequired: 3,
    fulfilledUnits: 0,
    hospitalName: 'United Hospital Limited',
    hospitalAddress: 'Plot 15, Road 71, Gulshan-2, Dhaka 1212',
    area: 'Gulshan',
    city: 'Dhaka',
    district: 'Dhaka',
    latitude: 23.7997,
    longitude: 90.4194,
    contactPerson: 'Alice Rahman',
    contactPhone: '+8801722222222',
    urgency: RequestUrgency.URGENT,
    status: RequestStatus.APPROVED,
    hoursUntilRequired: 18,
    details: 'Pediatric thalassemia patient admitted for routine monthly transfusion.',
  },
  // 6. Dhaka - NICVD (B_NEGATIVE, EMERGENCY, APPROVED)
  {
    requesterEmail: 'requester.dr.kabeer@pulsebridge.com',
    patientName: 'Abdul Latif',
    bloodGroup: BloodGroup.B_NEGATIVE,
    unitsRequired: 2,
    fulfilledUnits: 0,
    hospitalName: 'National Institute of Cardiovascular Diseases (NICVD)',
    hospitalAddress: 'Sher-e-Bangla Nagar, Dhaka 1207',
    area: 'Sher-e-Bangla Nagar',
    city: 'Dhaka',
    district: 'Dhaka',
    latitude: 23.7709,
    longitude: 90.3708,
    contactPerson: 'Dr. Tariqul Kabeer',
    contactPhone: '+8801750000001',
    urgency: RequestUrgency.EMERGENCY,
    status: RequestStatus.APPROVED,
    hoursUntilRequired: 5,
    details: 'Emergency coronary artery bypass graft (CABG) surgery standby.',
  },
  // 7. Dhaka - Ibn Sina Hospital (AB_POSITIVE, NORMAL, APPROVED)
  {
    requesterEmail: 'requester.shams@pulsebridge.com',
    patientName: 'Shamim Osman',
    bloodGroup: BloodGroup.AB_POSITIVE,
    unitsRequired: 1,
    fulfilledUnits: 0,
    hospitalName: 'Ibn Sina Hospital Dhanmondi',
    hospitalAddress: 'House 48, Road 9/A, Dhanmondi, Dhaka 1209',
    area: 'Dhanmondi',
    city: 'Dhaka',
    district: 'Dhaka',
    latitude: 23.7505,
    longitude: 90.3720,
    contactPerson: 'Shamsul Alam',
    contactPhone: '+8801850000002',
    urgency: RequestUrgency.NORMAL,
    status: RequestStatus.APPROVED,
    hoursUntilRequired: 36,
    details: 'Chronic kidney disease (CKD) patient undergoing hemodialysis support.',
  },
  // 8. Dhaka - Popular Medical College Hospital (AB_NEGATIVE, EMERGENCY, APPROVED)
  {
    requesterEmail: 'requester.roksana@pulsebridge.com',
    patientName: 'Nadia Chowdhury',
    bloodGroup: BloodGroup.AB_NEGATIVE,
    unitsRequired: 2,
    fulfilledUnits: 0,
    hospitalName: 'Popular Medical College Hospital',
    hospitalAddress: 'House 08, Road 02, Dhanmondi, Dhaka 1205',
    area: 'Dhanmondi',
    city: 'Dhaka',
    district: 'Dhaka',
    latitude: 23.7423,
    longitude: 90.3829,
    contactPerson: 'Roksana Parveen',
    contactPhone: '+8801750000003',
    urgency: RequestUrgency.EMERGENCY,
    status: RequestStatus.APPROVED,
    hoursUntilRequired: 7,
    details: 'Rare blood group needed urgently for postpartum hemorrhage management.',
  },

  // 9. Chattogram - CMCH (O_POSITIVE, EMERGENCY, APPROVED)
  {
    requesterEmail: 'recipient.alice@pulsebridge.com',
    patientName: 'Mustafa Kamal',
    bloodGroup: BloodGroup.O_POSITIVE,
    unitsRequired: 2,
    fulfilledUnits: 0,
    hospitalName: 'Chattogram Medical College Hospital (CMCH)',
    hospitalAddress: '57 K.B. Fazlul Kader Road, Panchlaish, Chattogram 4203',
    area: 'Panchlaish',
    city: 'Chattogram',
    district: 'Chattogram',
    latitude: 22.3592,
    longitude: 91.8286,
    contactPerson: 'Alice Rahman',
    contactPhone: '+8801722222222',
    urgency: RequestUrgency.EMERGENCY,
    status: RequestStatus.APPROVED,
    hoursUntilRequired: 4,
    details: 'Severe road traffic accident victim in neurosurgery emergency OT.',
  },
  // 10. Chattogram - Imperial Hospital (A_POSITIVE, URGENT, APPROVED)
  {
    requesterEmail: 'requester.dr.kabeer@pulsebridge.com',
    patientName: 'Salma Begum',
    bloodGroup: BloodGroup.A_POSITIVE,
    unitsRequired: 2,
    fulfilledUnits: 0,
    hospitalName: 'Imperial Hospital Limited',
    hospitalAddress: 'Zakir Hossain Road, Pahartali, Chattogram 4202',
    area: 'Pahartali',
    city: 'Chattogram',
    district: 'Chattogram',
    latitude: 22.3659,
    longitude: 91.7967,
    contactPerson: 'Dr. Tariqul Kabeer',
    contactPhone: '+8801750000001',
    urgency: RequestUrgency.URGENT,
    status: RequestStatus.APPROVED,
    hoursUntilRequired: 16,
    details: 'Oncology patient requiring fresh blood units following chemotherapy session.',
  },
  // 11. Chattogram - Parkview Hospital (B_POSITIVE, NORMAL, APPROVED)
  {
    requesterEmail: 'requester.shams@pulsebridge.com',
    patientName: 'Habibur Rahman',
    bloodGroup: BloodGroup.B_POSITIVE,
    unitsRequired: 1,
    fulfilledUnits: 0,
    hospitalName: 'Parkview Hospital',
    hospitalAddress: '94/103 Katalganj Road, Panchlaish, Chattogram 4203',
    area: 'Panchlaish',
    city: 'Chattogram',
    district: 'Chattogram',
    latitude: 22.3620,
    longitude: 91.8340,
    contactPerson: 'Shamsul Alam',
    contactPhone: '+8801850000002',
    urgency: RequestUrgency.NORMAL,
    status: RequestStatus.APPROVED,
    hoursUntilRequired: 40,
    details: 'Laparoscopic cholecystectomy elective procedure reserve.',
  },

  // 12. Sylhet - MAG Osmani Medical College (O_NEGATIVE, URGENT, APPROVED)
  {
    requesterEmail: 'requester.roksana@pulsebridge.com',
    patientName: 'Syed Anwar Ali',
    bloodGroup: BloodGroup.O_NEGATIVE,
    unitsRequired: 2,
    fulfilledUnits: 0,
    hospitalName: 'Sylhet MAG Osmani Medical College Hospital',
    hospitalAddress: 'Medical College Road, Kajolshah, Sylhet 3100',
    area: 'Kajolshah',
    city: 'Sylhet',
    district: 'Sylhet',
    latitude: 24.8996,
    longitude: 91.8542,
    contactPerson: 'Roksana Parveen',
    contactPhone: '+8801750000003',
    urgency: RequestUrgency.URGENT,
    status: RequestStatus.APPROVED,
    hoursUntilRequired: 12,
    details: 'Emergency transfusion needed for severe anemic crisis in pediatric unit.',
  },
  // 13. Sylhet - Mount Adora Hospital (AB_POSITIVE, NORMAL, APPROVED)
  {
    requesterEmail: 'recipient.alice@pulsebridge.com',
    patientName: 'Jannatul Ferdous',
    bloodGroup: BloodGroup.AB_POSITIVE,
    unitsRequired: 1,
    fulfilledUnits: 0,
    hospitalName: 'Mount Adora Hospital Akhalia',
    hospitalAddress: 'Akhalia, Sylhet 3100',
    area: 'Akhalia',
    city: 'Sylhet',
    district: 'Sylhet',
    latitude: 24.9125,
    longitude: 91.8320,
    contactPerson: 'Alice Rahman',
    contactPhone: '+8801722222222',
    urgency: RequestUrgency.NORMAL,
    status: RequestStatus.APPROVED,
    hoursUntilRequired: 30,
    details: 'Dengue fever patient requiring packed red cells alongside platelet therapy.',
  },

  // 14. Rajshahi - RMCH (B_NEGATIVE, EMERGENCY, APPROVED)
  {
    requesterEmail: 'requester.dr.kabeer@pulsebridge.com',
    patientName: 'Azizul Haque',
    bloodGroup: BloodGroup.B_NEGATIVE,
    unitsRequired: 2,
    fulfilledUnits: 0,
    hospitalName: 'Rajshahi Medical College Hospital (RMCH)',
    hospitalAddress: 'Medical College Gate, Laxmipur, Rajshahi 6000',
    area: 'Laxmipur',
    city: 'Rajshahi',
    district: 'Rajshahi',
    latitude: 24.3712,
    longitude: 91.5835,
    contactPerson: 'Dr. Tariqul Kabeer',
    contactPhone: '+8801750000001',
    urgency: RequestUrgency.EMERGENCY,
    status: RequestStatus.APPROVED,
    hoursUntilRequired: 6,
    details: 'Critical bleeding victim transferred to Burn and Plastic Surgery Unit.',
  },

  // 15. Khulna - KMCH (A_NEGATIVE, URGENT, APPROVED)
  {
    requesterEmail: 'requester.shams@pulsebridge.com',
    patientName: 'Monira Khatun',
    bloodGroup: BloodGroup.A_NEGATIVE,
    unitsRequired: 2,
    fulfilledUnits: 0,
    hospitalName: 'Khulna Medical College Hospital (KMCH)',
    hospitalAddress: 'Boyra Main Road, Khulna 9000',
    area: 'Boyra',
    city: 'Khulna',
    district: 'Khulna',
    latitude: 22.8447,
    longitude: 89.5348,
    contactPerson: 'Shamsul Alam',
    contactPhone: '+8801850000002',
    urgency: RequestUrgency.URGENT,
    status: RequestStatus.APPROVED,
    hoursUntilRequired: 15,
    details: 'Major vascular repair surgery planned at early morning theater.',
  },

  // 16. Rangpur - RMCH (O_POSITIVE, URGENT, PARTIALLY_FULFILLED - 1/2 units)
  {
    requesterEmail: 'recipient.alice@pulsebridge.com',
    patientName: 'Selim Reza',
    bloodGroup: BloodGroup.O_POSITIVE,
    unitsRequired: 2,
    fulfilledUnits: 1,
    hospitalName: 'Rangpur Medical College Hospital',
    hospitalAddress: 'Dhap, Jail Road, Rangpur 5400',
    area: 'Dhap',
    city: 'Rangpur',
    district: 'Rangpur',
    latitude: 25.7533,
    longitude: 89.2435,
    contactPerson: 'Alice Rahman',
    contactPhone: '+8801722222222',
    urgency: RequestUrgency.URGENT,
    status: RequestStatus.PARTIALLY_FULFILLED,
    hoursUntilRequired: 10,
    details: '1 unit already received from hospital voluntary drive; 1 more unit required urgently.',
  },

  // 17. Barishal - SBMCH (B_POSITIVE, EMERGENCY, PARTIALLY_FULFILLED - 1/3 units)
  {
    requesterEmail: 'requester.roksana@pulsebridge.com',
    patientName: 'Dilruba Yasmin',
    bloodGroup: BloodGroup.B_POSITIVE,
    unitsRequired: 3,
    fulfilledUnits: 1,
    hospitalName: 'Sher-e-Bangla Medical College Hospital (SBMCH)',
    hospitalAddress: 'Band Road, Barishal 8200',
    area: 'Band Road',
    city: 'Barishal',
    district: 'Barishal',
    latitude: 22.7010,
    longitude: 90.3535,
    contactPerson: 'Roksana Parveen',
    contactPhone: '+8801750000003',
    urgency: RequestUrgency.EMERGENCY,
    status: RequestStatus.PARTIALLY_FULFILLED,
    hoursUntilRequired: 8,
    details: 'Multiple trauma patient with pelvic fracture. 1 unit matched, 2 units still required.',
  },

  // 18. Mymensingh - MMCH (A_POSITIVE, URGENT, PENDING - For Admin Moderation)
  {
    requesterEmail: 'requester.dr.kabeer@pulsebridge.com',
    patientName: 'Enamul Haque',
    bloodGroup: BloodGroup.A_POSITIVE,
    unitsRequired: 2,
    fulfilledUnits: 0,
    hospitalName: 'Mymensingh Medical College Hospital (MMCH)',
    hospitalAddress: 'Charpara, Mymensingh 2200',
    area: 'Charpara',
    city: 'Mymensingh',
    district: 'Mymensingh',
    latitude: 24.7471,
    longitude: 90.4132,
    contactPerson: 'Dr. Tariqul Kabeer',
    contactPhone: '+8801750000001',
    urgency: RequestUrgency.URGENT,
    status: RequestStatus.PENDING,
    hoursUntilRequired: 24,
    details: 'Recently submitted blood request awaiting administrator verification and hospital bed check.',
  },

  // 19. Dhaka - DMCH (AB_NEGATIVE, EMERGENCY, PENDING - For Admin Moderation)
  {
    requesterEmail: 'recipient.alice@pulsebridge.com',
    patientName: 'Shahidul Alam',
    bloodGroup: BloodGroup.AB_NEGATIVE,
    unitsRequired: 2,
    fulfilledUnits: 0,
    hospitalName: 'Dhaka Medical College Hospital (DMCH)',
    hospitalAddress: 'Secretariat Road, Ramna, Dhaka 1000',
    area: 'Ramna',
    city: 'Dhaka',
    district: 'Dhaka',
    latitude: 23.7258,
    longitude: 90.3976,
    contactPerson: 'Alice Rahman',
    contactPhone: '+8801722222222',
    urgency: RequestUrgency.EMERGENCY,
    status: RequestStatus.PENDING,
    hoursUntilRequired: 6,
    details: 'Awaiting moderation: Emergency request from DMCH Emergency Department.',
  },

  // 20. Sylhet - Osmani Medical (O_POSITIVE, NORMAL, PENDING - For Admin Moderation)
  {
    requesterEmail: 'requester.shams@pulsebridge.com',
    patientName: 'Ayesha Siddika',
    bloodGroup: BloodGroup.O_POSITIVE,
    unitsRequired: 1,
    fulfilledUnits: 0,
    hospitalName: 'Sylhet MAG Osmani Medical College Hospital',
    hospitalAddress: 'Medical College Road, Kajolshah, Sylhet 3100',
    area: 'Kajolshah',
    city: 'Sylhet',
    district: 'Sylhet',
    latitude: 24.8996,
    longitude: 91.8542,
    contactPerson: 'Shamsul Alam',
    contactPhone: '+8801850000002',
    urgency: RequestUrgency.NORMAL,
    status: RequestStatus.PENDING,
    hoursUntilRequired: 36,
    details: 'New request queued in admin inbox: routine blood replacement for elective gallbladder surgery.',
  },

  // 21. Cumilla - Medical Center (B_POSITIVE, NORMAL, APPROVED)
  {
    requesterEmail: 'requester.roksana@pulsebridge.com',
    patientName: 'Mizanur Rahman',
    bloodGroup: BloodGroup.B_POSITIVE,
    unitsRequired: 2,
    fulfilledUnits: 0,
    hospitalName: 'Cumilla Medical Center (Tower Hospital)',
    hospitalAddress: 'Laksam Road, Kandirpar, Cumilla 3500',
    area: 'Kandirpar',
    city: 'Cumilla',
    district: 'Cumilla',
    latitude: 23.4607,
    longitude: 91.1809,
    contactPerson: 'Roksana Parveen',
    contactPhone: '+8801750000003',
    urgency: RequestUrgency.NORMAL,
    status: RequestStatus.APPROVED,
    hoursUntilRequired: 44,
    details: 'Preparation for orthopedic spinal fixation procedure scheduled this week.',
  },
];

export const seedRequests = async (): Promise<void> => {
  if (env.NODE_ENV === 'production') {
    console.warn('[Seed:Requests] Refusing to seed dummy data in production environment.');
    return;
  }

  console.log('[Seed:Requests] Commencing hospital blood requests dataset seeding...');

  const connected = await connectDatabase();
  if (!connected) {
    throw new Error('[Seed:Requests] Unable to connect to PostgreSQL.');
  }

  try {
    const demoPasswordHash = await hashPassword('DemoPassword123!');
    const now = new Date();

    // 1. Ensure all requester users exist
    const requesterMap = new Map<string, string>();
    for (const reqUser of SEED_REQUESTERS) {
      const user = await prisma.user.upsert({
        where: { email: reqUser.email },
        update: {
          name: reqUser.name,
          phone: reqUser.phone,
          role: UserRole.REQUESTER,
          status: UserStatus.ACTIVE,
          emailVerified: true,
        },
        create: {
          name: reqUser.name,
          email: reqUser.email,
          password: demoPasswordHash,
          phone: reqUser.phone,
          role: UserRole.REQUESTER,
          status: UserStatus.ACTIVE,
          emailVerified: true,
        },
      });
      requesterMap.set(reqUser.email, user.id);
      console.log(`[Seed:Requests] Verified requester account: ${user.email}`);
    }

    // 2. Iterate and upsert all 21 blood requests idempotently
    let seededCount = 0;
    for (const item of SEED_REQUESTS) {
      const requesterId = requesterMap.get(item.requesterEmail);
      if (!requesterId) {
        throw new Error(`Requester not found for ${item.requesterEmail}`);
      }

      const requiredAt = new Date(now.getTime() + item.hoursUntilRequired * 60 * 60 * 1000);

      // Check if an existing request with the same patientName, hospitalName, and requester exists
      const existingRequest = await prisma.bloodRequest.findFirst({
        where: {
          requesterId,
          patientName: item.patientName,
          hospitalName: item.hospitalName,
        },
      });

      if (existingRequest) {
        await prisma.bloodRequest.update({
          where: { id: existingRequest.id },
          data: {
            bloodGroup: item.bloodGroup,
            unitsRequired: item.unitsRequired,
            fulfilledUnits: item.fulfilledUnits ?? 0,
            hospitalAddress: item.hospitalAddress,
            area: item.area,
            city: item.city,
            district: item.district,
            latitude: item.latitude,
            longitude: item.longitude,
            contactPerson: item.contactPerson,
            contactPhone: item.contactPhone,
            urgency: item.urgency,
            status: item.status,
            requiredAt,
            details: item.details,
            approvedAt: item.status === RequestStatus.APPROVED ? new Date() : existingRequest.approvedAt,
          },
        });
      } else {
        await prisma.bloodRequest.create({
          data: {
            requesterId,
            patientName: item.patientName,
            bloodGroup: item.bloodGroup,
            unitsRequired: item.unitsRequired,
            fulfilledUnits: item.fulfilledUnits ?? 0,
            hospitalName: item.hospitalName,
            hospitalAddress: item.hospitalAddress,
            area: item.area,
            city: item.city,
            district: item.district,
            latitude: item.latitude,
            longitude: item.longitude,
            contactPerson: item.contactPerson,
            contactPhone: item.contactPhone,
            urgency: item.urgency,
            status: item.status,
            requiredAt,
            details: item.details,
            approvedAt: item.status === RequestStatus.APPROVED ? new Date() : null,
          },
        });
      }

      seededCount++;
    }

    console.log(`[Seed:Requests] Successfully ensured ${seededCount} realistic hospital blood requests across Bangladesh! 🏥`);
  } catch (error) {
    console.error('[Seed:Requests] Seeding error:', error);
    throw error;
  } finally {
    await disconnectDatabase();
  }
};

void seedRequests();
