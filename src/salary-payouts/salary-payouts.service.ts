import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class SalaryPayoutsService {
  constructor(private prisma: PrismaService) {}

  async create(gymId: string, data: { userId: string; amount: number; periodLabel: string; notes?: string }) {
    if (!data.amount || data.amount <= 0) throw new BadRequestException('Amount must be greater than zero');
    const recipient = await this.prisma.user.findFirst({
      where: { id: data.userId, gymId, role: { in: ['TRAINER', 'STAFF'] } },
    });
    if (!recipient) throw new NotFoundException('Trainer/staff not found in this gym');

    return this.prisma.salaryPayout.create({
      data: {
        gymId,
        userId: data.userId,
        amount: data.amount,
        periodLabel: data.periodLabel,
        notes: data.notes ?? null,
      },
    });
  }

  async findAllForGym(gymId: string, query: any) {
    const { page = 1, limit = 20, status, userId } = query;
    const where: any = { gymId };
    if (status) where.status = status;
    if (userId) where.userId = userId;

    const [data, total] = await Promise.all([
      this.prisma.salaryPayout.findMany({
        where,
        skip: (page - 1) * limit,
        take: +limit,
        orderBy: { createdAt: 'desc' },
        include: { user: { select: { firstName: true, lastName: true, role: true, payoutUpiVpa: true } } },
      }),
      this.prisma.salaryPayout.count({ where }),
    ]);

    return { data, total, page: +page, limit: +limit, totalPages: Math.ceil(total / limit) };
  }

  async findMine(userId: string) {
    return this.prisma.salaryPayout.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async markPaid(id: string, gymId: string) {
    const payout = await this.prisma.salaryPayout.findUnique({ where: { id } });
    if (!payout || payout.gymId !== gymId) throw new NotFoundException('Payout not found');
    if (payout.status === 'PAID') return payout;

    return this.prisma.salaryPayout.update({
      where: { id },
      data: { status: 'PAID', paidAt: new Date() },
    });
  }
}
