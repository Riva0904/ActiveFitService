import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

const DEFAULT_PLANS = [
  {
    name: 'Starter',
    plan: 'STARTER' as const,
    monthlyPrice: 2999,
    yearlyPrice: 29999,
    maxMembers: 100,
    maxTrainers: 3,
    maxStaff: 2,
    maxBranches: 1,
    features: ['Member Management', 'Attendance Tracking', 'Basic Reports', 'QR Check-in'],
  },
  {
    name: 'Professional',
    plan: 'PROFESSIONAL' as const,
    monthlyPrice: 7999,
    yearlyPrice: 79999,
    maxMembers: 500,
    maxTrainers: 10,
    maxStaff: 5,
    maxBranches: 3,
    features: ['Everything in Starter', 'Trainer Management', 'Workout & Diet Plans', 'Payments & Invoices', 'Push Notifications'],
  },
  {
    name: 'Enterprise',
    plan: 'ENTERPRISE' as const,
    monthlyPrice: 19999,
    yearlyPrice: 199999,
    maxMembers: 9999,
    maxTrainers: 50,
    maxStaff: 20,
    maxBranches: 10,
    features: ['Everything in Professional', 'Multi-Branch Management', 'Advanced Analytics', 'Priority Support', 'Custom Branding'],
  },
];

@Injectable()
export class SaasPlansService {
  constructor(private prisma: PrismaService) {}

  // Plans change rarely (admin-edited tiers) but are read on every pricing/limit check.
  // Simple in-memory TTL cache — single-instance only; if this ever runs multi-instance,
  // replace with a shared cache (Redis) so instances don't serve stale data after an update.
  private cachedPlans: { data: any[]; expiresAt: number } | null = null;
  private readonly CACHE_TTL_MS = 5 * 60 * 1000;

  async findAll() {
    if (this.cachedPlans && this.cachedPlans.expiresAt > Date.now()) {
      return this.cachedPlans.data;
    }
    const data = await this.prisma.saaSSubscriptionPlan.findMany({
      orderBy: { monthlyPrice: 'asc' },
    });
    this.cachedPlans = { data, expiresAt: Date.now() + this.CACHE_TTL_MS };
    return data;
  }

  async initDefaults() {
    await Promise.all(
      DEFAULT_PLANS.map(p =>
        this.prisma.saaSSubscriptionPlan.upsert({
          where: { plan: p.plan },
          update: {},
          create: p,
        }),
      ),
    );
    this.cachedPlans = null;
    return this.prisma.saaSSubscriptionPlan.findMany({ orderBy: { monthlyPrice: 'asc' } });
  }

  async findOne(id: string) {
    const plan = await this.prisma.saaSSubscriptionPlan.findUnique({ where: { id } });
    if (!plan) throw new NotFoundException('Plan not found');
    return plan;
  }

  async update(id: string, data: any) {
    await this.findOne(id);
    const { name, plan, createdAt, updatedAt, gymSubscriptions, id: _id, ...updateData } = data;
    const updated = await this.prisma.saaSSubscriptionPlan.update({ where: { id }, data: updateData });
    this.cachedPlans = null;
    return updated;
  }

  async getPlatformRevenue() {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfYear = new Date(now.getFullYear(), 0, 1);

    const [thisMonth, thisYear, allTime] = await Promise.all([
      (this.prisma.payment as any).aggregate({
        where: { status: 'COMPLETED', paidAt: { gte: startOfMonth } },
        _sum: { platformCommission: true },
      }),
      (this.prisma.payment as any).aggregate({
        where: { status: 'COMPLETED', paidAt: { gte: startOfYear } },
        _sum: { platformCommission: true },
      }),
      (this.prisma.payment as any).aggregate({
        where: { status: 'COMPLETED' },
        _sum: { platformCommission: true },
      }),
    ]);

    // Per SaaS tier breakdown
    const plans: any[] = await (this.prisma.saaSSubscriptionPlan as any).findMany({ select: { id: true, name: true, plan: true, commissionPct: true } });
    const tierBreakdown = await Promise.all(
      plans.map(async (p: any) => {
        const gyms = await this.prisma.gymSubscription.findMany({
          where: { planId: p.id, status: 'ACTIVE' },
          select: { gymId: true },
        });
        const gymIds = gyms.map(g => g.gymId);
        const agg: any = gymIds.length > 0
          ? await (this.prisma.payment as any).aggregate({
              where: { gymId: { in: gymIds }, status: 'COMPLETED' },
              _sum: { platformCommission: true },
            })
          : { _sum: { platformCommission: null } };
        return { tier: p.plan, name: p.name, commissionPct: p.commissionPct, totalCommission: agg._sum.platformCommission ?? 0, gymCount: gymIds.length };
      }),
    );

    return {
      thisMonth: thisMonth._sum.platformCommission ?? 0,
      thisYear: thisYear._sum.platformCommission ?? 0,
      allTime: allTime._sum.platformCommission ?? 0,
      tierBreakdown,
    };
  }
}
