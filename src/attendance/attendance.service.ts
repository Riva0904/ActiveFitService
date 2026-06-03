import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { CheckInMethod, Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AttendanceService {
  constructor(private prisma: PrismaService) {}

  // ─── Admin: manual check-in for a member ───────────────────────────────────

  async checkIn(userId: string, gymId: string, method: CheckInMethod = CheckInMethod.MANUAL) {
    return this.prisma.$transaction(async (tx) => {
      const member = await tx.member.findFirst({ where: { userId, gymId } });
      if (!member) throw new BadRequestException('Member profile not found');

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const existing = await tx.attendance.findFirst({
        where: {
          gymId,
          checkInTime: { gte: today },
          checkOutTime: null,
          OR: [{ memberId: member.id }, { userId }],
        },
      });
      if (existing) throw new BadRequestException('Already checked in for today');

      const activeMembership = await tx.memberSubscription.findFirst({
        where: { memberId: member.id, gymId, status: 'ACTIVE' },
      });
      if (!activeMembership) throw new BadRequestException('No active membership found');

      return tx.attendance.create({
        data: { userId, memberId: member.id, gymId, method },
        include: {
          member: {
            select: {
              id: true,
              memberCode: true,
              user: { select: { firstName: true, lastName: true, avatar: true } },
            },
          },
        },
      });
    });
  }

  // ─── Admin: manual check-in for any person in the gym (member / trainer / staff) ─

  async adminManualCheckIn(code: string, gymId: string) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // 1. Try member by memberCode or qrToken, scoped to this gym
    const member = await this.prisma.member.findFirst({
      where: { gymId, OR: [{ memberCode: code }, { qrToken: code }] },
      include: { user: true },
    });

    if (member) {
      if (!member.user.isActive)
        throw new BadRequestException('Member account is deactivated. Contact gym admin.');

      // Placeholder so the outer if-block below remains valid (gymId already enforced above)
      if (member.gymId !== gymId)
        throw new NotFoundException('Member does not belong to this gym.');
      if (!member.user.isActive)
        throw new BadRequestException('Member account is deactivated. Contact gym admin.');

      const activeMembership = await this.prisma.memberSubscription.findFirst({
        where: { memberId: member.id, gymId, status: 'ACTIVE' },
      });
      if (!activeMembership)
        throw new BadRequestException('No active membership. Please renew.');

      const active = await this.prisma.attendance.findFirst({
        where: {
          gymId,
          checkInTime: { gte: today },
          checkOutTime: null,
          OR: [{ memberId: member.id }, { userId: member.userId }],
        },
      });

      if (active) {
        await this.prisma.attendance.update({ where: { id: active.id }, data: { checkOutTime: new Date() } });
        return { action: 'CHECKOUT', userName: `${member.user.firstName} ${member.user.lastName}`, userRole: member.user.role, code: member.memberCode };
      }
      await this.prisma.attendance.create({
        data: { userId: member.userId, memberId: member.id, gymId, method: CheckInMethod.MANUAL },
      });
      return { action: 'CHECKIN', userName: `${member.user.firstName} ${member.user.lastName}`, userRole: member.user.role, code: member.memberCode };
    }

    // 2. Try trainer by employeeId
    const trainer = await this.prisma.trainer.findFirst({
      where: { gymId, employeeId: code },
      include: { user: true },
    });

    if (trainer) {
      if (!trainer.user.isActive)
        throw new BadRequestException('Trainer account is deactivated. Contact gym admin.');

      const active = await this.prisma.attendance.findFirst({
        where: { userId: trainer.userId, gymId, checkInTime: { gte: today }, checkOutTime: null },
      });

      if (active) {
        await this.prisma.attendance.update({ where: { id: active.id }, data: { checkOutTime: new Date() } });
        return { action: 'CHECKOUT', userName: `${trainer.user.firstName} ${trainer.user.lastName}`, userRole: trainer.user.role, code: trainer.employeeId };
      }
      await this.prisma.attendance.create({
        data: { userId: trainer.userId, gymId, method: CheckInMethod.MANUAL },
      });
      return { action: 'CHECKIN', userName: `${trainer.user.firstName} ${trainer.user.lastName}`, userRole: trainer.user.role, code: trainer.employeeId };
    }

    // 3. Try staff by employeeId
    const staff = await this.prisma.staff.findFirst({
      where: { gymId, employeeId: code },
      include: { user: true },
    });

    if (staff) {
      if (!staff.user.isActive)
        throw new BadRequestException('Staff account is deactivated. Contact gym admin.');

      const active = await this.prisma.attendance.findFirst({
        where: { userId: staff.userId, gymId, checkInTime: { gte: today }, checkOutTime: null },
      });

      if (active) {
        await this.prisma.attendance.update({ where: { id: active.id }, data: { checkOutTime: new Date() } });
        return { action: 'CHECKOUT', userName: `${staff.user.firstName} ${staff.user.lastName}`, userRole: staff.user.role, code: staff.employeeId };
      }
      await this.prisma.attendance.create({
        data: { userId: staff.userId, gymId, method: CheckInMethod.MANUAL },
      });
      return { action: 'CHECKIN', userName: `${staff.user.firstName} ${staff.user.lastName}`, userRole: staff.user.role, code: staff.employeeId };
    }

    throw new NotFoundException('No member, trainer, or staff found with this ID in your gym.');
  }

  // ─── Admin: QR / memberCode scan (admin kiosk only) ───────────────────────

  async checkInByQr(code: string, gymId: string) {
    const member = await this.prisma.member.findFirst({
      where: { gymId, OR: [{ qrToken: code }, { memberCode: code }] },
      include: { user: true },
    });
    if (!member) throw new NotFoundException('Invalid QR code or member ID');
    if (!member.user.isActive)
      throw new BadRequestException('Member account is deactivated. Please contact the gym admin.');

    const activeMembership = await this.prisma.memberSubscription.findFirst({
      where: { memberId: member.id, gymId, status: 'ACTIVE' },
    });
    if (!activeMembership)
      throw new BadRequestException('No active membership found. Please renew your membership.');

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const activeCheckIn = await this.prisma.attendance.findFirst({
      where: {
        gymId,
        checkInTime: { gte: today },
        checkOutTime: null,
        OR: [{ memberId: member.id }, { userId: member.userId }],
      },
    });

    if (activeCheckIn) {
      const updated = await this.prisma.attendance.update({
        where: { id: activeCheckIn.id },
        data: { checkOutTime: new Date() },
        include: {
          member: {
            select: {
              id: true, memberCode: true,
              user: { select: { firstName: true, lastName: true, avatar: true } },
            },
          },
        },
      });
      return { ...updated, action: 'CHECKOUT' };
    }

    const record = await this.checkIn(member.user.id, gymId, CheckInMethod.QR_CODE);
    return { ...record, action: 'CHECKIN' };
  }

  // ─── Self check-in: member/trainer/staff scan static gym QR ──────────────

  async selfCheckIn(userId: string, gymId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true, gymId: true, role: true,
        firstName: true, lastName: true, isActive: true,
        member: true,
      },
    });

    if (!user || user.gymId !== gymId)
      throw new NotFoundException('Account not found. Please contact gym administration.');
    if (!user.isActive)
      throw new BadRequestException('Account is deactivated. Please contact gym administration.');

    const allowedRoles: Role[] = [Role.MEMBER, Role.TRAINER, Role.STAFF];
    if (!allowedRoles.includes(user.role))
      throw new ForbiddenException('Self check-in is only available for members, trainers, and staff.');

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (user.role === Role.MEMBER) {
      const member = user.member;
      if (!member) throw new BadRequestException('Member profile not found.');

      const activeMembership = await this.prisma.memberSubscription.findFirst({
        where: { memberId: member.id, gymId, status: 'ACTIVE' },
      });
      if (!activeMembership)
        throw new BadRequestException('No active membership. Please renew your membership.');

      const active = await this.prisma.attendance.findFirst({
        where: {
          gymId,
          checkInTime: { gte: today },
          checkOutTime: null,
          OR: [{ memberId: member.id }, { userId }],
        },
      });

      if (active) {
        await this.prisma.attendance.update({
          where: { id: active.id },
          data: { checkOutTime: new Date() },
        });
        return {
          action: 'CHECKOUT',
          userName: `${user.firstName} ${user.lastName}`,
          userRole: user.role,
          checkInTime: active.checkInTime,
          checkOutTime: new Date(),
        };
      }

      await this.prisma.attendance.create({
        data: { userId, memberId: member.id, gymId, method: CheckInMethod.QR_CODE },
      });
      return {
        action: 'CHECKIN',
        userName: `${user.firstName} ${user.lastName}`,
        userRole: user.role,
        checkInTime: new Date(),
      };
    }

    // TRAINER or STAFF
    const active = await this.prisma.attendance.findFirst({
      where: { userId, gymId, checkInTime: { gte: today }, checkOutTime: null },
    });

    if (active) {
      await this.prisma.attendance.update({
        where: { id: active.id },
        data: { checkOutTime: new Date() },
      });
      return {
        action: 'CHECKOUT',
        userName: `${user.firstName} ${user.lastName}`,
        userRole: user.role,
        checkInTime: active.checkInTime,
        checkOutTime: new Date(),
      };
    }

    await this.prisma.attendance.create({
      data: { userId, gymId, method: CheckInMethod.QR_CODE },
    });
    return {
      action: 'CHECKIN',
      userName: `${user.firstName} ${user.lastName}`,
      userRole: user.role,
      checkInTime: new Date(),
    };
  }

  // ─── Current check-in status for any user ────────────────────────────────

  async getMyStatus(userId: string, gymId: string) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Check by userId first (trainer/staff + new member check-ins)
    const byUserId = await this.prisma.attendance.findFirst({
      where: { userId, gymId, checkInTime: { gte: today }, checkOutTime: null },
    });
    if (byUserId) {
      return { isCheckedIn: true, checkInTime: byUserId.checkInTime, id: byUserId.id };
    }

    // Backward compat: member records created before userId field was added
    const member = await this.prisma.member.findFirst({ where: { userId, gymId } });
    if (member) {
      const byMemberId = await this.prisma.attendance.findFirst({
        where: { memberId: member.id, gymId, checkInTime: { gte: today }, checkOutTime: null },
      });
      if (byMemberId) {
        return { isCheckedIn: true, checkInTime: byMemberId.checkInTime, id: byMemberId.id };
      }
    }

    return { isCheckedIn: false };
  }

  // ─── Own attendance history (any role) ───────────────────────────────────

  async getMyAttendance(userId: string, gymId: string, query: any = {}) {
    const { limit = 30, skip = 0 } = query;

    const member = await this.prisma.member.findFirst({ where: { userId, gymId } });

    const where: any = {
      gymId,
      OR: [
        { userId },
        ...(member ? [{ memberId: member.id }] : []),
      ],
    };

    const [records, total] = await Promise.all([
      this.prisma.attendance.findMany({
        where,
        take: +limit,
        skip: +skip,
        orderBy: { checkInTime: 'desc' },
        include: {
          member: {
            select: {
              id: true, memberCode: true,
              user: { select: { id: true, firstName: true, lastName: true } },
            },
          },
          user: { select: { id: true, firstName: true, lastName: true, role: true } },
        },
      }),
      this.prisma.attendance.count({ where }),
    ]);

    return { data: records, total };
  }

  // ─── Admin: check-out ─────────────────────────────────────────────────────

  async checkOut(attendanceId: string, userId: string) {
    const member = await this.prisma.member.findFirst({ where: { userId } });

    const where: any = { id: attendanceId, checkOutTime: null };
    if (member) where.memberId = member.id;

    const attendance = await this.prisma.attendance.findFirst({ where });
    if (!attendance) throw new NotFoundException('Active check-in not found');

    return this.prisma.attendance.update({
      where: { id: attendanceId },
      data: { checkOutTime: new Date() },
    });
  }

  // ─── Admin: all attendance records ───────────────────────────────────────

  async findAll(query: any, gymId?: string) {
    const { page = 1, limit = 20, date } = query;
    const skip = (page - 1) * +limit;

    const where: any = {};
    if (gymId) where.gymId = gymId;
    if (date) {
      const start = new Date(date);
      start.setHours(0, 0, 0, 0);
      const end = new Date(date);
      end.setHours(23, 59, 59, 999);
      where.checkInTime = { gte: start, lte: end };
    }

    const [records, total] = await Promise.all([
      this.prisma.attendance.findMany({
        where,
        skip,
        take: +limit,
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

    return { data: records, total, page: +page, limit: +limit, totalPages: Math.ceil(total / +limit) };
  }

  // ─── Stats ────────────────────────────────────────────────────────────────

  async getTodayStats(gymId: string) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [totalToday, currentlyIn, totalMembers] = await Promise.all([
      this.prisma.attendance.count({ where: { gymId, checkInTime: { gte: today } } }),
      this.prisma.attendance.count({ where: { gymId, checkInTime: { gte: today }, checkOutTime: null } }),
      this.prisma.member.count({ where: { gymId } }),
    ]);

    return { totalToday, currentlyIn, totalMembers };
  }

  async getWeeklyReport(gymId: string) {
    const days = [];
    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      date.setHours(0, 0, 0, 0);
      const end = new Date(date);
      end.setHours(23, 59, 59, 999);

      const count = await this.prisma.attendance.count({
        where: { gymId, checkInTime: { gte: date, lte: end } },
      });
      days.push({ date: date.toISOString().split('T')[0], count });
    }
    return days;
  }
}
