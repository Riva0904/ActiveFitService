import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PaymentsService } from '../payments/payments.service';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class DietPlansService {
  constructor(
    private prisma: PrismaService,
    private paymentsService: PaymentsService,
    private notificationsService: NotificationsService,
  ) {}

  // ── Member's assigned diet plans ──────────────────────────────────────────

  async findByUser(userId: string, gymId: string) {
    const member = await this.prisma.member.findFirst({ where: { userId, gymId } });
    if (!member) return [];

    return this.prisma.dietAssignment.findMany({
      where: { memberId: member.id, gymId, isActive: true },
      include: { dietPlan: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async generateAiDiet(userId: string, gymId: string, goal: string, calories: number) {
    const member = await this.prisma.member.findFirst({ where: { userId, gymId } });
    const aiPlan = {
      name: `AI ${goal} Diet Plan`,
      goal,
      totalCalories: calories,
      isAiGenerated: true,
      gymId,
      trainerId: null,
      meals: [
        { meal: 'Breakfast', items: ['Oats with milk', 'Banana', '2 Eggs'], calories: Math.round(calories * 0.25) },
        { meal: 'Lunch', items: ['Brown rice', 'Grilled chicken', 'Salad'], calories: Math.round(calories * 0.35) },
        { meal: 'Snack', items: ['Protein shake', 'Almonds'], calories: Math.round(calories * 0.15) },
        { meal: 'Dinner', items: ['Quinoa', 'Fish', 'Vegetables'], calories: Math.round(calories * 0.25) },
      ],
      restrictions: [],
    };
    const plan = await this.prisma.dietPlan.create({ data: aiPlan });

    if (member) {
      await this.prisma.dietAssignment.create({
        data: {
          dietPlanId: plan.id,
          memberId: member.id,
          gymId,
          startDate: new Date(),
          isActive: true,
        },
      });

      await this.notificationsService.create({
        userId: member.userId,
        gymId,
        title: 'Diet Plan Assigned',
        message: `Your AI diet plan "${plan.name}" is now active. Check the Diet Plans section to view your meals.`,
        type: 'GENERAL',
      });
    }

    return plan;
  }

  // ── Premium Diet Plan Packages ────────────────────────────────────────────

  async listPackages(gymId: string) {
    return (this.prisma.dietPlan as any).findMany({
      where: { gymId, isPremium: true, deletedAt: null },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createPackage(data: any, gymId: string, trainerId?: string) {
    const gym = await this.prisma.gym.findUnique({ where: { id: gymId }, select: { saasPlan: true } });
    if (gym?.saasPlan === 'STARTER') {
      throw new ForbiddenException('Upgrade to Professional or Enterprise to create premium diet plans');
    }

    return (this.prisma.dietPlan as any).create({
      data: {
        gymId,
        trainerId: trainerId ?? null,
        name: data.name,
        goal: data.goal ?? 'General',
        totalCalories: data.totalCalories ?? null,
        meals: data.meals ?? [],
        restrictions: data.restrictions ?? [],
        isPremium: true,
        price: data.price,
        durationDays: data.durationDays ?? 30,
        description: data.description ?? null,
        isTemplate: true,
      },
    });
  }

  async updatePackage(id: string, data: any, gymId: string) {
    const plan = await (this.prisma.dietPlan as any).findFirst({ where: { id, gymId, isPremium: true, deletedAt: null } });
    if (!plan) throw new NotFoundException('Premium diet plan not found');
    const { name, goal, description, price, durationDays, totalCalories, restrictions } = data;
    return (this.prisma.dietPlan as any).update({ where: { id }, data: { name, goal, description, price, durationDays, totalCalories, restrictions } });
  }

  async purchasePackage(planId: string, userId: string, gymId: string, useUpi = false) {
    const plan: any = await (this.prisma.dietPlan as any).findFirst({ where: { id: planId, gymId, isPremium: true, deletedAt: null } });
    if (!plan) throw new NotFoundException('Diet plan not found');
    if (!plan.price || plan.price <= 0) throw new ForbiddenException('This plan is not available for purchase');

    const orderResult = await this.paymentsService.createRazorpayOrder(plan.price, userId, gymId, 'DIET_PLAN', undefined, undefined, undefined, useUpi);
    // Store dietPlanId on the payment for post-payment actions
    await (this.prisma.payment as any).update({ where: { id: orderResult.paymentId }, data: { dietPlanId: planId } });

    return orderResult;
  }

  async assignPlanToMember(memberId: string, dietPlanId: string, gymId: string) {
    const plan: any = await (this.prisma.dietPlan as any).findFirst({ where: { id: dietPlanId, gymId } });
    if (!plan) throw new NotFoundException('Diet plan not found');

    const assignment = await this.prisma.dietAssignment.create({
      data: {
        dietPlanId,
        memberId,
        gymId,
        startDate: new Date(),
        endDate: plan.durationDays ? new Date(Date.now() + plan.durationDays * 86400000) : undefined,
        isActive: true,
      },
    });

    const member = await this.prisma.member.findUnique({ where: { id: memberId }, select: { userId: true } });
    if (member) {
      await this.notificationsService.create({
        userId: member.userId,
        gymId,
        title: 'Diet Plan Assigned',
        message: `Your diet plan "${plan.name}" is now active. Check the Diet Plans section to view your meals.`,
        type: 'GENERAL',
      });
    }

    return assignment;
  }
}
