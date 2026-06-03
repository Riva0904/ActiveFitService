import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { BaseRepository } from './base.repository';

@Injectable()
export class AttendanceRepository extends BaseRepository<any> {
  constructor(prisma: PrismaService, gymId: string) {
    super(prisma, 'attendance', gymId);
  }

  async findActiveCheckIn(opts: { userId?: string; memberId?: string }) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const orConditions: any[] = [];
    if (opts.userId) orConditions.push({ userId: opts.userId });
    if (opts.memberId) orConditions.push({ memberId: opts.memberId });

    return this.prisma.attendance.findFirst({
      where: {
        gymId: this.gymId,
        checkInTime: { gte: today },
        checkOutTime: null,
        OR: orConditions,
      },
    });
  }

  async findMany(opts: {
    skip?: number;
    take?: number;
    date?: Date;
    userId?: string;
    memberId?: string;
  }) {
    const where: any = { gymId: this.gymId };
    if (opts.date) {
      const start = new Date(opts.date);
      start.setHours(0, 0, 0, 0);
      const end = new Date(opts.date);
      end.setHours(23, 59, 59, 999);
      where.checkInTime = { gte: start, lte: end };
    }
    if (opts.userId || opts.memberId) {
      where.OR = [
        ...(opts.userId ? [{ userId: opts.userId }] : []),
        ...(opts.memberId ? [{ memberId: opts.memberId }] : []),
      ];
    }

    const [data, total] = await Promise.all([
      this.prisma.attendance.findMany({
        where,
        skip: opts.skip ?? 0,
        take: opts.take ?? 20,
        orderBy: { checkInTime: 'desc' },
        include: {
          member: {
            select: {
              id: true, memberCode: true,
              user: { select: { id: true, firstName: true, lastName: true, avatar: true } },
            },
          },
          user: { select: { id: true, firstName: true, lastName: true, role: true, avatar: true } },
        },
      }),
      this.prisma.attendance.count({ where }),
    ]);
    return { data, total };
  }

  async getTodayStats() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [totalToday, currentlyIn, totalMembers] = await Promise.all([
      this.prisma.attendance.count({ where: { gymId: this.gymId, checkInTime: { gte: today } } }),
      this.prisma.attendance.count({ where: { gymId: this.gymId, checkInTime: { gte: today }, checkOutTime: null } }),
      this.prisma.member.count({ where: { gymId: this.gymId, deletedAt: null } }),
    ]);
    return { totalToday, currentlyIn, totalMembers };
  }
}
