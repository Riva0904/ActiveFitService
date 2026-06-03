import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PaymentsService } from '../payments/payments.service';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class WorkoutPlansService {
  constructor(
    private prisma: PrismaService,
    private paymentsService: PaymentsService,
    private notificationsService: NotificationsService,
  ) {}

  // ── Member's assigned workout plans ──────────────────────────────────────

  async findByUser(userId: string, gymId: string) {
    const member = await this.prisma.member.findFirst({ where: { userId, gymId } });
    if (!member) return [];

    return this.prisma.workoutAssignment.findMany({
      where: { memberId: member.id, gymId, isActive: true },
      include: { workoutPlan: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async generateAiPlan(userId: string, gymId: string, goal: string, level: string) {
    const member = await this.prisma.member.findFirst({ where: { userId, gymId } });
    const aiPlan = {
      name: `AI ${goal} Workout Plan`,
      goal,
      difficulty: level?.toUpperCase() ?? 'BEGINNER',
      durationWeeks: 4,
      isAiGenerated: true,
      gymId,
      trainerId: null,
      exercises: [
        { day: 'Monday', name: 'Push-ups', sets: 3, reps: 15, rest: 60 },
        { day: 'Wednesday', name: 'Squats', sets: 4, reps: 12, rest: 90 },
        { day: 'Friday', name: 'Pull-ups', sets: 3, reps: 10, rest: 60 },
      ],
    };

    const plan = await this.prisma.workoutPlan.create({ data: aiPlan });

    if (member) {
      await this.prisma.workoutAssignment.create({
        data: {
          workoutPlanId: plan.id,
          memberId: member.id,
          gymId,
          startDate: new Date(),
          isActive: true,
        },
      });

      await this.notificationsService.create({
        userId: member.userId,
        gymId,
        title: 'Workout Plan Assigned',
        message: `Your AI workout plan "${plan.name}" is now active. Head to Workouts to see your schedule.`,
        type: 'GENERAL',
      });
    }

    return plan;
  }

  async update(id: string, data: any, gymId: string) {
    const plan = await this.prisma.workoutPlan.findFirst({ where: { id, gymId } });
    if (!plan) throw new NotFoundException('Workout plan not found');
    return this.prisma.workoutPlan.update({ where: { id }, data });
  }

  // ── Premium Workout Plan Packages ─────────────────────────────────────────

  async listPackages(gymId: string) {
    return (this.prisma.workoutPlan as any).findMany({
      where: { gymId, isPremium: true, deletedAt: null },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createPackage(data: any, gymId: string, trainerId?: string) {
    const gym = await this.prisma.gym.findUnique({ where: { id: gymId }, select: { saasPlan: true } });
    if (gym?.saasPlan === 'STARTER') {
      throw new ForbiddenException('Upgrade to Professional or Enterprise to create premium workout plans');
    }

    return (this.prisma.workoutPlan as any).create({
      data: {
        gymId,
        trainerId: trainerId ?? null,
        name: data.name,
        goal: data.goal ?? 'General',
        difficulty: data.difficulty ?? 'BEGINNER',
        durationWeeks: data.durationWeeks ?? 4,
        exercises: data.exercises ?? [],
        isPremium: true,
        price: data.price,
        durationDays: data.durationDays ?? 30,
        description: data.description ?? null,
        isTemplate: true,
      },
    });
  }

  async updatePackage(id: string, data: any, gymId: string) {
    const plan = await (this.prisma.workoutPlan as any).findFirst({ where: { id, gymId, isPremium: true, deletedAt: null } });
    if (!plan) throw new NotFoundException('Premium workout plan not found');
    const { name, goal, description, price, durationDays, durationWeeks, difficulty } = data;
    return (this.prisma.workoutPlan as any).update({ where: { id }, data: { name, goal, description, price, durationDays, durationWeeks, difficulty } });
  }

  async purchasePackage(planId: string, userId: string, gymId: string) {
    const plan: any = await (this.prisma.workoutPlan as any).findFirst({ where: { id: planId, gymId, isPremium: true, deletedAt: null } });
    if (!plan) throw new NotFoundException('Workout plan not found');
    if (!plan.price || plan.price <= 0) throw new ForbiddenException('This plan is not available for purchase');

    const orderResult = await this.paymentsService.createRazorpayOrder(plan.price, userId, gymId, 'WORKOUT_PLAN');
    await (this.prisma.payment as any).update({ where: { id: orderResult.paymentId }, data: { workoutPlanId: planId } });

    return orderResult;
  }

  async assignPlanToMember(memberId: string, workoutPlanId: string, gymId: string) {
    const plan: any = await (this.prisma.workoutPlan as any).findFirst({ where: { id: workoutPlanId, gymId } });
    if (!plan) throw new NotFoundException('Workout plan not found');

    const assignment = await this.prisma.workoutAssignment.create({
      data: {
        workoutPlanId,
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
        title: 'Workout Plan Assigned',
        message: `Your workout plan "${plan.name}" is now active. Head to Workouts to see your schedule.`,
        type: 'GENERAL',
      });
    }

    return assignment;
  }
}
