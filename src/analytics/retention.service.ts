import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class RetentionService {
  constructor(private prisma: PrismaService) {}

  /**
   * Members who have not checked in within the last `inactiveDays` days
   * and have an active membership — these are at-risk of churning.
   */
  async getAtRiskMembers(gymId: string, inactiveDays = 14) {
    const cutoff = new Date(Date.now() - inactiveDays * 24 * 60 * 60 * 1000);

    const activeMembers = await this.prisma.member.findMany({
      where: {
        gymId,
        deletedAt: null,
        memberSubscriptions: { some: { status: 'ACTIVE', gymId } },
      },
      select: {
        id: true, memberCode: true,
        user: { select: { id: true, firstName: true, lastName: true, email: true, phone: true } },
        attendance: { orderBy: { checkInTime: 'desc' }, take: 1 },
      },
    });

    return activeMembers.filter((m) => {
      const lastVisit = m.attendance[0]?.checkInTime;
      return !lastVisit || lastVisit < cutoff;
    }).map((m) => ({
      memberId: m.id,
      memberCode: m.memberCode,
      user: m.user,
      lastVisit: m.attendance[0]?.checkInTime ?? null,
      daysSinceVisit: m.attendance[0]
        ? Math.floor((Date.now() - m.attendance[0].checkInTime.getTime()) / 86400000)
        : null,
    }));
  }

  /**
   * Attendance rate per member over the last N days.
   * Returns members sorted by attendance rate ascending (lowest = most at-risk).
   */
  async getAttendanceRates(gymId: string, days = 30) {
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const members = await this.prisma.member.findMany({
      where: { gymId, deletedAt: null, memberSubscriptions: { some: { status: 'ACTIVE', gymId } } },
      select: {
        id: true, memberCode: true,
        user: { select: { firstName: true, lastName: true } },
        attendance: { where: { checkInTime: { gte: since } } },
      },
    });

    return members.map((m) => ({
      memberId: m.id,
      memberCode: m.memberCode,
      name: `${m.user.firstName} ${m.user.lastName}`,
      visitCount: m.attendance.length,
      attendanceRate: +(m.attendance.length / days * 100).toFixed(1),
    })).sort((a, b) => a.attendanceRate - b.attendanceRate);
  }

  /**
   * Membership churn: memberships that expired in the last N days and were NOT renewed.
   */
  async getChurnedMembers(gymId: string, days = 30) {
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const expired = await this.prisma.memberSubscription.findMany({
      where: { gymId, status: 'EXPIRED', endDate: { gte: since, lte: new Date() } },
      include: {
        member: {
          include: {
            user: { select: { firstName: true, lastName: true, email: true, phone: true } },
          },
        },
        plan: { select: { name: true, type: true } },
      },
      orderBy: { endDate: 'desc' },
    });

    // Exclude those who already renewed (have a more recent ACTIVE subscription)
    const churnedIds = new Set<string>();
    const result = [];
    for (const sub of expired) {
      if (churnedIds.has(sub.memberId)) continue;
      const renewed = await this.prisma.memberSubscription.findFirst({
        where: { memberId: sub.memberId, gymId, status: 'ACTIVE' },
      });
      if (!renewed) {
        churnedIds.add(sub.memberId);
        result.push({
          memberId: sub.memberId,
          memberCode: sub.member.memberCode,
          user: sub.member.user,
          expiredOn: sub.endDate,
          lastPlan: sub.plan,
        });
      }
    }
    return result;
  }

  /**
   * New member cohort growth — count of new members per week for the last N weeks.
   */
  async getMemberGrowth(gymId: string, weeks = 12) {
    const result = [];
    for (let i = weeks - 1; i >= 0; i--) {
      const start = new Date(Date.now() - (i + 1) * 7 * 24 * 60 * 60 * 1000);
      const end = new Date(Date.now() - i * 7 * 24 * 60 * 60 * 1000);
      const count = await this.prisma.member.count({
        where: { gymId, createdAt: { gte: start, lt: end }, deletedAt: null },
      });
      result.push({ week: `W-${i}`, start, end, newMembers: count });
    }
    return result;
  }
}
