import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from '../email/email.service';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationType } from '@prisma/client';

@Injectable()
export class RenewalRemindersService {
  private readonly logger = new Logger(RenewalRemindersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly emailService: EmailService,
    private readonly notificationsService: NotificationsService,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_6AM)
  async sendDailyReminders() {
    this.logger.log('Running daily membership renewal reminders...');
    await this.sendDailyRemindersForAll();
  }

  async sendDailyRemindersForAll() {
    const gyms = await this.prisma.gym.findMany({
      where: { renewalRemindersEnabled: true, status: 'ACTIVE' },
      select: { id: true },
    });

    let totalSent = 0;
    for (const gym of gyms) {
      totalSent += await this.processGym(gym.id);
    }
    this.logger.log(`Renewal reminders sent: ${totalSent}`);
    return totalSent;
  }

  async processGym(gymId: string): Promise<number> {
    const thresholds = [30, 14, 7, 3, 1];
    const now = new Date();
    const maxDays = 31;
    const cutoff = new Date(now);
    cutoff.setDate(cutoff.getDate() + maxDays);

    const subscriptions = await this.prisma.memberSubscription.findMany({
      where: {
        gymId,
        status: 'ACTIVE',
        endDate: { gte: now, lte: cutoff },
      },
      include: {
        member: { include: { user: true } },
        plan: true,
      },
    });

    let sent = 0;
    for (const sub of subscriptions) {
      const msLeft = sub.endDate.getTime() - now.getTime();
      const daysLeft = Math.ceil(msLeft / (1000 * 60 * 60 * 24));
      const threshold = thresholds.find((t) => t === daysLeft);
      if (!threshold) continue;
      if (sub.remindersSent.includes(threshold)) continue;

      const user = sub.member.user;
      try {
        await this.emailService.sendMembershipRenewalReminder(
          user.email,
          `${user.firstName} ${user.lastName}`,
          daysLeft,
          sub.plan.type,
        );
        await this.notificationsService.create({
          userId: user.id,
          gymId,
          type: NotificationType.MEMBERSHIP_EXPIRY,
          title: `Membership Expiring in ${daysLeft} Day${daysLeft === 1 ? '' : 's'}`,
          message: `Your ${sub.plan.type.toLowerCase()} membership expires on ${sub.endDate.toLocaleDateString('en-IN')}. Renew now to keep your access.`,
        });
        await this.prisma.memberSubscription.update({
          where: { id: sub.id },
          data: { remindersSent: { push: threshold } },
        });
        sent++;
      } catch (err) {
        this.logger.error(`Failed reminder for subscription ${sub.id}: ${err.message}`);
      }
    }
    return sent;
  }

  async previewToday(gymId: string) {
    const thresholds = [30, 14, 7, 3, 1];
    const now = new Date();
    const cutoff = new Date(now);
    cutoff.setDate(cutoff.getDate() + 31);

    const subscriptions = await this.prisma.memberSubscription.findMany({
      where: {
        gymId,
        status: 'ACTIVE',
        endDate: { gte: now, lte: cutoff },
      },
      include: { member: { include: { user: true } }, plan: true },
    });

    const results = [];
    for (const sub of subscriptions) {
      const msLeft = sub.endDate.getTime() - now.getTime();
      const daysLeft = Math.ceil(msLeft / (1000 * 60 * 60 * 24));
      const threshold = thresholds.find((t) => t === daysLeft);
      if (!threshold || sub.remindersSent.includes(threshold)) continue;
      results.push({
        memberId: sub.memberId,
        memberName: `${sub.member.user.firstName} ${sub.member.user.lastName}`,
        email: sub.member.user.email,
        planType: sub.plan.type,
        endDate: sub.endDate,
        daysLeft,
      });
    }
    return results;
  }
}
