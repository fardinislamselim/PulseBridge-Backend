import { prisma, connectDatabase, disconnectDatabase } from '../src/config/database.js';
import { env } from '../src/config/env.js';
import { hashPassword } from '../src/utils/password.js';
import { UserRole, UserStatus, BloodGroup } from '../src/generated/prisma/enums.js';

interface SeedDonorItem {
  name: string;
  email: string;
  phone: string;
  bloodGroup: BloodGroup;
  gender: string;
  address: string;
  area: string;
  city: string;
  district: string;
  latitude: number;
  longitude: number;
  isAvailable: boolean;
  hasMedicalRestriction?: boolean;
  medicalRestrictionReason?: string | null;
  lastDonationDaysAgo?: number; // if specified, donation was X days ago, eligible in (90 - X) days
}

// 24+ diverse realistic Bangladeshi voluntary donors across all 8 blood groups
const SEED_DONORS: SeedDonorItem[] = [
  // 1. O_POSITIVE (Dhaka - Dhanmondi) - Available
  {
    name: 'Tanvir Hasan',
    email: 'donor.tanvir@pulsebridge.com',
    phone: '+8801712000001',
    bloodGroup: BloodGroup.O_POSITIVE,
    gender: 'Male',
    address: 'House 42, Road 7/A, Dhanmondi',
    area: 'Dhanmondi',
    city: 'Dhaka',
    district: 'Dhaka',
    latitude: 23.7465,
    longitude: 90.3760,
    isAvailable: true,
  },
  // 2. O_POSITIVE (Chattogram - Panchlaish) - Available
  {
    name: 'Nusrat Jahan',
    email: 'donor.nusrat@pulsebridge.com',
    phone: '+8801819000002',
    bloodGroup: BloodGroup.O_POSITIVE,
    gender: 'Female',
    address: 'Flat 4B, Equity Heights, Panchlaish R/A',
    area: 'Panchlaish',
    city: 'Chattogram',
    district: 'Chattogram',
    latitude: 22.3685,
    longitude: 91.8315,
    isAvailable: true,
  },
  // 3. O_POSITIVE (Rajshahi - Shaheb Bazar) - Cooldown (donated 20 days ago, eligible in 70 days)
  {
    name: 'Kamrul Islam',
    email: 'donor.kamrul@pulsebridge.com',
    phone: '+8801713000003',
    bloodGroup: BloodGroup.O_POSITIVE,
    gender: 'Male',
    address: 'Holding 14, Shaheb Bazar Road, Boalia',
    area: 'Shaheb Bazar',
    city: 'Rajshahi',
    district: 'Rajshahi',
    latitude: 24.3636,
    longitude: 88.6000,
    isAvailable: false,
    lastDonationDaysAgo: 20,
  },

  // 4. O_NEGATIVE (Dhaka - Uttara) - Available
  {
    name: 'Sabrina Mostafa',
    email: 'donor.sabrina@pulsebridge.com',
    phone: '+8801714000004',
    bloodGroup: BloodGroup.O_NEGATIVE,
    gender: 'Female',
    address: 'Sector 4, Road 18, House 11, Uttara',
    area: 'Uttara',
    city: 'Dhaka',
    district: 'Dhaka',
    latitude: 23.8759,
    longitude: 90.3795,
    isAvailable: true,
  },
  // 5. O_NEGATIVE (Sylhet - Zindabazar) - Available
  {
    name: 'Mahbubur Rahman',
    email: 'donor.mahbub@pulsebridge.com',
    phone: '+8801715000005',
    bloodGroup: BloodGroup.O_NEGATIVE,
    gender: 'Male',
    address: 'Al-Hamra Tower Lane, Zindabazar',
    area: 'Zindabazar',
    city: 'Sylhet',
    district: 'Sylhet',
    latitude: 24.8949,
    longitude: 91.8687,
    isAvailable: true,
  },
  // 6. O_NEGATIVE (Khulna - Sonadanga) - Available
  {
    name: 'Farzana Akter',
    email: 'donor.farzana@pulsebridge.com',
    phone: '+8801816000006',
    bloodGroup: BloodGroup.O_NEGATIVE,
    gender: 'Female',
    address: 'Mojid Sharani, Sonadanga R/A',
    area: 'Sonadanga',
    city: 'Khulna',
    district: 'Khulna',
    latitude: 22.8228,
    longitude: 89.5445,
    isAvailable: true,
  },

  // 7. A_POSITIVE (Dhaka - Mirpur) - Available
  {
    name: 'Arif Chowdhury',
    email: 'donor.arif@pulsebridge.com',
    phone: '+8801717000007',
    bloodGroup: BloodGroup.A_POSITIVE,
    gender: 'Male',
    address: 'Section 10, Block C, Mirpur',
    area: 'Mirpur',
    city: 'Dhaka',
    district: 'Dhaka',
    latitude: 23.8071,
    longitude: 90.3686,
    isAvailable: true,
  },
  // 8. A_POSITIVE (Chattogram - Agrabad) - Available
  {
    name: 'Sadia Sultana',
    email: 'donor.sadia@pulsebridge.com',
    phone: '+8801818000008',
    bloodGroup: BloodGroup.A_POSITIVE,
    gender: 'Female',
    address: 'CDA C/A, Sheikh Mujib Road, Agrabad',
    area: 'Agrabad',
    city: 'Chattogram',
    district: 'Chattogram',
    latitude: 22.3275,
    longitude: 91.8126,
    isAvailable: true,
  },
  // 9. A_POSITIVE (Mymensingh - Medical Gate) - Cooldown (donated 25 days ago, eligible in 65 days)
  {
    name: 'Rakibul Karim',
    email: 'donor.rakib@pulsebridge.com',
    phone: '+8801719000009',
    bloodGroup: BloodGroup.A_POSITIVE,
    gender: 'Male',
    address: 'Charpara Medical Gate, Sadar',
    area: 'Medical Gate',
    city: 'Mymensingh',
    district: 'Mymensingh',
    latitude: 24.7471,
    longitude: 90.4132,
    isAvailable: false,
    lastDonationDaysAgo: 25,
  },

  // 10. A_NEGATIVE (Dhaka - Gulshan) - Available
  {
    name: 'Zubair Hossain',
    email: 'donor.zubair@pulsebridge.com',
    phone: '+8801720000010',
    bloodGroup: BloodGroup.A_NEGATIVE,
    gender: 'Male',
    address: 'Road 113, Block CES(F), Gulshan-2',
    area: 'Gulshan',
    city: 'Dhaka',
    district: 'Dhaka',
    latitude: 23.7925,
    longitude: 90.4167,
    isAvailable: true,
  },
  // 11. A_NEGATIVE (Sylhet - Amberkhana) - Available
  {
    name: 'Anika Tabassum',
    email: 'donor.anika@pulsebridge.com',
    phone: '+8801721000011',
    bloodGroup: BloodGroup.A_NEGATIVE,
    gender: 'Female',
    address: 'Housing Estate Road, Amberkhana',
    area: 'Amberkhana',
    city: 'Sylhet',
    district: 'Sylhet',
    latitude: 24.9090,
    longitude: 91.8683,
    isAvailable: true,
  },
  // 12. A_NEGATIVE (Barishal - Sadar Hospital Road) - Available
  {
    name: 'Shahriar Nazim',
    email: 'donor.shahriar@pulsebridge.com',
    phone: '+8801822000012',
    bloodGroup: BloodGroup.A_NEGATIVE,
    gender: 'Male',
    address: 'Band Road, Sadar',
    area: 'Sadar',
    city: 'Barishal',
    district: 'Barishal',
    latitude: 22.7010,
    longitude: 90.3535,
    isAvailable: true,
  },

  // 13. B_POSITIVE (Dhaka - Banani) - Available
  {
    name: 'Mehedi Hasan',
    email: 'donor.mehedi@pulsebridge.com',
    phone: '+8801723000013',
    bloodGroup: BloodGroup.B_POSITIVE,
    gender: 'Male',
    address: 'Block E, Road 11, Banani',
    area: 'Banani',
    city: 'Dhaka',
    district: 'Dhaka',
    latitude: 23.7937,
    longitude: 90.4046,
    isAvailable: true,
  },
  // 14. B_POSITIVE (Chattogram - Nasirabad) - Available
  {
    name: 'Tasnim Ahmed',
    email: 'donor.tasnim@pulsebridge.com',
    phone: '+8801824000014',
    bloodGroup: BloodGroup.B_POSITIVE,
    gender: 'Female',
    address: 'East Nasirabad Housing Society, Khulshi',
    area: 'Nasirabad',
    city: 'Chattogram',
    district: 'Chattogram',
    latitude: 22.3654,
    longitude: 91.8189,
    isAvailable: true,
  },
  // 15. B_POSITIVE (Rangpur - Medical Gate) - Available
  {
    name: 'Fahim Morshed',
    email: 'donor.fahim@pulsebridge.com',
    phone: '+8801725000015',
    bloodGroup: BloodGroup.B_POSITIVE,
    gender: 'Male',
    address: 'Dhap Medical Mor, Sadar',
    area: 'Medical Gate',
    city: 'Rangpur',
    district: 'Rangpur',
    latitude: 25.7533,
    longitude: 89.2435,
    isAvailable: true,
  },

  // 16. B_NEGATIVE (Dhaka - Mohammadpur) - Available
  {
    name: 'Tariqul Anam',
    email: 'donor.tariqul@pulsebridge.com',
    phone: '+8801726000016',
    bloodGroup: BloodGroup.B_NEGATIVE,
    gender: 'Male',
    address: 'Block C, Asad Avenue, Mohammadpur',
    area: 'Mohammadpur',
    city: 'Dhaka',
    district: 'Dhaka',
    latitude: 23.7658,
    longitude: 90.3584,
    isAvailable: true,
  },
  // 17. B_NEGATIVE (Cumilla - Kandirpar) - Available
  {
    name: 'Shamima Nasrin',
    email: 'donor.shamima@pulsebridge.com',
    phone: '+8801827000017',
    bloodGroup: BloodGroup.B_NEGATIVE,
    gender: 'Female',
    address: 'Nazrul Avenue, Kandirpar',
    area: 'Kandirpar',
    city: 'Cumilla',
    district: 'Cumilla',
    latitude: 23.4607,
    longitude: 91.1809,
    isAvailable: true,
  },
  // 18. B_NEGATIVE (Bogura - Thonthonia) - Cooldown (donated 15 days ago, eligible in 75 days)
  {
    name: 'Mustafizur Rahman',
    email: 'donor.mustafiz@pulsebridge.com',
    phone: '+8801728000018',
    bloodGroup: BloodGroup.B_NEGATIVE,
    gender: 'Male',
    address: 'Sherpur Road, Thonthonia',
    area: 'Thonthonia',
    city: 'Bogura',
    district: 'Bogura',
    latitude: 24.8387,
    longitude: 89.3735,
    isAvailable: false,
    lastDonationDaysAgo: 15,
  },

  // 19. AB_POSITIVE (Dhaka - Bashundhara R/A) - Available
  {
    name: 'Shakil Mahmud',
    email: 'donor.shakil@pulsebridge.com',
    phone: '+8801729000019',
    bloodGroup: BloodGroup.AB_POSITIVE,
    gender: 'Male',
    address: 'Block D, Road 4, Bashundhara R/A',
    area: 'Bashundhara R/A',
    city: 'Dhaka',
    district: 'Dhaka',
    latitude: 23.8151,
    longitude: 90.4255,
    isAvailable: true,
  },
  // 20. AB_POSITIVE (Chattogram - GEC Circle) - Available
  {
    name: 'Farzana Haque',
    email: 'donor.haque@pulsebridge.com',
    phone: '+8801830000020',
    bloodGroup: BloodGroup.AB_POSITIVE,
    gender: 'Female',
    address: 'O.R. Nizam Road, GEC Circle',
    area: 'GEC Circle',
    city: 'Chattogram',
    district: 'Chattogram',
    latitude: 22.3587,
    longitude: 91.8228,
    isAvailable: true,
  },
  // 21. AB_POSITIVE (Rajshahi - Laxmipur) - Available
  {
    name: 'Imtiaz Ahmed',
    email: 'donor.imtiaz@pulsebridge.com',
    phone: '+8801731000021',
    bloodGroup: BloodGroup.AB_POSITIVE,
    gender: 'Male',
    address: 'Medical College Gate Road, Laxmipur',
    area: 'Laxmipur',
    city: 'Rajshahi',
    district: 'Rajshahi',
    latitude: 24.3725,
    longitude: 88.5830,
    isAvailable: true,
  },

  // 22. AB_NEGATIVE (Dhaka - Rampura / Badda) - Available
  {
    name: 'Nayeem Ashraf',
    email: 'donor.nayeem@pulsebridge.com',
    phone: '+8801732000022',
    bloodGroup: BloodGroup.AB_NEGATIVE,
    gender: 'Male',
    address: 'DIT Road, West Rampura',
    area: 'Rampura',
    city: 'Dhaka',
    district: 'Dhaka',
    latitude: 23.7612,
    longitude: 90.4206,
    isAvailable: true,
  },
  // 23. AB_NEGATIVE (Sylhet - Kajolshah) - Available
  {
    name: 'Laila Arjumand',
    email: 'donor.laila@pulsebridge.com',
    phone: '+8801833000023',
    bloodGroup: BloodGroup.AB_NEGATIVE,
    gender: 'Female',
    address: 'Osmani Medical Gate Road, Kajolshah',
    area: 'Kajolshah',
    city: 'Sylhet',
    district: 'Sylhet',
    latitude: 24.8988,
    longitude: 91.8540,
    isAvailable: true,
  },
  // 24. AB_NEGATIVE (Khulna - Boyra) - Available
  {
    name: 'Rezaul Karim',
    email: 'donor.rezaul@pulsebridge.com',
    phone: '+8801734000024',
    bloodGroup: BloodGroup.AB_NEGATIVE,
    gender: 'Male',
    address: 'Boyra Main Road, Khalishpur',
    area: 'Boyra',
    city: 'Khulna',
    district: 'Khulna',
    latitude: 22.8465,
    longitude: 89.5310,
    isAvailable: true,
  },
  // 25. O_POSITIVE (Dhaka - Motijheel) - Available
  {
    name: 'Asaduzzaman Nur',
    email: 'donor.asad@pulsebridge.com',
    phone: '+8801735000025',
    bloodGroup: BloodGroup.O_POSITIVE,
    gender: 'Male',
    address: 'Dilkusha C/A, Motijheel',
    area: 'Motijheel',
    city: 'Dhaka',
    district: 'Dhaka',
    latitude: 23.7330,
    longitude: 90.4172,
    isAvailable: true,
  },
  // 26. B_POSITIVE (Chattogram - Halishahar) - Available
  {
    name: 'Nadia Sharmin',
    email: 'donor.nadia@pulsebridge.com',
    phone: '+8801836000026',
    bloodGroup: BloodGroup.B_POSITIVE,
    gender: 'Female',
    address: 'Housing Estate Block B, Halishahar',
    area: 'Halishahar',
    city: 'Chattogram',
    district: 'Chattogram',
    latitude: 22.3168,
    longitude: 91.7850,
    isAvailable: true,
  },
];

export const seedDonors = async (): Promise<void> => {
  if (env.NODE_ENV === 'production') {
    console.warn('[Seed:Donors] Refusing to seed dummy data in production environment.');
    return;
  }

  console.log('[Seed:Donors] Commencing voluntary donor dataset seeding...');

  const connected = await connectDatabase();
  if (!connected) {
    throw new Error('[Seed:Donors] Unable to connect to PostgreSQL.');
  }

  try {
    const demoPasswordHash = await hashPassword('DemoPassword123!');
    const now = new Date();

    // 1. Ensure existing demo donor John Doe is verified and available
    const existingJohn = await prisma.user.findUnique({
      where: { email: 'donor.john@pulsebridge.com' },
    });

    if (existingJohn) {
      await prisma.user.update({
        where: { id: existingJohn.id },
        data: {
          role: UserRole.DONOR,
          status: UserStatus.ACTIVE,
          emailVerified: true,
        },
      });

      await prisma.donorProfile.upsert({
        where: { userId: existingJohn.id },
        update: {
          bloodGroup: BloodGroup.O_POSITIVE,
          area: 'Dhanmondi',
          city: 'Dhaka',
          district: 'Dhaka',
          latitude: 23.7465,
          longitude: 90.3760,
          isAvailable: true,
          isVerified: true,
        },
        create: {
          userId: existingJohn.id,
          bloodGroup: BloodGroup.O_POSITIVE,
          gender: 'Male',
          address: 'House 12, Road 5, Dhanmondi',
          area: 'Dhanmondi',
          city: 'Dhaka',
          district: 'Dhaka',
          latitude: 23.7465,
          longitude: 90.3760,
          isAvailable: true,
          isVerified: true,
          lastDonationDate: new Date('2026-08-15T00:00:00.000Z'),
          eligibleAt: new Date('2026-11-15T00:00:00.000Z'),
        },
      });
      console.log('[Seed:Donors] Updated demo donor John Doe to isVerified=true and isAvailable=true');
    }

    // 2. Iterate and upsert all 26 donors idempotently
    let seededCount = 0;
    for (const donor of SEED_DONORS) {
      const user = await prisma.user.upsert({
        where: { email: donor.email },
        update: {
          name: donor.name,
          phone: donor.phone,
          role: UserRole.DONOR,
          status: UserStatus.ACTIVE,
          emailVerified: true,
        },
        create: {
          name: donor.name,
          email: donor.email,
          password: demoPasswordHash,
          phone: donor.phone,
          role: UserRole.DONOR,
          status: UserStatus.ACTIVE,
          emailVerified: true,
        },
      });

      let lastDonationDate: Date | null = null;
      let eligibleAt: Date | null = null;

      if (donor.lastDonationDaysAgo !== undefined) {
        lastDonationDate = new Date(now.getTime() - donor.lastDonationDaysAgo * 24 * 60 * 60 * 1000);
        // 90 days cooldown enforcement
        const daysRemaining = 90 - donor.lastDonationDaysAgo;
        eligibleAt = new Date(now.getTime() + daysRemaining * 24 * 60 * 60 * 1000);
      } else {
        // Already eligible (donated >90 days ago)
        lastDonationDate = new Date(now.getTime() - 110 * 24 * 60 * 60 * 1000);
        eligibleAt = new Date(now.getTime() - 20 * 24 * 60 * 60 * 1000);
      }

      await prisma.donorProfile.upsert({
        where: { userId: user.id },
        update: {
          bloodGroup: donor.bloodGroup,
          gender: donor.gender,
          address: donor.address,
          area: donor.area,
          city: donor.city,
          district: donor.district,
          latitude: donor.latitude,
          longitude: donor.longitude,
          isAvailable: donor.isAvailable,
          isVerified: true, // Always verified per spec
          lastDonationDate,
          eligibleAt,
        },
        create: {
          userId: user.id,
          bloodGroup: donor.bloodGroup,
          gender: donor.gender,
          address: donor.address,
          area: donor.area,
          city: donor.city,
          district: donor.district,
          latitude: donor.latitude,
          longitude: donor.longitude,
          isAvailable: donor.isAvailable,
          isVerified: true,
          lastDonationDate,
          eligibleAt,
        },
      });

      seededCount++;
    }

    console.log(`[Seed:Donors] Successfully ensured ${seededCount} realistic verified voluntary donors across Bangladesh! 🩸`);
  } catch (error) {
    console.error('[Seed:Donors] Seeding error:', error);
    throw error;
  } finally {
    await disconnectDatabase();
  }
};

void seedDonors();
