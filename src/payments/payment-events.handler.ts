import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { PrismaService } from '../prisma/prisma.service';
import { ReferralsService } from '../referrals/referrals.service';
import { PromoCodesService } from '../promo-codes/promo-codes.service';
import { PAYMENT_COMPLETED, PaymentCompletedEvent } from './events/payment.events';

@Injectable()
export class PaymentEventsHandler {
  private readonly logger = new Logger(PaymentEventsHandler.name);

  constructor(
    private prisma: PrismaService,
    private referralsService: ReferralsService,
    private promoCodesService: PromoCodesService,
  ) {}

  @OnEvent(PAYMENT_COMPLETED, { async: true })
  async handlePaymentCompleted(event: PaymentCompletedEvent) {
    try {
      await this.handleMembershipRewards(event);
    } catch (err) {
      this.logger.error(`[payment.completed] Membership rewards failed for ${event.paymentId}: ${err.message}`);
    }

    try {
      await this.handleDietPlanAssignment(event);
    } catch (err) {
      this.logger.error(`[payment.completed] Diet assignment failed for ${event.paymentId}: ${err.message}`);
    }

    try {
      await this.handleWorkoutPlanAssignment(event);
    } catch (err) {
      this.logger.error(`[payment.completed] Workout assignment failed for ${event.paymentId}: ${err.message}`);
    }

    try {
      await this.handlePlatformCommission(event);
    } catch (err) {
      this.logger.error(`[payment.completed] Commission calc failed for ${event.paymentId}: ${err.message}`);
    }
  }

  private async handleMembershipRewards(event: PaymentCompletedEvent) {
    if (event.type !== 'MEMBERSHIP') return;

    const previousPayments = await this.prisma.payment.count({
      where: {
        memberId: event.memberId,
        type: 'MEMBERSHIP',
        status: 'COMPLETED',
        id: { not: event.paymentId },
      },
    });

    if (previousPayments === 0) {
      await this.referralsService.awardReferralCredit(event.memberId, event.gymId);
    }

    if (event.promoCodeId) {
      const ok = await this.promoCodesService.incrementUsage(event.promoCodeId);
      if (!ok) {
        this.logger.warn(
          `Promo code ${event.promoCodeId} usage limit hit by a concurrent payment — ` +
          `payment ${event.paymentId} already completed with discount applied; flag for manual review`,
        );
      }
    }
  }

  private async handleDietPlanAssignment(event: PaymentCompletedEvent) {
    if (event.type !== 'DIET_PLAN' || !event.dietPlanId) return;

    const plan = await this.prisma.dietPlan.findUnique({ where: { id: event.dietPlanId } });
    if (!plan) return;

    const existing = await this.prisma.dietAssignment.findFirst({
      where: { dietPlanId: event.dietPlanId, memberId: event.memberId, isActive: true },
    });
    if (existing) return; // already assigned

    await this.prisma.dietAssignment.create({
      data: {
        dietPlanId: event.dietPlanId,
        memberId: event.memberId,
        gymId: event.gymId,
        startDate: new Date(),
        endDate: (plan as any).durationDays
          ? new Date(Date.now() + (plan as any).durationDays * 86400000)
          : undefined,
        isActive: true,
      },
    });
  }

  private async handleWorkoutPlanAssignment(event: PaymentCompletedEvent) {
    if (event.type !== 'WORKOUT_PLAN' || !event.workoutPlanId) return;

    const plan = await this.prisma.workoutPlan.findUnique({ where: { id: event.workoutPlanId } });
    if (!plan) return;

    const existing = await this.prisma.workoutAssignment.findFirst({
      where: { workoutPlanId: event.workoutPlanId, memberId: event.memberId, isActive: true },
    });
    if (existing) return;

    await this.prisma.workoutAssignment.create({
      data: {
        workoutPlanId: event.workoutPlanId,
        memberId: event.memberId,
        gymId: event.gymId,
        startDate: new Date(),
        endDate: (plan as any).durationDays
          ? new Date(Date.now() + (plan as any).durationDays * 86400000)
          : undefined,
        isActive: true,
      },
    });
  }

  private async handlePlatformCommission(event: PaymentCompletedEvent) {
    const gymSub = await this.prisma.gymSubscription.findFirst({
      where: { gymId: event.gymId, status: 'ACTIVE' },
      orderBy: { createdAt: 'desc' },
      include: { plan: { select: { commissionPct: true } } },
    });
    const commissionPct = (gymSub?.plan as any)?.commissionPct ?? 0;
    if (commissionPct <= 0) return;

    const commission = Math.round((event.amount * commissionPct / 100) * 100) / 100;
    await (this.prisma.payment as any).update({
      where: { id: event.paymentId },
      data: { platformCommission: commission },
    });
  }
}
