import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  const hashedPassword = await bcrypt.hash('Password@123', 12);

  // ── SaaS Plans ────────────────────────────────────────────────────────────
  const starterPlan = await prisma.saaSSubscriptionPlan.upsert({
    where: { plan: 'STARTER' },
    update: {},
    create: {
      name: 'Starter',
      plan: 'STARTER',
      monthlyPrice: 999,
      yearlyPrice: 9999,
      maxMembers: 100,
      maxTrainers: 3,
      maxStaff: 2,
      maxBranches: 1,
      features: ['Member Management', 'Attendance', 'Basic Reports'],
    },
  });

  const proPlan = await prisma.saaSSubscriptionPlan.upsert({
    where: { plan: 'PROFESSIONAL' },
    update: {},
    create: {
      name: 'Professional',
      plan: 'PROFESSIONAL',
      monthlyPrice: 2499,
      yearlyPrice: 24999,
      maxMembers: 500,
      maxTrainers: 10,
      maxStaff: 5,
      maxBranches: 3,
      features: ['Everything in Starter', 'Trainer Management', 'Workout/Diet Plans', 'Payments', 'Notifications'],
    },
  });

  await prisma.saaSSubscriptionPlan.upsert({
    where: { plan: 'ENTERPRISE' },
    update: {},
    create: {
      name: 'Enterprise',
      plan: 'ENTERPRISE',
      monthlyPrice: 4999,
      yearlyPrice: 49999,
      maxMembers: 9999,
      maxTrainers: 50,
      maxStaff: 20,
      maxBranches: 10,
      features: ['Everything in Professional', 'Multi-Branch', 'Advanced Analytics', 'Priority Support'],
    },
  });

  // ── Super Admin ───────────────────────────────────────────────────────────
  const superAdmin = await prisma.user.upsert({
    where: { email: 'superadmin@activeboost.com' },
    update: {},
    create: {
      email: 'superadmin@activeboost.com',
      firstName: 'Super',
      lastName: 'Admin',
      password: hashedPassword,
      role: 'SUPER_ADMIN',
      isActive: true,
      isEmailVerified: true,
    },
  });

  // ── Demo Gym ──────────────────────────────────────────────────────────────
  const gym = await prisma.gym.upsert({
    where: { email: 'info@fitnesshub.com' },
    update: { deletedAt: null, status: 'ACTIVE', saasStatus: 'ACTIVE' },
    create: {
      name: 'FitnessHub Premium',
      slug: 'fitnesshub-premium',
      email: 'info@fitnesshub.com',
      phone: '+91 9876543210',
      address: '123 Fitness Street, Koramangala',
      city: 'Bangalore',
      state: 'Karnataka',
      pincode: '560034',
      status: 'ACTIVE',
      saasPlan: 'PROFESSIONAL',
      saasStatus: 'ACTIVE',
      saasExpiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
      maxMembers: 500,
      amenities: ['Parking', 'Locker Room', 'AC', 'Sauna', 'Swimming Pool', 'Cardio Zone', 'Free Weights'],
      openTime: '05:00',
      closeTime: '23:00',
      workingDays: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
    },
  });

  await prisma.gymSubscription.upsert({
    where: { id: 'seed-gym-sub-001' },
    update: {},
    create: {
      id: 'seed-gym-sub-001',
      gymId: gym.id,
      planId: proPlan.id,
      status: 'ACTIVE',
      startDate: new Date(),
      endDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
      amount: 24999,
    },
  });

  // ── Gym Admin ─────────────────────────────────────────────────────────────
  const adminUser = await prisma.user.upsert({
    where: { email: 'admin@fitnesshub.com' },
    update: {},
    create: {
      email: 'admin@fitnesshub.com',
      firstName: 'Raj',
      lastName: 'Kumar',
      password: hashedPassword,
      role: 'GYM_ADMIN',
      gymId: gym.id,
      isActive: true,
      isEmailVerified: true,
    },
  });

  // ── Staff ─────────────────────────────────────────────────────────────────
  const staffUser = await prisma.user.upsert({
    where: { email: 'staff@fitnesshub.com' },
    update: {},
    create: {
      email: 'staff@fitnesshub.com',
      firstName: 'Priya',
      lastName: 'Sharma',
      password: hashedPassword,
      role: 'STAFF',
      gymId: gym.id,
      phone: '+91 9876543212',
      isActive: true,
      isEmailVerified: true,
    },
  });

  await prisma.staff.upsert({
    where: { userId: staffUser.id },
    update: {},
    create: {
      userId: staffUser.id,
      gymId: gym.id,
      employeeId: 'EMP001',
      designation: 'Front Desk Executive',
      department: 'Operations',
      joiningDate: new Date(),
      salary: 25000,
    },
  });

  // ── Trainer ───────────────────────────────────────────────────────────────
  const trainerUser = await prisma.user.upsert({
    where: { email: 'trainer@fitnesshub.com' },
    update: {},
    create: {
      email: 'trainer@fitnesshub.com',
      firstName: 'Vikram',
      lastName: 'Singh',
      password: hashedPassword,
      role: 'TRAINER',
      gymId: gym.id,
      phone: '+91 9876543213',
      isActive: true,
      isEmailVerified: true,
    },
  });

  await prisma.trainer.upsert({
    where: { userId: trainerUser.id },
    update: {},
    create: {
      userId: trainerUser.id,
      gymId: gym.id,
      employeeId: 'TRN001',
      specializations: ['Weight Training', 'HIIT', 'CrossFit'],
      certifications: ['ACE Certified', 'NASM-CPT'],
      experience: 5,
      bio: 'Certified personal trainer with 5 years of experience.',
      rating: 4.8,
      hourlyRate: 800,
      isAvailable: true,
    },
  });

  // ── Membership Plans ──────────────────────────────────────────────────────
  const monthlyPlan = await prisma.membershipPlan.upsert({
    where: { id: 'seed-plan-monthly' },
    update: {},
    create: {
      id: 'seed-plan-monthly',
      gymId: gym.id,
      name: 'Monthly Basic',
      type: 'MONTHLY',
      durationMonths: 1,
      price: 1500,
      discount: 0,
      features: ['Gym Access', 'Locker', 'Basic Cardio'],
      isActive: true,
    },
  });

  await prisma.membershipPlan.upsert({
    where: { id: 'seed-plan-quarterly' },
    update: {},
    create: {
      id: 'seed-plan-quarterly',
      gymId: gym.id,
      name: 'Quarterly Premium',
      type: 'QUARTERLY',
      durationMonths: 3,
      price: 3999,
      discount: 500,
      features: ['Gym Access', 'Locker', 'All Equipment', 'Trainer Consultation'],
      isActive: true,
    },
  });

  await prisma.membershipPlan.upsert({
    where: { id: 'seed-plan-yearly' },
    update: {},
    create: {
      id: 'seed-plan-yearly',
      gymId: gym.id,
      name: 'Annual Elite',
      type: 'YEARLY',
      durationMonths: 12,
      price: 12999,
      discount: 3000,
      features: ['Gym Access', 'Locker', 'All Equipment', 'Personal Trainer', 'Diet Plan', 'Progress Tracking'],
      isActive: true,
    },
  });

  // ── Member ────────────────────────────────────────────────────────────────
  const memberUser = await prisma.user.upsert({
    where: { email: 'member@fitnesshub.com' },
    update: {},
    create: {
      email: 'member@fitnesshub.com',
      firstName: 'Ajith',
      lastName: 'Kumar',
      password: hashedPassword,
      role: 'MEMBER',
      phone: '+91 9876543214',
      gymId: gym.id,
      isActive: true,
      isEmailVerified: true,
    },
  });

  const member = await prisma.member.upsert({
    where: { userId: memberUser.id },
    update: {},
    create: {
      userId: memberUser.id,
      gymId: gym.id,
      memberCode: 'FH001',
      qrToken: uuidv4(),
      bloodGroup: 'O+',
      fitnessGoals: 'Weight Loss and Muscle Gain',
      joinDate: new Date(),
    },
  });

  await prisma.memberSubscription.upsert({
    where: { id: 'seed-member-sub-001' },
    update: {},
    create: {
      id: 'seed-member-sub-001',
      memberId: member.id,
      gymId: gym.id,
      planId: monthlyPlan.id,
      status: 'ACTIVE',
      startDate: new Date(),
      endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      amount: 1500,
    },
  });

  await prisma.payment.create({
    data: {
      memberId: member.id,
      gymId: gym.id,
      subscriptionId: 'seed-member-sub-001',
      type: 'MEMBERSHIP',
      amount: 1500,
      status: 'COMPLETED',
      method: 'CASH',
      paidAt: new Date(),
    },
  }).catch(() => {});

  console.log('\n✅ Database seeded successfully!\n');
  console.log('┌─────────────────────────────────────────────────────────────┐');
  console.log('│                    TEST CREDENTIALS                         │');
  console.log('├─────────────────────────────────────────────────────────────┤');
  console.log('│ Super Admin  → superadmin@activeboost.com / Password@123    │');
  console.log('│ Gym Admin    → admin@fitnesshub.com / Password@123          │');
  console.log('│ Staff        → staff@fitnesshub.com / Password@123          │');
  console.log('│ Trainer      → trainer@fitnesshub.com / Password@123        │');
  console.log('│ Member       → member@fitnesshub.com / Password@123         │');
  console.log('└─────────────────────────────────────────────────────────────┘\n');
}

main()
  .catch((e) => { console.error('Seed failed:', e); process.exit(1); })
  .finally(() => prisma.$disconnect());
