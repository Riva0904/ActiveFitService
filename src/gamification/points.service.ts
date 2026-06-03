import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { PrismaService } from '../prisma/prisma.service';
import { PAYMENT_COMPLETED, PaymentCompletedEvent } from '../payments/events/payment.events';

export const POINTS_CONFIG = {
  CHECKIN: 5,
  PROGRESS_LOG: 10,
  REFERRAL_SIGNUP: 50,
  MEMBERSHIP_PAYMENT: 20,
  PT_SESSION_BOOKED: 15,
} as const;

export type PointsActivity = keyof typeof POINTS_CONFIG;

@Injectable()
export class PointsService {
  private readonly logger = new Logger(PointsService.name);

  constructor(private prisma: PrismaService) {}

  /**
   * Award points to a member for an activity.
   * Points are stored in the AuditLog table under entity='Points'
   * until a dedicated Points model is added to the schema.
   */
  async award(memberId: string, gymId: string, activity: PointsActivity) {
    const points = POINTS_CONFIG[activity];
    if (!points) return;

    try {
      await this.prisma.auditLog.create({
        data: {
          gymId,
          action: `POINTS_AWARDED`,
          entity: 'Points',
          entityId: memberId,
          newValues: { activity, points, awardedAt: new Date().toISOString() },
        },
      });
    } catch (err) {
      this.logger.warn(`Failed to award ${points} points for ${activity} to member ${memberId}: ${err.message}`);
    }
  }

  async getMemberPoints(memberId: string, gymId: string): Promise<number> {
    const logs = await this.prisma.auditLog.findMany({
      where: { gymId, entity: 'Points', entityId: memberId, action: 'POINTS_AWARDED' },
      select: { newValues: true },
    });

    return logs.reduce((sum: number, log: any) => {
      const pts = (log.newValues as any)?.points ?? 0;
      return sum + pts;
    }, 0);
  }

  async getGymLeaderboard(gymId: string, limit = 10) {
    const logs = await this.prisma.auditLog.findMany({
      where: { gymId, entity: 'Points', action: 'POINTS_AWARDED' },
      select: { entityId: true, newValues: true },
    });

    const totals = new Map<string, number>();
    for (const log of logs) {
      const memberId = log.entityId;
      const pts = (log.newValues as any)?.points ?? 0;
      totals.set(memberId, (totals.get(memberId) ?? 0) + pts);
    }

    const sorted = [...totals.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit);

    const members = await Promise.all(
      sorted.map(async ([memberId, points]) => {
        const member = await this.prisma.member.findFirst({
          where: { id: memberId },
          select: { id: true, memberCode: true, user: { select: { firstName: true, lastName: true, avatar: true } } },
        });
        return { member, points, rank: 0 };
      }),
    );

    return members.filter((m) => m.member !== null).map((m, i) => ({ ...m, rank: i + 1 }));
  }

  // ─── Event Listeners ──────────────────────────────────────────────────────

  @OnEvent(PAYMENT_COMPLETED, { async: true })
  async onPaymentCompleted(event: PaymentCompletedEvent) {
    if (event.type === 'MEMBERSHIP') {
      await this.award(event.memberId, event.gymId, 'MEMBERSHIP_PAYMENT');
    }
    if (event.type === 'PT_SESSION') {
      await this.award(event.memberId, event.gymId, 'PT_SESSION_BOOKED');
    }
  }
}
