// Global permission catalog seed.
// This seeds the platform-wide Permission table (business-independent).
// Business-specific Role rows + RolePermission links are created at
// business-registration time by RolesService.seedDefaultRoles(), because
// roles are business-scoped in this schema (see prisma/schema.prisma).
//
// Run with: npm run prisma:seed  (wraps `ts-node prisma/seed.ts`)

import { PrismaClient } from '@prisma/client';
import { ALL_PERMISSION_KEYS } from '../src/common/constants/permissions.constant';

const prisma = new PrismaClient();

async function main() {
  console.log(`Seeding ${ALL_PERMISSION_KEYS.length} permissions...`);

  for (const key of ALL_PERMISSION_KEYS) {
    await prisma.permission.upsert({
      where: { key },
      update: {},
      create: { key },
    });
  }

  console.log('Permission catalog seeded successfully.');
}

main()
  .catch((err) => {
    console.error('Seed failed:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
