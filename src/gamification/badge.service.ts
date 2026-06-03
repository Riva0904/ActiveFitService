import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface Badge {
  id: string;
  name: string;
  description: string;
  icon: string;
  earned: boolean;
  earnedAt?: Date;
}

const BADGE_DEFINITIONS = [
  { id: 'first_checkin', name: 'First Step', description: 'Complete your first gym check-in', icon: '👟', threshold: 1, metric: 'checkins' },
  { id: 'streak_7', name: 'Week Warrior', description: 'Check in 7 days in a row', icon: '🔥', threshold: 7, metric: 'streak' },
  { id: 'streak_30', name: 'Iron Commitment', description: 'Check in 30 days in a row', icon: '💪', threshold: 30, metric: 'streak' },
  { id: 'checkins_50', name: 'Half Century', description: '50 total check-ins', icon: '🏅', threshold: 50, metric: 'checkins' },
  { id: 'checkins_100', name: 'Centurion', description: '100 total check-ins', icon: '🥇', threshold: 100, metric: 'checkins' },
  { id: 'referral_1', name: 'Ambassador', description: 'Refer your first friend', icon: '🤝', threshold: 1, metric: 'referrals' },
  { id: 'referral_5', name: 'Influencer', description: 'Refer 5 friends', icon: '⭐', threshold: 5, metric: 'referrals' },
  { id: 'progress_5', name: 'Tracker', description: 'Log 5 progress entries', icon: '📊', threshold: 5, metric: 'progress_logs' },
];

@Injectable()
export class BadgeService {
  constructor(private prisma: PrismaService) {}

  async getMemberBadges(memberId: string, gymId: string): Promise<Badge[]> {
    const [totalCheckins, referralCount, progressLogs] = await Promise.all([
      this.prisma.attendance.count({ where: { memberId, gymId } }),
      this.prisma.member.count({ where: { referredById: memberId, gymId } }),
      this.prisma.progressLog.count({ where: { memberId, gymId } }),
    ]);

    const currentStreak = await this.calculateStreak(memberId, gymId);

    const metrics: Record<string, number> = {
      checkins: totalCheckins,
      streak: currentStreak,
      referrals: referralCount,
      progress_logs: progressLogs,
    };

    return BADGE_DEFINITIONS.map((def) => ({
      id: def.id,
      name: def.name,
      description: def.description,
      icon: def.icon,
      earned: (metrics[def.metric] ?? 0) >= def.threshold,
    }));
  }

  private async calculateStreak(memberId: string, gymId: string): Promise<number> {
    const recentAttendance = await this.prisma.attendance.findMany({
      where: { memberId, gymId },
      orderBy: { checkInTime: 'desc' },
      take: 60,
      select: { checkInTime: true },
    });

    if (recentAttendance.length === 0) return 0;

    let streak = 0;
    let expectedDate = new Date();
    expectedDate.setHours(0, 0, 0, 0);

    for (const record of recentAttendance) {
      const visitDate = new Date(record.checkInTime);
      visitDate.setHours(0, 0, 0, 0);

      const diffDays = Math.floor((expectedDate.getTime() - visitDate.getTime()) / 86400000);
      if (diffDays === 0 || diffDays === 1) {
        streak++;
        expectedDate = visitDate;
      } else {
        break;
      }
    }

    return streak;
  }
}
