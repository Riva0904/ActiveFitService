import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PaymentStatus } from '@prisma/client';

@Injectable()
export class PaymentRepository {
  constructor(private prisma: PrismaService) {}

  /** Always scope list queries to gymId — prevents cross-tenant reads */
  async findMany(gymId: string, opts: { skip?: number; take?: number; status?: string; type?: string; memberId?: string }) {
    const where: any = { gymId };
    if (opts.status) where.status = opts.status;
    if (opts.type) where.type = opts.type;
    if (opts.memberId) where.memberId = opts.memberId;

    const [data, total] = await Promise.all([
      this.prisma.payment.findMany({
        where,
        skip: opts.skip ?? 0,
        take: opts.take ?? 10,
        orderBy: { createdAt: 'desc' },
        include: {
          member: {
            select: {
              id: true, memberCode: true,
              user: { select: { firstName: true, lastName: true, email: true } },
            },
          },
          subscription: { select: { id: true } },
        },
      }),
      this.prisma.payment.count({ where }),
    ]);
    return { data, total };
  }

  /** Fetch a single payment scoped to a gym */
  async findOne(id: string, gymId: string) {
    return this.prisma.payment.findFirst({ where: { id, gymId } });
  }

  /** Atomic: only updates if payment is still PENDING — idempotent */
  async completePayment(id: string, razorpayPaymentId: string): Promise<boolean> {
    const result = await this.prisma.payment.updateMany({
      where: { id, status: PaymentStatus.PENDING },
      data: { status: PaymentStatus.COMPLETED, razorpayPaymentId, paidAt: new Date() },
    });
    return result.count > 0;
  }

  async failPayment(id: string) {
    return this.prisma.payment.update({
      where: { id },
      data: { status: PaymentStatus.FAILED },
    });
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
