import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { GymStatus } from '@prisma/client';

@Injectable()
export class GymsService {
  constructor(private prisma: PrismaService) {}

  async findAll(query: any) {
    const { page = 1, limit = 10, search, status } = query;
    const skip = (page - 1) * limit;

    const where: any = { deletedAt: null };
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { city: { contains: search, mode: 'insensitive' } },
      ];
    }
    if (status) where.status = status;

    const [gyms, total] = await Promise.all([
      this.prisma.gym.findMany({
        where,
        skip,
        take: +limit,
        orderBy: { createdAt: 'desc' },
        include: {
          _count: { select: { members: true, trainers: true } },
        },
      }),
      this.prisma.gym.count({ where }),
    ]);

    return { data: gyms, total, page: +page, limit: +limit, totalPages: Math.ceil(total / limit) };
  }

  async findOne(id: string) {
    const gym = await this.prisma.gym.findFirst({
      where: { id, deletedAt: null },
      include: {
        _count: { select: { members: true, trainers: true } },
      },
    });
    if (!gym) throw new NotFoundException('Gym not found');
    return gym;
  }

  async create(data: any) {
    return this.prisma.gym.create({ data });
  }

  async update(id: string, data: any, user: any) {
    const gym = await this.prisma.gym.findUnique({ where: { id } });
    if (!gym) throw new NotFoundException('Gym not found');

    if (user.role === 'GYM_ADMIN' && user.gymId !== id) {
      throw new ForbiddenException('Not authorized');
    }

    return this.prisma.gym.update({ where: { id }, data });
  }

  async remove(id: string) {
    await this.findOne(id);
    await this.prisma.gym.update({
      where: { id },
      data: { deletedAt: new Date(), status: 'INACTIVE' },
    });
    return { message: 'Gym deleted successfully' };
  }

  async updateStatus(id: string, status: GymStatus) {
    await this.findOne(id);
    return this.prisma.gym.update({ where: { id }, data: { status } });
  }

  async getStats(gymId: string) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [totalMembers, activeMembers, todayAttendance, monthlyRevenue, pendingPayments] =
      await Promise.all([
        this.prisma.user.count({ where: { gymId, role: 'MEMBER' } }),
        this.prisma.memberSubscription.count({ where: { gymId, status: 'ACTIVE' } }),
        this.prisma.attendance.count({ where: { gymId, checkInTime: { gte: today } } }),
        this.prisma.payment.aggregate({
          where: {
            gymId,
            status: 'COMPLETED',
            paidAt: { gte: new Date(today.getFullYear(), today.getMonth(), 1) },
          },
          _sum: { amount: true },
        }),
        this.prisma.payment.count({ where: { gymId, status: 'PENDING' } }),
      ]);

    return {
      totalMembers,
      activeMembers,
      todayAttendance,
      monthlyRevenue: monthlyRevenue._sum.amount ?? 0,
      pendingPayments,
    };
  }
}
