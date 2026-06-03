import { Injectable, NotFoundException, ConflictException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class MembershipsService {
  constructor(private prisma: PrismaService) {}

  async findAll(query: any, gymId?: string) {
    const { page = 1, limit = 10, status, search, userId } = query;
    const skip = (page - 1) * +limit;

    const where: any = {};
    if (gymId) where.gymId = gymId;
    if (status) where.status = status;

    if (userId) {
      const memberWhere: any = { userId };
      if (gymId) memberWhere.gymId = gymId;
      const member = await this.prisma.member.findFirst({ where: memberWhere });
      if (!member) return { data: [], total: 0, page: +page, limit: +limit, totalPages: 0 };
      where.memberId = member.id;
    }

    if (search) {
      where.member = {
        user: {
          OR: [
            { firstName: { contains: search, mode: 'insensitive' } },
            { lastName: { contains: search, mode: 'insensitive' } },
          ],
        },
      };
    }

    const [subs, total] = await Promise.all([
      this.prisma.memberSubscription.findMany({
        where,
        skip,
        take: +limit,
        orderBy: { createdAt: 'desc' },
        include: {
          plan: { select: { id: true, name: true, type: true, durationMonths: true, price: true } },
          member: {
            include: {
              user: { select: { id: true, firstName: true, lastName: true, email: true, phone: true, avatar: true } },
            },
          },
        },
      }),
      this.prisma.memberSubscription.count({ where }),
    ]);

    const data = subs.map(s => ({
      id: s.id,
      status: s.status,
      type: s.plan.type,
      startDate: s.startDate,
      endDate: s.endDate,
      amount: s.amount,
      autoRenew: s.autoRenew,
      gymId: s.gymId,
      memberId: s.memberId,
      planId: s.planId,
      plan: s.plan,
      user: s.member.user,
      createdAt: s.createdAt,
      updatedAt: s.updatedAt,
    }));

    return { data, total, page: +page, limit: +limit, totalPages: Math.ceil(total / +limit) };
  }

  async findOne(id: string, requesterId?: string, requesterRole?: string, gymId?: string) {
    const where: any = { id };
    if (gymId && requesterRole !== 'SUPER_ADMIN') where.gymId = gymId;

    const sub = await this.prisma.memberSubscription.findFirst({
      where,
      include: {
        plan: true,
        member: {
          include: {
            user: { select: { id: true, firstName: true, lastName: true, email: true, phone: true } },
          },
        },
      },
    });
    if (!sub) throw new NotFoundException('Membership not found');
    if (
      requesterId &&
      requesterRole !== 'GYM_ADMIN' &&
      requesterRole !== 'SUPER_ADMIN' &&
      sub.member.userId !== requesterId
    ) {
      throw new ForbiddenException('Access denied');
    }
    return { ...sub, type: (sub.plan as any).type, user: sub.member.user };
  }

  async create(data: any) {
    const member = await this.prisma.member.findFirst({ where: { userId: data.userId, gymId: data.gymId } });
    if (!member) throw new NotFoundException('Member not found for this gym');

    const existing = await this.prisma.memberSubscription.findFirst({
      where: { memberId: member.id, gymId: data.gymId, status: 'ACTIVE' },
    });
    if (existing) throw new ConflictException('Member already has an active membership at this gym');

    let plan: any;
    if (data.planId) {
      plan = await this.prisma.membershipPlan.findFirst({ where: { id: data.planId, gymId: data.gymId } });
      if (!plan) throw new NotFoundException('Membership plan not found');
    } else if (data.type) {
      // Find an existing plan by type, or auto-create one for this gym
      plan = await this.prisma.membershipPlan.findFirst({ where: { gymId: data.gymId, type: data.type } });
      if (!plan) {
        const durationMonths: Record<string, number> = { MONTHLY: 1, QUARTERLY: 3, HALF_YEARLY: 6, YEARLY: 12 };
        plan = await this.prisma.membershipPlan.create({
          data: {
            gymId: data.gymId,
            name: data.type.replace(/_/g, ' ').toLowerCase().replace(/^\w/, (c: string) => c.toUpperCase()),
            type: data.type,
            durationMonths: durationMonths[data.type] ?? 1,
            price: data.amount ?? data.price ?? 0,
          },
        });
      }
    } else {
      throw new NotFoundException('Either planId or type is required to create a membership');
    }

    const startDate = data.startDate ? new Date(data.startDate) : new Date();
    const endDate = data.endDate ? new Date(data.endDate) : this.calcEndDate(startDate, plan.type);

    return this.prisma.memberSubscription.create({
      data: {
        memberId: member.id,
        gymId: data.gymId,
        planId: plan.id,
        status: 'ACTIVE',
        startDate,
        endDate,
        amount: data.amount ?? data.price ?? plan.price,
      },
      include: { plan: { select: { name: true, type: true } } },
    });
  }

  async update(id: string, data: any) {
    const sub = await this.prisma.memberSubscription.findUnique({ where: { id } });
    if (!sub) throw new NotFoundException('Membership not found');
    return this.prisma.memberSubscription.update({ where: { id }, data });
  }

  async renew(id: string) {
    const sub = await this.prisma.memberSubscription.findUnique({
      where: { id },
      include: { plan: true },
    });
    if (!sub) throw new NotFoundException('Membership not found');

    const now = new Date();
    const startDate = sub.endDate > now ? sub.endDate : now;
    const endDate = this.calcEndDate(startDate, sub.plan.type);

    return this.prisma.memberSubscription.update({
      where: { id },
      data: { startDate, endDate, status: 'ACTIVE' },
    });
  }

  async getExpiringMembers(gymId: string, days = 7) {
    const futureDate = new Date(Date.now() + +days * 24 * 60 * 60 * 1000);
    const subs = await this.prisma.memberSubscription.findMany({
      where: { gymId, status: 'ACTIVE', endDate: { lte: futureDate } },
      include: {
        member: {
          include: {
            user: { select: { id: true, firstName: true, lastName: true, email: true, phone: true, avatar: true } },
          },
        },
        plan: { select: { name: true, type: true } },
      },
      orderBy: { endDate: 'asc' },
    });

    return subs.map(s => ({
      id: s.id,
      endDate: s.endDate,
      status: s.status,
      type: s.plan.type,
      user: s.member.user,
    }));
  }

  // ── Membership Plan CRUD ──────────────────────────────────────────────────

  async findAllPlans(gymId: string) {
    return this.prisma.membershipPlan.findMany({
      where: { gymId, deletedAt: null },
      orderBy: { createdAt: 'asc' },
    });
  }

  async findOnePlan(id: string, gymId: string) {
    const plan = await this.prisma.membershipPlan.findFirst({ where: { id, gymId, deletedAt: null } });
    if (!plan) throw new NotFoundException('Membership plan not found');
    return plan;
  }

  async createPlan(data: any, gymId: string) {
    if (!data.name?.trim()) throw new BadRequestException('Plan name is required');
    if (data.price == null || isNaN(+data.price)) throw new BadRequestException('Price is required');
    if (+data.price < 0) throw new BadRequestException('Price must be 0 or greater');
    if (+data.durationMonths < 1) throw new BadRequestException('Duration must be at least 1 month');

    return this.prisma.membershipPlan.create({
      data: {
        gymId,
        name: data.name.trim(),
        type: data.type,
        durationMonths: +data.durationMonths,
        price: +data.price,
        discount: +(data.discount ?? 0),
        features: data.features ?? [],
        isActive: data.isActive ?? true,
      },
    });
  }

  async updatePlan(id: string, data: any, gymId: string) {
    await this.findOnePlan(id, gymId);
    if (data.name !== undefined && !data.name?.trim()) throw new BadRequestException('Plan name cannot be empty');
    if (data.price !== undefined && +data.price < 0) throw new BadRequestException('Price must be 0 or greater');

    const { name, price, discount, features, isActive, durationMonths } = data;
    return this.prisma.membershipPlan.update({
      where: { id },
      data: {
        ...(name !== undefined && { name: name.trim() }),
        ...(price !== undefined && { price: +price }),
        ...(discount !== undefined && { discount: +discount }),
        ...(features !== undefined && { features }),
        ...(isActive !== undefined && { isActive }),
        ...(durationMonths !== undefined && { durationMonths: +durationMonths }),
      },
    });
  }

  async deletePlan(id: string, gymId: string) {
    await this.findOnePlan(id, gymId);
    return this.prisma.membershipPlan.update({ where: { id }, data: { deletedAt: new Date() } });
  }

  // ─────────────────────────────────────────────────────────────────────────

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async checkExpiredMemberships() {
    await this.prisma.memberSubscription.updateMany({
      where: { status: 'ACTIVE', endDate: { lt: new Date() } },
      data: { status: 'EXPIRED' },
    });
  }

  private calcEndDate(start: Date, type: string): Date {
    const end = new Date(start);
    switch (type) {
      case 'MONTHLY': end.setMonth(end.getMonth() + 1); break;
      case 'QUARTERLY': end.setMonth(end.getMonth() + 3); break;
      case 'HALF_YEARLY': end.setMonth(end.getMonth() + 6); break;
      case 'YEARLY': end.setFullYear(end.getFullYear() + 1); break;
    }
    return end;
  }
}
