import { Injectable, NotFoundException, BadRequestException, ForbiddenException, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { CheckInMethod, Role, AttendanceCloseReason } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

const WEEKDAY_NAMES = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];
const ABSENCE_THRESHOLDS: { days: number; severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' }[] = [
  { days: 30, severity: 'CRITICAL' },
  { days: 14, severity: 'HIGH' },
  { days: 7, severity: 'MEDIUM' },
  { days: 5, severity: 'LOW' },
];

@Injectable()
export class AttendanceService {
  private readonly logger = new Logger(AttendanceService.name);

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

  // ─── Smart QR flow: explicit member check-in/check-out (not a toggle) ────

  // Consecutive-day streak: bump on a new calendar day following yesterday's
  // attendance, reset to 1 on any gap > 1 day, leave untouched for a same-day
  // re-check-in (e.g. after an earlier checkout). Runs on every member
  // check-in path (smart QR + staff manual-check-in-by-code for a member).
  private async updateStreak(tx: any, memberId: string) {
    const member = await tx.member.findUnique({
      where: { id: memberId },
      select: { attendanceStreak: true, bestAttendanceStreak: true, lastAttendanceDate: true },
    });
    if (!member) return;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const last = member.lastAttendanceDate ? new Date(member.lastAttendanceDate) : null;
    if (last) last.setHours(0, 0, 0, 0);

    if (last && last.getTime() === today.getTime()) return; // already counted today

    const diffDays = last ? Math.round((today.getTime() - last.getTime()) / 86400000) : null;
    const newStreak = diffDays === 1 ? member.attendanceStreak + 1 : 1;
    const bestStreak = Math.max(member.bestAttendanceStreak, newStreak);

    await tx.member.update({
      where: { id: memberId },
      data: { attendanceStreak: newStreak, bestAttendanceStreak: bestStreak, lastAttendanceDate: today },
    });
  }

  async memberCheckIn(userId: string, gymId: string) {
    return this.prisma.$transaction(async (tx) => {
      const member = await tx.member.findFirst({ where: { userId, gymId } });
      if (!member) throw new BadRequestException('Member profile not found');

      const activeMembership = await tx.memberSubscription.findFirst({
        where: { memberId: member.id, gymId, status: 'ACTIVE' },
      });
      if (!activeMembership)
        throw new BadRequestException('Membership inactive. Please renew your membership.');

      const open = await tx.attendance.findFirst({
        where: { gymId, checkOutTime: null, OR: [{ memberId: member.id }, { userId }] },
      });
      if (open) throw new BadRequestException('Already checked in. Check out before checking in again.');

      const attendance = await tx.attendance.create({
        data: { userId, memberId: member.id, gymId, method: CheckInMethod.QR_CODE },
      });
      await this.updateStreak(tx, member.id);
      return { message: 'Attendance checked in successfully.', attendance };
    });
  }

  async memberCheckOut(userId: string, gymId: string) {
    const member = await this.prisma.member.findFirst({ where: { userId, gymId } });

    const open = await this.prisma.attendance.findFirst({
      where: {
        gymId,
        checkOutTime: null,
        OR: [{ userId }, ...(member ? [{ memberId: member.id }] : [])],
      },
    });
    if (!open) throw new BadRequestException('No active check-in found.');

    const checkOutTime = new Date();
    const durationMinutes = Math.round((checkOutTime.getTime() - open.checkInTime.getTime()) / 60000);

    const attendance = await this.prisma.attendance.update({
      where: { id: open.id },
      data: { checkOutTime, durationMinutes },
    });
    return { message: 'Attendance checked out successfully.', attendance };
  }

  async getStatus(userId: string, gymId: string) {
    const member = await this.prisma.member.findFirst({ where: { userId, gymId } });

    let membershipActive = false;
    if (member) {
      const activeMembership = await this.prisma.memberSubscription.findFirst({
        where: { memberId: member.id, gymId, status: 'ACTIVE' },
      });
      membershipActive = !!activeMembership;
    }

    const open = await this.prisma.attendance.findFirst({
      where: {
        gymId,
        checkOutTime: null,
        OR: [{ userId }, ...(member ? [{ memberId: member.id }] : [])],
      },
    });

    if (!open) return { checkedIn: false, membershipActive };
    return {
      checkedIn: true,
      membershipActive,
      attendanceId: open.id,
      checkInTime: open.checkInTime,
      durationRunning: true,
    };
  }

  async getHistory(userId: string, gymId: string, query: any = {}) {
    const { limit = 30, skip = 0 } = query;
    const member = await this.prisma.member.findFirst({ where: { userId, gymId } });

    const where: any = {
      gymId,
      OR: [{ userId }, ...(member ? [{ memberId: member.id }] : [])],
    };

    const [records, total] = await Promise.all([
      this.prisma.attendance.findMany({
        where,
        take: +limit,
        skip: +skip,
        orderBy: { checkInTime: 'desc' },
      }),
      this.prisma.attendance.count({ where }),
    ]);

    const data = records.map((r) => ({
      date: r.checkInTime,
      checkIn: r.checkInTime,
      checkOut: r.checkOutTime,
      durationMinutes: r.durationMinutes ??
        (r.checkOutTime ? Math.round((r.checkOutTime.getTime() - r.checkInTime.getTime()) / 60000) : null),
    }));

    return { data, total };
  }

  // ─── Staff/Admin: explicit manual check-in / check-out (not a toggle) ────

  private async findPersonByCode(code: string, gymId: string) {
    const member = await this.prisma.member.findFirst({
      where: { gymId, OR: [{ memberCode: code }, { qrToken: code }] },
      include: { user: true },
    });
    if (member) return { userId: member.userId, memberId: member.id, user: member.user };

    const trainer = await this.prisma.trainer.findFirst({ where: { gymId, employeeId: code }, include: { user: true } });
    if (trainer) return { userId: trainer.userId, memberId: null, user: trainer.user };

    const staff = await this.prisma.staff.findFirst({ where: { gymId, employeeId: code }, include: { user: true } });
    if (staff) return { userId: staff.userId, memberId: null, user: staff.user };

    throw new NotFoundException('No member, trainer, or staff found with this ID in your gym.');
  }

  async manualCheckIn(code: string, gymId: string, markedBy: string) {
    const person = await this.findPersonByCode(code, gymId);
    if (!person.user.isActive) throw new BadRequestException('Account is deactivated. Contact gym admin.');

    if (person.memberId) {
      const activeMembership = await this.prisma.memberSubscription.findFirst({
        where: { memberId: person.memberId, gymId, status: 'ACTIVE' },
      });
      if (!activeMembership) throw new BadRequestException('Membership inactive. Please renew your membership.');
    }

    const open = await this.prisma.attendance.findFirst({
      where: {
        gymId, checkOutTime: null,
        OR: [{ userId: person.userId }, ...(person.memberId ? [{ memberId: person.memberId }] : [])],
      },
    });
    if (open) throw new BadRequestException('Already checked in. Check out before checking in again.');

    const attendance = await this.prisma.attendance.create({
      data: { userId: person.userId, memberId: person.memberId, gymId, method: CheckInMethod.MANUAL, markedBy },
    });
    if (person.memberId) await this.updateStreak(this.prisma, person.memberId);
    return { message: 'Attendance checked in successfully.', userName: `${person.user.firstName} ${person.user.lastName}`, attendance };
  }

  async manualCheckOut(code: string, gymId: string) {
    const person = await this.findPersonByCode(code, gymId);

    const open = await this.prisma.attendance.findFirst({
      where: {
        gymId, checkOutTime: null,
        OR: [{ userId: person.userId }, ...(person.memberId ? [{ memberId: person.memberId }] : [])],
      },
    });
    if (!open) throw new BadRequestException('No active check-in found.');

    const checkOutTime = new Date();
    const durationMinutes = Math.round((checkOutTime.getTime() - open.checkInTime.getTime()) / 60000);

    const attendance = await this.prisma.attendance.update({
      where: { id: open.id },
      data: { checkOutTime, durationMinutes },
    });
    return { message: 'Attendance checked out successfully.', userName: `${person.user.firstName} ${person.user.lastName}`, attendance };
  }

  // ─── Occupancy & analytics ─────────────────────────────────────────────────

  async getOccupancy(gymId: string) {
    const gym = await this.prisma.gym.findUnique({ where: { id: gymId }, select: { maxMembers: true } });
    const currentlyIn = await this.prisma.attendance.count({ where: { gymId, checkOutTime: null } });

    const capacity = gym?.maxMembers ?? 100;
    const occupancyPercent = capacity > 0 ? Math.round((currentlyIn / capacity) * 100) : 0;
    const level = occupancyPercent <= 30 ? 'LOW' : occupancyPercent <= 70 ? 'MEDIUM' : 'HIGH';

    return { currentlyIn, capacity, occupancyPercent, level };
  }

  async getAnalytics(gymId: string) {
    const closedRecords = await this.prisma.attendance.findMany({
      where: { gymId, checkOutTime: { not: null } },
      select: { checkInTime: true, checkOutTime: true, durationMinutes: true, memberId: true, userId: true },
    });

    const durations = closedRecords.map((r) =>
      r.durationMinutes ?? Math.round((r.checkOutTime!.getTime() - r.checkInTime.getTime()) / 60000),
    );
    const avgVisitDuration = durations.length
      ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length)
      : 0;

    // Daily trend — last 30 days
    const dailyTrend: { date: string; count: number }[] = [];
    for (let i = 29; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      date.setHours(0, 0, 0, 0);
      const end = new Date(date);
      end.setHours(23, 59, 59, 999);
      const count = await this.prisma.attendance.count({ where: { gymId, checkInTime: { gte: date, lte: end } } });
      dailyTrend.push({ date: date.toISOString().split('T')[0], count });
    }

    // Monthly trend — last 12 months
    const monthlyTrend: { month: string; count: number }[] = [];
    for (let i = 11; i >= 0; i--) {
      const start = new Date();
      start.setMonth(start.getMonth() - i, 1);
      start.setHours(0, 0, 0, 0);
      const end = new Date(start);
      end.setMonth(end.getMonth() + 1);
      const count = await this.prisma.attendance.count({ where: { gymId, checkInTime: { gte: start, lt: end } } });
      monthlyTrend.push({ month: start.toLocaleDateString('en', { month: 'short', year: 'numeric' }), count });
    }

    // Peak hours — bucket all check-ins by hour of day
    const allCheckIns = await this.prisma.attendance.findMany({ where: { gymId }, select: { checkInTime: true } });
    const hourCounts = new Array(24).fill(0);
    for (const r of allCheckIns) hourCounts[r.checkInTime.getHours()]++;
    const peakHours = hourCounts.map((count, hour) => ({ hour, count })).sort((a, b) => b.count - a.count).slice(0, 5);

    // Peak day — bucket all check-ins by weekday
    const weekdayCounts = new Array(7).fill(0);
    for (const r of allCheckIns) weekdayCounts[r.checkInTime.getDay()]++;
    const peakDayIndex = weekdayCounts.reduce((best, count, i) => (count > weekdayCounts[best] ? i : best), 0);
    const peakDay = WEEKDAY_NAMES[peakDayIndex];
    const peakDayVisits = weekdayCounts[peakDayIndex];

    // Most active members — top 5 by visit count
    const grouped = await this.prisma.attendance.groupBy({
      by: ['memberId'],
      where: { gymId, memberId: { not: null } },
      _count: { memberId: true },
      orderBy: { _count: { memberId: 'desc' } },
      take: 5,
    });
    const memberIds = grouped.map((g) => g.memberId).filter((id): id is string => !!id);
    const members = await this.prisma.member.findMany({
      where: { id: { in: memberIds } },
      select: { id: true, memberCode: true, user: { select: { firstName: true, lastName: true } } },
    });
    const mostActiveMembers = grouped.map((g) => {
      const m = members.find((x) => x.id === g.memberId);
      return {
        memberId: g.memberId,
        memberCode: m?.memberCode ?? null,
        name: m ? `${m.user.firstName} ${m.user.lastName}` : 'Unknown',
        visitCount: g._count.memberId,
      };
    });

    return { avgVisitDuration, dailyTrend, monthlyTrend, peakHours, mostActiveMembers, peakDay, peakDayVisits };
  }

  // ─── Feature 1: attendance streak ──────────────────────────────────────────

  async getStreak(userId: string, gymId: string) {
    const member = await this.prisma.member.findFirst({
      where: { userId, gymId },
      select: { attendanceStreak: true, bestAttendanceStreak: true },
    });
    if (!member) throw new BadRequestException('Member profile not found');
    return { currentStreak: member.attendanceStreak, bestStreak: member.bestAttendanceStreak };
  }

  // ─── Feature 2 & 9: inactive members / absence severity ──────────────────

  async getInactiveMembers(gymId: string) {
    const members = await this.prisma.member.findMany({
      where: { gymId, deletedAt: null },
      select: {
        id: true, lastAttendanceDate: true, joinDate: true,
        user: { select: { firstName: true, lastName: true } },
      },
    });

    const now = new Date();
    const result = members
      .map((m) => {
        const since = m.lastAttendanceDate ?? m.joinDate;
        const daysAbsent = Math.floor((now.getTime() - since.getTime()) / 86400000);
        const severity = ABSENCE_THRESHOLDS.find((t) => daysAbsent >= t.days)?.severity;
        return severity
          ? { memberId: m.id, name: `${m.user.firstName} ${m.user.lastName}`, daysAbsent, severity }
          : null;
      })
      .filter((r): r is NonNullable<typeof r> => r !== null)
      .sort((a, b) => b.daysAbsent - a.daysAbsent);

    return result;
  }

  // ─── Feature 3: attendance calendar ────────────────────────────────────────

  async getCalendar(userId: string, gymId: string, month: number, year: number) {
    const member = await this.prisma.member.findFirst({ where: { userId, gymId } });
    if (!member) throw new BadRequestException('Member profile not found');

    const start = new Date(year, month - 1, 1);
    const end = new Date(year, month, 1);

    const records = await this.prisma.attendance.findMany({
      where: { gymId, memberId: member.id, checkInTime: { gte: start, lt: end } },
      select: { checkInTime: true },
    });

    const presentDates = Array.from(
      new Set(records.map((r) => r.checkInTime.toISOString().split('T')[0])),
    ).sort();

    const daysInMonth = new Date(year, month, 0).getDate();
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const daysElapsed = (year === today.getFullYear() && month === today.getMonth() + 1)
      ? today.getDate()
      : (end <= today ? daysInMonth : 0);

    const attendanceRate = daysElapsed > 0 ? Math.round((presentDates.length / daysElapsed) * 100) : 0;

    return { presentDates, attendanceRate };
  }

  // ─── Feature 5: auto-checkout cron ─────────────────────────────────────────

  @Cron('59 23 * * *', { name: 'attendanceAutoCheckout' })
  async autoCheckoutStaleSessions() {
    const eightHoursAgo = new Date(Date.now() - 8 * 60 * 60 * 1000);

    const stale = await this.prisma.attendance.findMany({
      where: { checkOutTime: null, checkInTime: { lt: eightHoursAgo } },
    });

    for (const record of stale) {
      const checkOutTime = new Date();
      const durationMinutes = Math.round((checkOutTime.getTime() - record.checkInTime.getTime()) / 60000);
      await this.prisma.attendance.update({
        where: { id: record.id },
        data: { checkOutTime, durationMinutes, closeReason: AttendanceCloseReason.AUTO_CHECKOUT },
      });
    }

    if (stale.length) this.logger.log(`Auto-checked-out ${stale.length} stale attendance session(s)`);
    return { autoCheckedOut: stale.length };
  }

  // ─── Feature 6: occupancy trend ────────────────────────────────────────────

  @Cron(CronExpression.EVERY_30_MINUTES, { name: 'occupancySnapshot' })
  async captureOccupancySnapshots() {
    const gyms = await this.prisma.gym.findMany({ where: { status: 'ACTIVE' }, select: { id: true } });
    for (const gym of gyms) {
      const occupancyCount = await this.prisma.attendance.count({ where: { gymId: gym.id, checkOutTime: null } });
      await this.prisma.occupancySnapshot.create({ data: { gymId: gym.id, occupancyCount } });
    }
  }

  async getOccupancyTrend(gymId: string) {
    const start = new Date();
    start.setHours(0, 0, 0, 0);

    const snapshots = await this.prisma.occupancySnapshot.findMany({
      where: { gymId, createdAt: { gte: start } },
      orderBy: { createdAt: 'asc' },
    });

    return snapshots.map((s) => ({
      time: s.createdAt.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false }),
      count: s.occupancyCount,
    }));
  }

  // ─── Feature 7: leaderboard ─────────────────────────────────────────────────

  async getLeaderboard(gymId: string) {
    const start = new Date();
    start.setDate(1);
    start.setHours(0, 0, 0, 0);

    const grouped = await this.prisma.attendance.groupBy({
      by: ['memberId'],
      where: { gymId, memberId: { not: null }, checkInTime: { gte: start } },
      _count: { memberId: true },
      orderBy: { _count: { memberId: 'desc' } },
      take: 10,
    });

    const memberIds = grouped.map((g) => g.memberId).filter((id): id is string => !!id);
    const members = await this.prisma.member.findMany({
      where: { id: { in: memberIds } },
      select: { id: true, user: { select: { firstName: true, lastName: true } } },
    });

    return grouped.map((g, i) => {
      const m = members.find((x) => x.id === g.memberId);
      return {
        rank: i + 1,
        memberName: m ? `${m.user.firstName} ${m.user.lastName}` : 'Unknown',
        visits: g._count.memberId,
      };
    });
  }

  // ─── Feature 10: member insights ───────────────────────────────────────────

  async getMyInsights(userId: string, gymId: string) {
    const member = await this.prisma.member.findFirst({
      where: { userId, gymId },
      select: { attendanceStreak: true, bestAttendanceStreak: true },
    });
    if (!member) throw new BadRequestException('Member profile not found');

    const records = await this.prisma.attendance.findMany({
      where: { gymId, userId },
      select: { checkInTime: true, checkOutTime: true, durationMinutes: true },
    });

    const totalVisits = records.length;
    const durations = records
      .filter((r) => r.checkOutTime)
      .map((r) => r.durationMinutes ?? Math.round((r.checkOutTime!.getTime() - r.checkInTime.getTime()) / 60000));
    const avgDuration = durations.length ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length) : 0;

    const weekdayCounts = new Array(7).fill(0);
    const hourCounts = new Array(24).fill(0);
    for (const r of records) {
      weekdayCounts[r.checkInTime.getDay()]++;
      hourCounts[r.checkInTime.getHours()]++;
    }
    const favoriteDayIndex = weekdayCounts.reduce((best, count, i) => (count > weekdayCounts[best] ? i : best), 0);
    const favoriteHourIndex = hourCounts.reduce((best, count, i) => (count > hourCounts[best] ? i : best), 0);

    return {
      totalVisits,
      avgDuration,
      currentStreak: member.attendanceStreak,
      bestStreak: member.bestAttendanceStreak,
      favoriteDay: totalVisits ? WEEKDAY_NAMES[favoriteDayIndex] : null,
      favoriteHour: totalVisits ? `${String(favoriteHourIndex).padStart(2, '0')}:00` : null,
    };
  }

  // ─── Feature 8: exports ─────────────────────────────────────────────────────

  async getExportRecords(gymId: string, filters: any) {
    const where: any = { gymId };
    if (filters.startDate || filters.endDate) {
      where.checkInTime = {};
      if (filters.startDate) where.checkInTime.gte = new Date(filters.startDate);
      if (filters.endDate) where.checkInTime.lte = new Date(filters.endDate);
    }
    if (filters.memberId) where.memberId = filters.memberId;
    if (filters.trainerId) where.userId = filters.trainerId;

    const records = await this.prisma.attendance.findMany({
      where,
      orderBy: { checkInTime: 'desc' },
      include: {
        member: {
          select: {
            memberCode: true,
            user: { select: { firstName: true, lastName: true } },
            memberSubscriptions: {
              where: filters.planId ? { planId: filters.planId } : undefined,
              take: 1,
              select: { plan: { select: { name: true } } },
            },
          },
        },
        user: { select: { firstName: true, lastName: true, role: true } },
      },
    });

    // planId filter applied post-query since it's on the related subscription, not the attendance row
    const filtered = filters.planId
      ? records.filter((r) => (r.member?.memberSubscriptions?.length ?? 0) > 0)
      : records;

    return filtered.map((r) => ({
      name: r.member ? `${r.member.user.firstName} ${r.member.user.lastName}` : `${r.user?.firstName} ${r.user?.lastName}`,
      checkIn: r.checkInTime,
      checkOut: r.checkOutTime,
      duration: r.durationMinutes ?? (r.checkOutTime ? Math.round((r.checkOutTime.getTime() - r.checkInTime.getTime()) / 60000) : null),
      status: r.checkOutTime ? 'Completed' : 'Active',
    }));
  }
}
