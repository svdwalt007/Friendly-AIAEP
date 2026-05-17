import { PrismaClient, Prisma, Tier } from '@prisma/client';

const prisma = new PrismaClient();

interface OverageRates {
  perDevice?: number;
  perApiCall?: number;
  perGb?: number;
  notes?: string;
}

interface PlanFeatures {
  deviceLimit: number | null; // null = unlimited
  apiCallLimit: number | null; // null = unlimited
  storageGb: number;
  overageRates: OverageRates;
  prioritySupport: boolean;
  customBranding: boolean;
  dedicatedAccount: boolean;
  sla: string;
}

interface BillingPlanSeedData {
  name: string;
  tier: Tier;
  price: Prisma.Decimal | number;
  currency: string;
  billingCycle: string;
  maxProjects: number;
  maxUsers: number;
  features: PlanFeatures;
  isActive: boolean;
}

const billingPlansData: BillingPlanSeedData[] = [
  {
    name: 'Starter Plan',
    tier: Tier.STARTER,
    price: new Prisma.Decimal(499),
    currency: 'USD',
    billingCycle: 'monthly',
    maxProjects: 5,
    maxUsers: 10,
    features: {
      deviceLimit: 100,
      apiCallLimit: 100000, // 100K
      storageGb: 10,
      overageRates: {
        perDevice: 5.0,
        perApiCall: 0.001,
        perGb: 0.1,
      },
      prioritySupport: false,
      customBranding: false,
      dedicatedAccount: false,
      sla: 'Best effort',
    },
    isActive: true,
  },
  {
    name: 'Professional Plan',
    tier: Tier.PROFESSIONAL,
    price: new Prisma.Decimal(2499),
    currency: 'USD',
    billingCycle: 'monthly',
    maxProjects: 25,
    maxUsers: 50,
    features: {
      deviceLimit: 500,
      apiCallLimit: 1000000, // 1M
      storageGb: 100,
      overageRates: {
        perDevice: 4.0,
        perApiCall: 0.0008,
        perGb: 0.08,
      },
      prioritySupport: true,
      customBranding: true,
      dedicatedAccount: false,
      sla: '99.5% uptime',
    },
    isActive: true,
  },
  {
    name: 'Enterprise Plan',
    tier: Tier.ENTERPRISE,
    price: new Prisma.Decimal(7999),
    currency: 'USD',
    billingCycle: 'monthly',
    maxProjects: -1, // unlimited (represented as -1)
    maxUsers: -1, // unlimited (represented as -1)
    features: {
      deviceLimit: null, // unlimited
      apiCallLimit: null, // unlimited
      storageGb: 1024, // 1TB
      overageRates: {
        notes: 'Custom pricing available. Contact sales for volume discounts.',
      },
      prioritySupport: true,
      customBranding: true,
      dedicatedAccount: true,
      sla: '99.9% uptime with dedicated support',
    },
    isActive: true,
  },
];

async function seedBillingPlans() {
  console.log('🌱 Seeding billing plans...');

  for (const planData of billingPlansData) {
    try {
      // Check if plan already exists by tier (unique constraint)
      const existingPlan = await prisma.billingPlan.findUnique({
        where: { tier: planData.tier },
      });

      if (existingPlan) {
        console.log(`  ✓ Billing plan "${planData.name}" (${planData.tier}) already exists, updating...`);

        // Update existing plan to ensure data is current
        await prisma.billingPlan.update({
          where: { tier: planData.tier },
          data: {
            name: planData.name,
            price: planData.price,
            currency: planData.currency,
            billingCycle: planData.billingCycle,
            maxProjects: planData.maxProjects,
            maxUsers: planData.maxUsers,
            features: planData.features as Prisma.InputJsonValue,
            isActive: planData.isActive,
          },
        });

        console.log(`  ✓ Updated billing plan: ${planData.name}`);
      } else {
        // Create new plan
        await prisma.billingPlan.create({
          data: {
            name: planData.name,
            tier: planData.tier,
            price: planData.price,
            currency: planData.currency,
            billingCycle: planData.billingCycle,
            maxProjects: planData.maxProjects,
            maxUsers: planData.maxUsers,
            features: planData.features as Prisma.InputJsonValue,
            isActive: planData.isActive,
          },
        });

        console.log(`  ✓ Created billing plan: ${planData.name}`);
      }
    } catch (error) {
      console.error(`  ✗ Error processing billing plan "${planData.name}":`, error);
      throw error;
    }
  }

  console.log('✅ Billing plans seeded successfully!');
}

async function seedDemoData() {
  console.log('🌱 Seeding demo tenant, user, and project...');

  // Create or get demo tenant
  const tenant = await prisma.tenant.upsert({
    where: { subdomain: 'demo' },
    create: {
      name: 'Demo Tenant',
      subdomain: 'demo',
      tier: Tier.PROFESSIONAL,
      maxProjects: 25,
      maxUsers: 50,
    },
    update: {},
  });
  console.log(`  ✓ Demo tenant: ${tenant.name} (${tenant.id})`);

  // Create or get demo user
  const user = await prisma.user.upsert({
    where: { email: 'demo@friendly-tech.com' },
    create: {
      email: 'demo@friendly-tech.com',
      name: 'Demo User',
      tenantId: tenant.id,
      passwordHash: '$2a$10$demohashdemohashdemohashdemohashdemohashdemohashdemo', // Demo hash
      role: 'ADMIN',
      isActive: true,
    },
    update: {},
  });
  console.log(`  ✓ Demo user: ${user.name} (${user.id})`);

  // Create or get demo project
  const project = await prisma.project.upsert({
    where: { name: 'My First IoT App' },
    create: {
      name: 'My First IoT App',
      description: 'A sample IoT dashboard application for monitoring devices',
      tenantId: tenant.id,
      ownerId: user.id,
      status: 'ACTIVE',
      config: {
        framework: 'angular',
        version: '21.0.0',
        features: ['device-monitoring', 'real-time-charts', 'alerts'],
      },
    },
    update: {},
  });
  console.log(`  ✓ Demo project: ${project.name} (${project.id})`);

  console.log('✅ Demo data seeded successfully!');
}

async function main() {
  console.log('🚀 Starting database seed...\n');

  try {
    await seedBillingPlans();
    await seedDemoData();

    console.log('\n✅ Database seed completed successfully!');
  } catch (error) {
    console.error('\n❌ Error during database seed:', error);
    throw error;
  }
}

// Execute main function
main()
  .catch((error) => {
    console.error('Fatal error during seed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

// Export for programmatic use
export { main };
