import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationType } from '@prisma/client';

@Injectable()
export class ReferralsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
  ) {}

  generateReferralCode(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    return Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  }

  async getMyInfo(userId: string, gymId: string) {
    const member = await this.prisma.member.findFirst({
      where: { userId, gymId },
      include: {
        referrals: {
          include: {
            user: { select: { firstName: true, lastName: true, createdAt: true } },
            memberSubscriptions: { where: { status: 'ACTIVE' }, select: { id: true } },
          },
        },
      },
    });

    if (!member) return { referralCode: null, referralCredit: 0, referrals: [] };

    return {
      referralCode: member.referralCode,
      referralCredit: member.referralCredit,
      referrals: member.referrals.map((r) => ({
        name: `${r.user.firstName} ${r.user.lastName}`,
        joinedAt: r.user.createdAt,
        hasActiveMembership: r.memberSubscriptions.length > 0,
      })),
    };
  }

  async getAdminChain(memberId: string, gymId: string) {
    const member = await this.prisma.member.findFirst({
      where: { id: memberId, gymId },
      include: {
        referredBy: { include: { user: { select: { firstName: true, lastName: true, email: true } } } },
        referrals: {
          include: { user: { select: { firstName: true, lastName: true, email: true } } },
        },
      },
    });
    return member;
  }

  async awardReferralCredit(newMemberId: string, gymId: string) {
    const member = await this.prisma.member.findFirst({
      where: { id: newMemberId, gymId },
      include: { referredBy: { include: { user: true } } },
    });

    if (!member?.referredBy) return;

    const referrer = member.referredBy;
    await this.prisma.member.update({
      where: { id: referrer.id },
      data: { referralCredit: { increment: 500 } },
    });

    await this.notificationsService.create({
      userId: referrer.userId,
      gymId,
      type: NotificationType.REFERRAL,
      title: 'Referral Bonus Earned!',
      message: `A friend you referred has joined and activated their membership. ₹500 credit has been added to your account!`,
    });
  }

  async redeemCredit(memberId: string, amount: number) {
    await this.prisma.member.update({
      where: { id: memberId },
      data: { referralCredit: { decrement: amount } },
    });
  }
}
