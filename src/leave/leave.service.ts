import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class LeaveService {
  constructor(private prisma: PrismaService) {}

  async applyLeave(gymId: string, userId: string, body: any) {
    const leave = await this.prisma.leaveRequest.create({
      data: {
        gymId,
        userId,
        leaveType: body.leaveType,
        startDate: new Date(body.startDate),
        endDate: new Date(body.endDate),
        reason: body.reason,
      },
      include: { user: { select: { firstName: true, lastName: true, role: true } } },
    });

    const admins = await this.prisma.user.findMany({
      where: { gymId, role: 'GYM_ADMIN', isActive: true },
      select: { id: true },
    });

    if (admins.length) {
      const applicantName = `${leave.user.firstName} ${leave.user.lastName}`;
      const role = leave.user.role === 'TRAINER' ? 'Trainer' : 'Staff';
      await this.prisma.notification.createMany({
        data: admins.map((a) => ({
          gymId,
          userId: a.id,
          type: 'LEAVE_REQUEST' as const,
          channel: 'IN_APP' as const,
          title: `${role} Leave Request`,
          message: `${applicantName} has applied for ${body.leaveType.toLowerCase()} leave from ${new Date(body.startDate).toLocaleDateString()} to ${new Date(body.endDate).toLocaleDateString()}.`,
          metadata: { leaveId: leave.id, applicantId: userId },
        })),
      });
    }

    return leave;
  }

  async getMyLeaves(userId: string, query: any) {
    const page = +(query.page ?? 1);
    const limit = +(query.limit ?? 10);
    const skip = (page - 1) * limit;

    const [leaves, total] = await Promise.all([
      this.prisma.leaveRequest.findMany({
        where: { userId },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.leaveRequest.count({ where: { userId } }),
    ]);

    return { data: leaves, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async getAllLeaves(gymId: string, query: any) {
    const page = +(query.page ?? 1);
    const limit = +(query.limit ?? 10);
    const skip = (page - 1) * limit;
    const where: any = { gymId };
    if (query.status) where.status = query.status;
    if (query.role) where.user = { role: query.role };

    const [leaves, total] = await Promise.all([
      this.prisma.leaveRequest.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          user: { select: { id: true, firstName: true, lastName: true, email: true, role: true, avatar: true } },
        },
      }),
      this.prisma.leaveRequest.count({ where }),
    ]);

    return { data: leaves, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async reviewLeave(gymId: string, leaveId: string, adminUserId: string, action: 'APPROVED' | 'REJECTED', adminNote?: string) {
    const leave = await this.prisma.leaveRequest.findFirst({ where: { id: leaveId, gymId } });
    if (!leave) throw new NotFoundException('Leave request not found');
    if (leave.status !== 'PENDING') throw new BadRequestException('Leave already reviewed');

    const updated = await this.prisma.leaveRequest.update({
      where: { id: leaveId },
      data: { status: action, adminNote, reviewedBy: adminUserId, reviewedAt: new Date() },
      include: { user: { select: { firstName: true, lastName: true } } },
    });

    const label = action === 'APPROVED' ? 'approved' : 'rejected';
    await this.prisma.notification.create({
      data: {
        gymId,
        userId: leave.userId,
        type: 'LEAVE_REQUEST' as const,
        channel: 'IN_APP' as const,
        title: `Leave ${action === 'APPROVED' ? 'Approved' : 'Rejected'}`,
        message: `Your leave request from ${leave.startDate.toLocaleDateString()} to ${leave.endDate.toLocaleDateString()} has been ${label}.${adminNote ? ` Note: ${adminNote}` : ''}`,
        metadata: { leaveId },
      },
    });

    return updated;
  }
}
