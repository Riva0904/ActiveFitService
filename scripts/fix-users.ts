import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // Mark all seed users as email verified so login works immediately
  const result = await prisma.user.updateMany({
    where: {
      email: {
        in: [
          'superadmin@activeboost.com',
          'admin@fitnesshub.com',
          'user@example.com',
        ],
      },
    },
    data: { isEmailVerified: true },
  });

  console.log(`✅ Updated ${result.count} users - email verified`);

  // Show current users
  const users = await prisma.user.findMany({
    select: { email: true, role: true, isEmailVerified: true, isActive: true },
  });
  console.table(users);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
