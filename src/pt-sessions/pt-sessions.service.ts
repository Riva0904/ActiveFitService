import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PaymentsService } from '../payments/payments.service';

@Injectable()
export class PtSessionsService {
  constructor(private prisma: PrismaService, private paymentsService: PaymentsService) {}

  async findAll(query: any, gymId?: string, trainerId?: string) {
    const { page = 1, limit = 50, status } = query;
    const skip = (Number(page) - 1) * Number(limit);
    const where: any = {};
    if (gymId) where.gymId = gymId;
    if (trainerId) where.trainerId = trainerId;
    if (status && status !== 'ALL') where.status = status;

    const [sessions, total] = await Promise.all([
      this.prisma.ptSession.findMany({
        where,
        skip,
        take: Number(limit),
        orderBy: { scheduledAt: 'desc' },
        include: {
          trainer: { include: { user: { select: { id: true, firstName: true, lastName: true, avatar: true } } } },
          member: { include: { user: { select: { id: true, firstName: true, lastName: true, avatar: true } } } },
        },
      }),
      this.prisma.ptSession.count({ where }),
    ]);

    return { data: sessions, total, page: Number(page), limit: Number(limit), totalPages: Math.ceil(total / Number(limit)) };
  }

  async findOne(id: string) {
    const session = await this.prisma.ptSession.findUnique({
      where: { id },
      include: {
        trainer: { include: { user: { select: { id: true, firstName: true, lastName: true, avatar: true } } } },
        member: { include: { user: { select: { id: true, firstName: true, lastName: true, avatar: true } } } },
      },
    });
    if (!session) throw new NotFoundException('PT session not found');
    return session;
  }

  async create(data: any, gymId: string, creatorTrainerId?: string) {
    const { trainerId, memberId, scheduledAt, duration = 60, title, notes } = data;

    const effectiveTrainerId = creatorTrainerId ?? trainerId;
    if (!effectiveTrainerId) throw new BadRequestException('trainerId is required');
    if (!memberId) throw new BadRequestException('memberId is required');
    if (!scheduledAt) throw new BadRequestException('scheduledAt is required');

    // Validate trainer belongs to gym
    const trainer = await this.prisma.trainer.findFirst({ where: { id: effectiveTrainerId, gymId } });
    if (!trainer) throw new NotFoundException('Trainer not found in this gym');

    // Validate member belongs to gym
    const member = await this.prisma.member.findFirst({ where: { id: memberId, gymId } });
    if (!member) throw new NotFoundException('Member not found in this gym');

    return this.prisma.ptSession.create({
      data: {
        gymId,
        trainerId: effectiveTrainerId,
        memberId,
        title: title || null,
        scheduledAt: new Date(scheduledAt),
        duration: Number(duration),
        notes: notes || null,
      },
      include: {
        trainer: { include: { user: { select: { id: true, firstName: true, lastName: true, avatar: true } } } },
        member: { include: { user: { select: { id: true, firstName: true, lastName: true, avatar: true } } } },
      },
    });
  }

  async update(id: string, data: any, actorTrainerId?: string) {
    const session = await this.findOne(id);
    if (actorTrainerId && session.trainerId !== actorTrainerId) {
      throw new ForbiddenException('You can only update your own sessions');
    }
    const { title, scheduledAt, duration, notes, status } = data;
    return this.prisma.ptSession.update({
      where: { id },
      data: {
        ...(title !== undefined && { title }),
        ...(scheduledAt && { scheduledAt: new Date(scheduledAt) }),
        ...(duration !== undefined && { duration: Number(duration) }),
        ...(notes !== undefined && { notes }),
        ...(status && { status }),
      },
      include: {
        trainer: { include: { user: { select: { id: true, firstName: true, lastName: true, avatar: true } } } },
        member: { include: { user: { select: { id: true, firstName: true, lastName: true, avatar: true } } } },
      },
    });
  }

  async complete(id: string, feedback?: string, rating?: number, actorTrainerId?: string) {
    const session = await this.findOne(id);
    if (actorTrainerId && session.trainerId !== actorTrainerId) {
      throw new ForbiddenException('You can only complete your own sessions');
    }
    if (session.status !== 'SCHEDULED') {
      throw new BadRequestException('Only SCHEDULED sessions can be completed');
    }
    const clampedRating = rating !== undefined ? Math.min(Math.max(Math.round(rating), 1), 5) : undefined;
    return this.prisma.ptSession.update({
      where: { id },
      data: {
        status: 'COMPLETED',
        completedAt: new Date(),
        feedback: feedback || null,
        ...(clampedRating !== undefined && { rating: clampedRating }),
      },
      include: {
        trainer: { include: { user: { select: { id: true, firstName: true, lastName: true, avatar: true } } } },
        member: { include: { user: { select: { id: true, firstName: true, lastName: true, avatar: true } } } },
      },
    });
  }

  async cancel(id: string, actorTrainerId?: string) {
    const session = await this.findOne(id);
    if (actorTrainerId && session.trainerId !== actorTrainerId) {
      throw new ForbiddenException('You can only cancel your own sessions');
    }
    if (session.status === 'COMPLETED') {
      throw new BadRequestException('Completed sessions cannot be cancelled');
    }
    return this.prisma.ptSession.update({
      where: { id },
      data: { status: 'CANCELLED' },
    });
  }

  async delete(id: string, actorTrainerId?: string) {
    const session = await this.findOne(id);
    if (actorTrainerId && session.trainerId !== actorTrainerId) {
      throw new ForbiddenException('You can only delete your own sessions');
    }
    await this.prisma.ptSession.delete({ where: { id } });
    return { success: true };
  }

  async getAvailableTrainers(gymId: string) {
    return this.prisma.trainer.findMany({
      where: { gymId, isAvailable: true, deletedAt: null },
      include: {
        user: { select: { id: true, firstName: true, lastName: true, avatar: true, email: true } },
        _count: { select: { memberAssignments: true } },
      },
      orderBy: { rating: 'desc' },
    });
  }

  async bookWithPayment(data: any, gymId: string, userId: string) {
    const { trainerId, scheduledAt, duration = 60, title, notes } = data;
    if (!trainerId || !scheduledAt) throw new BadRequestException('trainerId and scheduledAt are required');

    const trainer = await this.prisma.trainer.findFirst({ where: { id: trainerId, gymId, isAvailable: true } });
    if (!trainer) throw new NotFoundException('Trainer not found or not available');

    const member = await this.prisma.member.findFirst({ where: { userId, gymId } });
    if (!member) throw new NotFoundException('Member not found');

    const price = trainer.hourlyRate ? trainer.hourlyRate * (Number(duration) / 60) : 0;

    // Create the session first
    const session = await (this.prisma.ptSession as any).create({
      data: {
        gymId,
        trainerId,
        memberId: member.id,
        title: title || null,
        scheduledAt: new Date(scheduledAt),
        duration: Number(duration),
        notes: notes || null,
        price: price || null,
      },
    });

    if (price > 0) {
      // Create Razorpay order for payment
      const orderResult = await this.paymentsService.createRazorpayOrder(price, userId, gymId, 'PT_SESSION');
      // Link payment to session
      await (this.prisma.ptSession as any).update({ where: { id: session.id }, data: { paymentId: orderResult.paymentId } });
      return { session, payment: orderResult };
    }

    return { session, payment: null };
  }

  async getAdminStats(gymId: string) {
    const now = new Date();
    const todayStart = new Date(now); todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date(now); todayEnd.setHours(23, 59, 59, 999);
    const weekStart = new Date(now); weekStart.setDate(now.getDate() - now.getDay()); weekStart.setHours(0, 0, 0, 0);

    const [total, scheduled, completed, cancelled, noShow, today, thisWeek] = await Promise.all([
      this.prisma.ptSession.count({ where: { gymId } }),
      this.prisma.ptSession.count({ where: { gymId, status: 'SCHEDULED' } }),
      this.prisma.ptSession.count({ where: { gymId, status: 'COMPLETED' } }),
      this.prisma.ptSession.count({ where: { gymId, status: 'CANCELLED' } }),
      this.prisma.ptSession.count({ where: { gymId, status: 'NO_SHOW' } }),
      this.prisma.ptSession.count({ where: { gymId, scheduledAt: { gte: todayStart, lte: todayEnd } } }),
      this.prisma.ptSession.count({ where: { gymId, scheduledAt: { gte: weekStart } } }),
    ]);

    const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;
    return { total, scheduled, completed, cancelled, noShow, today, thisWeek, completionRate };
  }

  async getStats(trainerId: string, gymId: string) {
    const now = new Date();
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - now.getDay());
    weekStart.setHours(0, 0, 0, 0);

    const [total, scheduled, completed, cancelled, thisWeek] = await Promise.all([
      this.prisma.ptSession.count({ where: { trainerId, gymId } }),
      this.prisma.ptSession.count({ where: { trainerId, gymId, status: 'SCHEDULED' } }),
      this.prisma.ptSession.count({ where: { trainerId, gymId, status: 'COMPLETED' } }),
      this.prisma.ptSession.count({ where: { trainerId, gymId, status: 'CANCELLED' } }),
      this.prisma.ptSession.count({ where: { trainerId, gymId, scheduledAt: { gte: weekStart } } }),
    ]);

    const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;
    return { total, scheduled, completed, cancelled, thisWeek, completionRate };
  }

  async getAssignedMembers(trainerId: string, gymId: string) {
    const assignments = await this.prisma.trainerAssignment.findMany({
      where: { trainerId, gymId },
      include: {
        member: {
          include: {
            user: { select: { id: true, firstName: true, lastName: true, avatar: true, email: true, phone: true } },
            memberSubscriptions: {
              where: { status: 'ACTIVE' },
              take: 1,
              select: { id: true, status: true, startDate: true, endDate: true, amount: true, plan: { select: { name: true, type: true } } },
            },
          },
        },
      },
    });
    return assignments.map((a) => ({
      ...a.member,
      memberships: a.member.memberSubscriptions,
    }));
  }
}
