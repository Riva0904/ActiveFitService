import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AttendanceService } from '../attendance/attendance.service';

@Injectable()
export class MobileService {
  private readonly logger = new Logger(MobileService.name);

  constructor(
    private prisma: PrismaService,
    private attendanceService: AttendanceService,
  ) {}

  /**
   * Compressed home data — all info the mobile home screen needs in a single DB round-trip.
   */
  async getHomeData(userId: string, gymId: string) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [user, member, attendance] = await Promise.all([
      this.prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true, firstName: true, lastName: true, email: true,
          phone: true, avatar: true, role: true,
          gym: { select: { id: true, name: true, logo: true } },
        },
      }),
      this.prisma.member.findFirst({
        where: { userId, gymId },
        include: {
          memberSubscriptions: {
            where: { status: 'ACTIVE', gymId },
            include: { plan: { select: { name: true, type: true, durationMonths: true } } },
            take: 1,
            orderBy: { createdAt: 'desc' },
          },
          workoutAssignments: {
            where: { isActive: true, gymId },
            include: { workoutPlan: { select: { id: true, name: true, goal: true, difficulty: true } } },
            take: 1,
          },
          dietAssignments: {
            where: { isActive: true, gymId },
            include: { dietPlan: { select: { id: true, name: true } } },
            take: 1,
          },
        },
      }),
      this.prisma.attendance.findFirst({
        where: { userId, gymId, checkInTime: { gte: today }, checkOutTime: null },
      }),
    ]);

    return {
      user,
      membership: member?.memberSubscriptions[0] ?? null,
      memberCode: member?.memberCode ?? null,
      qrToken: member?.qrToken ?? null,
      activeWorkout: member?.workoutAssignments[0]?.workoutPlan ?? null,
      activeDiet: member?.dietAssignments[0]?.dietPlan ?? null,
      isCheckedInToday: !!attendance,
      checkedInAt: attendance?.checkInTime ?? null,
    };
  }

  async registerPushToken(userId: string, token: string, platform: 'ios' | 'android') {
    // Stored in AuditLog until a dedicated PushToken model is added
    await this.prisma.auditLog.create({
      data: {
        action: 'PUSH_TOKEN_REGISTERED',
        entity: 'PushToken',
        entityId: userId,
        newValues: { token, platform, registeredAt: new Date().toISOString() },
      },
    });
    return { registered: true };
  }

  async selfCheckIn(userId: string, gymId: string) {
    return this.attendanceService.selfCheckIn(userId, gymId);
  }
}
