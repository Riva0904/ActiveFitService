import { Injectable, BadRequestException, NotFoundException, InternalServerErrorException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../prisma/prisma.service';
import { ReferralsService } from '../referrals/referrals.service';
import { PromoCodesService } from '../promo-codes/promo-codes.service';
import { AuditService } from '../common/services/audit.service';
import { PAYMENT_COMPLETED, PaymentCompletedEvent } from './events/payment.events';
import Razorpay from 'razorpay';
import * as crypto from 'crypto';

@Injectable()
export class PaymentsService {
  private razorpay: Razorpay | null = null;
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    private prisma: PrismaService,
    private configService: ConfigService,
    private referralsService: ReferralsService,
    private promoCodesService: PromoCodesService,
    private auditService: AuditService,
    private eventEmitter: EventEmitter2,
  ) {}

  private getRazorpay(): Razorpay {
    if (!this.razorpay) {
      const keyId = this.configService.get('RAZORPAY_KEY_ID');
      const keySecret = this.configService.get('RAZORPAY_KEY_SECRET');
      if (!keyId || !keySecret) {
        throw new BadRequestException('Razorpay is not configured');
      }
      this.razorpay = new Razorpay({ key_id: keyId, key_secret: keySecret });
    }
    return this.razorpay;
  }

  async findAll(query: any, gymId?: string, userId?: string) {
    const { page = 1, limit = 10, status, type } = query;
    const skip = (page - 1) * limit;
    const where: any = {};
    if (gymId) where.gymId = gymId;
    if (status) where.status = status;
    if (type) where.type = type;

    if (userId) {
      const member = await this.prisma.member.findFirst({ where: { userId, gymId } });
      if (member) where.memberId = member.id;
    }

    const [payments, total] = await Promise.all([
      this.prisma.payment.findMany({
        where,
        skip,
        take: +limit,
        orderBy: { createdAt: 'desc' },
        include: {
          member: {
            select: {
              id: true,
              memberCode: true,
              user: { select: { firstName: true, lastName: true, email: true } },
            },
          },
          subscription: { select: { id: true } },
        },
      }),
      this.prisma.payment.count({ where }),
    ]);

    return { data: payments, total, page: +page, limit: +limit, totalPages: Math.ceil(total / limit) };
  }

  async createRazorpayOrder(
    clientAmount: number,
    userId: string,
    gymId: string,
    type: string,
    promoCode?: string,
    referralCreditToApply?: number,
    membershipPlanId?: string,
  ) {
    const member = await this.prisma.member.findFirst({ where: { userId, gymId } });
    if (!member) throw new BadRequestException('Member not found');

    // Always fetch authoritative price from DB — never trust client amount
    let amount = clientAmount;

    if (type === 'MEMBERSHIP' && membershipPlanId) {
      const plan = await this.prisma.membershipPlan.findFirst({
        where: { id: membershipPlanId, gymId, isActive: true, deletedAt: null },
      });
      if (!plan) throw new BadRequestException('Membership plan not found');
      const basePrice = plan.price - (plan.discount ?? 0);
      amount = Math.max(basePrice, 1);
    } else if (type === 'PT_SESSION' && (clientAmount as any)?.ptSessionId) {
      // PT session price is set at booking time via pt-sessions/book; amount comes from there
      if (!clientAmount || clientAmount <= 0) throw new BadRequestException('Invalid PT session amount');
    } else if (type === 'SUPPLEMENT') {
      // For supplement orders, amount is the order total computed server-side at order creation
      if (!clientAmount || clientAmount <= 0) throw new BadRequestException('Invalid supplement amount');
    } else if (type === 'DIET_PLAN' && (clientAmount as any)?.dietPlanId) {
      const dietPlan = await this.prisma.dietPlan.findFirst({
        where: { id: (clientAmount as any).dietPlanId, gymId, deletedAt: null },
      });
      if (!dietPlan || !(dietPlan as any).isPremium) throw new BadRequestException('Diet plan not found or not purchasable');
      amount = Math.max((dietPlan as any).price ?? 0, 1);
    } else if (type !== 'MEMBERSHIP' && type !== 'OTHER') {
      if (!clientAmount || clientAmount <= 0) throw new BadRequestException('Amount must be greater than zero');
    }

    let discountAmount = 0;
    let promoCodeId: string | undefined;

    if (promoCode) {
      const promo = await this.promoCodesService.validate(promoCode, gymId, amount);
      if (promo.valid) {
        discountAmount += promo.discountAmount;
        promoCodeId = promo.promoCodeId;
      }
    }

    if (referralCreditToApply && referralCreditToApply > 0) {
      const usable = Math.min(referralCreditToApply, member.referralCredit, amount - discountAmount);
      if (usable > 0) {
        discountAmount += usable;
        await this.referralsService.redeemCredit(member.id, usable);
      }
    }

    const finalAmount = Math.max(amount - discountAmount, 1);

    const order = await this.getRazorpay().orders.create({
      amount: Math.round(finalAmount * 100),
      currency: 'INR',
      receipt: `rcpt_${Date.now()}`,
    });

    const payment = await this.prisma.payment.create({
      data: {
        amount: finalAmount,
        discountAmount,
        type: type as any,
        status: 'PENDING',
        method: 'RAZORPAY',
        razorpayOrderId: order.id,
        memberId: member.id,
        gymId,
        promoCodeId: promoCodeId ?? null,
      },
    });

    return { orderId: order.id, amount: finalAmount, originalAmount: amount, discountAmount, currency: 'INR', paymentId: payment.id };
  }

  async verifyPayment(paymentId: string, razorpayPaymentId: string, signature: string, requestingUserId?: string) {
    const payment = await this.prisma.payment.findUnique({ where: { id: paymentId } });
    if (!payment) throw new NotFoundException('Payment not found');

    // Ensure only the member who created the payment can verify it
    if (requestingUserId) {
      const member = await this.prisma.member.findFirst({ where: { userId: requestingUserId, gymId: payment.gymId } });
      if (!member || member.id !== payment.memberId) throw new NotFoundException('Payment not found');
    }

    if (payment.status === 'COMPLETED') return payment; // Idempotent — already verified

    const expectedSig = crypto
      .createHmac('sha256', this.configService.get('RAZORPAY_KEY_SECRET'))
      .update(`${payment.razorpayOrderId}|${razorpayPaymentId}`)
      .digest('hex');

    if (expectedSig !== signature) {
      await this.prisma.payment.update({ where: { id: paymentId }, data: { status: 'FAILED' } });
      throw new BadRequestException('Payment verification failed');
    }

    // Atomic update — only succeeds if still PENDING, preventing double-processing on concurrent calls
    const result = await this.prisma.payment.updateMany({
      where: { id: paymentId, status: 'PENDING' },
      data: { status: 'COMPLETED', razorpayPaymentId, paidAt: new Date() },
    });
    if (result.count === 0) {
      // Another request completed it first; return current state
      return this.prisma.payment.findUnique({ where: { id: paymentId } });
    }
    const verified = await this.prisma.payment.findUnique({ where: { id: paymentId } });

    await this.auditService.log({
      gymId: payment.gymId,
      action: 'PAYMENT_VERIFIED',
      entity: 'Payment',
      entityId: payment.id,
      newValues: { razorpayPaymentId, status: 'COMPLETED' },
    });

    // Emit domain event — handlers in diet, referral, commission modules subscribe independently
    this.eventEmitter.emit(
      PAYMENT_COMPLETED,
      new PaymentCompletedEvent(
        payment.id,
        payment.gymId,
        payment.memberId,
        payment.type,
        payment.amount,
        payment.promoCodeId ?? undefined,
        (payment as any).dietPlanId ?? undefined,
        (payment as any).workoutPlanId ?? undefined,
      ),
    );

    return verified;
  }

  private async postPaymentActions(payment: any) {
    try {
      const actions: Promise<any>[] = [];

      if (payment.type === 'MEMBERSHIP') {
        const previousPayments = await this.prisma.payment.count({
          where: { memberId: payment.memberId, type: 'MEMBERSHIP', status: 'COMPLETED', id: { not: payment.id } },
        });
        if (previousPayments === 0) {
          actions.push(this.referralsService.awardReferralCredit(payment.memberId, payment.gymId));
        }
        if (payment.promoCodeId) {
          actions.push(this.promoCodesService.incrementUsage(payment.promoCodeId));
        }
      }

      if (payment.type === 'DIET_PLAN' && (payment as any).dietPlanId) {
        const plan: any = await (this.prisma.dietPlan as any).findUnique({ where: { id: (payment as any).dietPlanId } });
        if (plan) {
          actions.push(
            this.prisma.dietAssignment.create({
              data: {
                dietPlanId: (payment as any).dietPlanId,
                memberId: payment.memberId,
                gymId: payment.gymId,
                startDate: new Date(),
                endDate: plan.durationDays ? new Date(Date.now() + plan.durationDays * 86400000) : undefined,
                isActive: true,
              },
            }),
          );
        }
      }

      if (payment.type === 'WORKOUT_PLAN' && (payment as any).workoutPlanId) {
        const plan: any = await (this.prisma.workoutPlan as any).findUnique({ where: { id: (payment as any).workoutPlanId } });
        if (plan) {
          actions.push(
            this.prisma.workoutAssignment.create({
              data: {
                workoutPlanId: (payment as any).workoutPlanId,
                memberId: payment.memberId,
                gymId: payment.gymId,
                startDate: new Date(),
                endDate: plan.durationDays ? new Date(Date.now() + plan.durationDays * 86400000) : undefined,
                isActive: true,
              },
            }),
          );
        }
      }

      // Platform commission — apply for all payment types
      const gymSub = await this.prisma.gymSubscription.findFirst({
        where: { gymId: payment.gymId, status: 'ACTIVE' },
        include: { plan: { select: { commissionPct: true } } },
      });
      const commissionPct = (gymSub?.plan as any)?.commissionPct ?? 0;
      if (commissionPct > 0) {
        const commission = Math.round((payment.amount * commissionPct / 100) * 100) / 100;
        actions.push(
          (this.prisma.payment as any).update({ where: { id: payment.id }, data: { platformCommission: commission } }),
        );
      }

      await Promise.all(actions);
    } catch (err) {
      this.logger.error(`Post-payment actions failed for payment ${payment.id}: ${err.message}`);
    }
  }

  async handleRazorpayWebhook(rawBody: Buffer, signature: string): Promise<void> {
    const webhookSecret = this.configService.get<string>('RAZORPAY_WEBHOOK_SECRET');
    if (!webhookSecret) {
      throw new InternalServerErrorException('RAZORPAY_WEBHOOK_SECRET not configured — webhook processing unavailable');
    }

    const expectedSig = crypto
      .createHmac('sha256', webhookSecret)
      .update(rawBody)
      .digest('hex');

    if (expectedSig !== signature) {
      throw new BadRequestException('Invalid webhook signature');
    }

    const event = JSON.parse(rawBody.toString());
    if (event.event !== 'payment.captured') return;

    const razorpayPaymentId: string = event.payload?.payment?.entity?.id;
    const razorpayOrderId: string = event.payload?.payment?.entity?.order_id;
    if (!razorpayOrderId) return;

    const payment = await this.prisma.payment.findFirst({
      where: { razorpayOrderId, status: 'PENDING' },
    });
    if (!payment) return; // Already processed or not found

    await this.prisma.payment.update({
      where: { id: payment.id },
      data: { status: 'COMPLETED', razorpayPaymentId, paidAt: new Date() },
    });

    await this.auditService.log({
      gymId: payment.gymId,
      action: 'WEBHOOK_PAYMENT_RECEIVED',
      entity: 'Payment',
      entityId: payment.id,
      newValues: { razorpayPaymentId, status: 'COMPLETED' },
    });

    this.eventEmitter.emit(
      PAYMENT_COMPLETED,
      new PaymentCompletedEvent(
        payment.id,
        payment.gymId,
        payment.memberId,
        payment.type,
        payment.amount,
        payment.promoCodeId ?? undefined,
        (payment as any).dietPlanId ?? undefined,
        (payment as any).workoutPlanId ?? undefined,
      ),
    );

    this.logger.log(`Webhook: payment ${payment.id} confirmed via Razorpay event`);
  }

  async recordCashPayment(data: any) {
    return this.prisma.payment.create({
      data: { ...data, method: 'CASH', status: 'COMPLETED', paidAt: new Date() },
    });
  }

  async getMonthlyRevenueBreakdown(gymId: string) {
    const now = new Date();
    const months = Array.from({ length: 6 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - 5 + i, 1);
      return {
        label: d.toLocaleDateString('en', { month: 'short' }),
        start: new Date(d.getFullYear(), d.getMonth(), 1),
        end: new Date(d.getFullYear(), d.getMonth() + 1, 1),
      };
    });

    return Promise.all(
      months.map(async ({ label, start, end }) => {
        const [membership, supplements, pt] = await Promise.all([
          this.prisma.payment.aggregate({
            where: { gymId, status: 'COMPLETED', type: 'MEMBERSHIP', paidAt: { gte: start, lt: end } },
            _sum: { amount: true },
          }),
          this.prisma.payment.aggregate({
            where: { gymId, status: 'COMPLETED', type: 'SUPPLEMENT', paidAt: { gte: start, lt: end } },
            _sum: { amount: true },
          }),
          this.prisma.payment.aggregate({
            where: { gymId, status: 'COMPLETED', type: 'PT_SESSION', paidAt: { gte: start, lt: end } },
            _sum: { amount: true },
          }),
        ]);
        return {
          month: label,
          membership: membership._sum.amount ?? 0,
          supplements: supplements._sum.amount ?? 0,
          pt: pt._sum.amount ?? 0,
        };
      }),
    );
  }

  async getRevenueStats(gymId: string) {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfYear = new Date(now.getFullYear(), 0, 1);

    const [monthly, yearly, pending] = await Promise.all([
      this.prisma.payment.aggregate({
        where: { gymId, status: 'COMPLETED', paidAt: { gte: startOfMonth } },
        _sum: { amount: true },
      }),
      this.prisma.payment.aggregate({
        where: { gymId, status: 'COMPLETED', paidAt: { gte: startOfYear } },
        _sum: { amount: true },
      }),
      this.prisma.payment.aggregate({
        where: { gymId, status: 'PENDING' },
        _sum: { amount: true },
        _count: true,
      }),
    ]);

    return {
      monthlyRevenue: monthly._sum.amount ?? 0,
      yearlyRevenue: yearly._sum.amount ?? 0,
      pendingAmount: pending._sum.amount ?? 0,
      pendingCount: pending._count,
    };
  }
}
