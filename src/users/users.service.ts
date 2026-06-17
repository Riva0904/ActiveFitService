import { Injectable, NotFoundException, ConflictException, ForbiddenException, BadRequestException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';

import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from '../email/email.service';
import { AuditService } from '../common/services/audit.service';

@Injectable()
export class UsersService {
  constructor(
    private prisma: PrismaService,
    private emailService: EmailService,
    private auditService: AuditService,
  ) {}

  private async checkPlanLimits(gymId: string, targetRole: string): Promise<void> {
    const gym = await this.prisma.gym.findUnique({
      where: { id: gymId },
      select: { saasPlan: true },
    });
    if (!gym) return;

    const plan = await this.prisma.saaSSubscriptionPlan.findUnique({
      where: { plan: gym.saasPlan },
      select: { maxMembers: true, maxTrainers: true, maxStaff: true },
    });
    if (!plan) return;

    if (targetRole === 'MEMBER') {
      const count = await this.prisma.member.count({ where: { gymId, deletedAt: null } });
      if (count >= plan.maxMembers) {
        throw new BadRequestException(
          `Your ${gym.saasPlan} plan allows a maximum of ${plan.maxMembers} members. Please upgrade your plan.`,
        );
      }
    } else if (targetRole === 'TRAINER') {
      const count = await this.prisma.trainer.count({ where: { gymId, deletedAt: null } });
      if (count >= plan.maxTrainers) {
        throw new BadRequestException(
          `Your ${gym.saasPlan} plan allows a maximum of ${plan.maxTrainers} trainers. Please upgrade your plan.`,
        );
      }
    } else if (targetRole === 'STAFF') {
      const count = await this.prisma.staff.count({ where: { gymId, deletedAt: null } });
      if (count >= plan.maxStaff) {
        throw new BadRequestException(
          `Your ${gym.saasPlan} plan allows a maximum of ${plan.maxStaff} staff members. Please upgrade your plan.`,
        );
      }
    }
  }

  async createUser(data: any, creatorRole: string, creatorGymId?: string) {
    // SUPER_ADMIN creates GYM_ADMIN
    // GYM_ADMIN creates MEMBER, TRAINER, or STAFF within their gym
    const GYM_ROLES = ['MEMBER', 'TRAINER', 'STAFF'];

    if (creatorRole === 'SUPER_ADMIN') {
      const targetRole = data.role ?? 'GYM_ADMIN';
      if (targetRole !== 'GYM_ADMIN') {
        throw new ForbiddenException('Super admin can only create gym admin accounts');
      }
    } else if (creatorRole === 'GYM_ADMIN') {
      const targetRole = data.role ?? 'MEMBER';
      if (!GYM_ROLES.includes(targetRole)) {
        throw new ForbiddenException('Gym admin can only create member, trainer, or staff accounts');
      }
    }

    const targetRole = data.role ?? (creatorRole === 'SUPER_ADMIN' ? 'GYM_ADMIN' : 'MEMBER');

    // Check for duplicate email or phone before hitting DB constraints
    const [emailExists, phoneExists] = await Promise.all([
      this.prisma.user.findUnique({ where: { email: data.email } }),
      data.phone ? this.prisma.user.findUnique({ where: { phone: data.phone } }) : null,
    ]);
    if (emailExists) throw new ConflictException('Email already registered');
    if (phoneExists) throw new ConflictException('Phone number already registered');

    // GYM_ADMIN always uses their own gymId; SUPER_ADMIN passes gymId in body
    const gymId = creatorRole === 'GYM_ADMIN' ? creatorGymId : (data.gymId ?? null);

    // Enforce SaaS plan limits when a gym admin creates gym-scoped roles
    if (gymId && ['MEMBER', 'TRAINER', 'STAFF'].includes(targetRole)) {
      await this.checkPlanLimits(gymId, targetRole);
    }

    const plainPassword = data.password;
    const hashedPassword = await bcrypt.hash(plainPassword, 12);

    // Wrap User + profile creation in a transaction so nothing is left half-created
    const { user, memberCode } = await this.prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: {
          firstName: data.firstName,
          lastName: data.lastName,
          email: data.email,
          phone: data.phone ?? null,
          password: hashedPassword,
          role: targetRole as any,
          gymId,
          isEmailVerified: true,
          avatar: data.avatar ?? null,
        },
        select: {
          id: true, email: true, firstName: true, lastName: true,
          role: true, gymId: true, isEmailVerified: true, createdAt: true,
        },
      });

      let generatedMemberCode: string | undefined;

      if (gymId) {
        if (targetRole === 'MEMBER') {
          generatedMemberCode = await this.generateMemberCode(gymId);
          const referralCode = this.generateReferralCode();
          let referredById: string | undefined;
          if (data.referralCode) {
            const referrer = await tx.member.findFirst({ where: { referralCode: data.referralCode, gymId } });
            if (referrer) referredById = referrer.id;
          }
          await tx.member.create({ data: { userId: created.id, gymId, memberCode: generatedMemberCode, referralCode, referredById: referredById ?? null } });
        } else if (targetRole === 'TRAINER') {
          await tx.trainer.create({
            data: {
              userId: created.id,
              gymId,
              specializations: data.specializations ?? [],
              certifications: data.certifications ?? [],
              experience: data.experience ? parseInt(data.experience) : 0,
              hourlyRate: data.hourlyRate ? parseFloat(data.hourlyRate) : null,
              bio: data.bio ?? null,
            },
          });
        } else if (targetRole === 'STAFF') {
          await tx.staff.create({
            data: {
              userId: created.id,
              gymId,
              designation: data.designation ?? null,
              department: data.department ?? null,
              salary: data.salary ? parseFloat(data.salary) : null,
            },
          });
        }
      }

      return { user: created, memberCode: generatedMemberCode };
    });

    // Send credentials email with member ID if applicable (fire-and-forget)
    this.emailService.sendAccountCreatedEmail(
      data.email, data.firstName, targetRole, plainPassword, memberCode,
    ).catch(() => {});

    return { ...user, memberCode: memberCode ?? null };
  }

  async findAll(query: any, gymId?: string) {
    const { page = 1, limit = 10, search, role } = query;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (gymId) where.gymId = gymId;
    if (role) where.role = role;
    if (search) {
      where.OR = [
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        skip,
        take: +limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          phone: true,
          role: true,
          avatar: true,
          isActive: true,
          gymId: true,
          lastLoginAt: true,
          createdAt: true,
          member: role === 'MEMBER' ? {
            select: {
              id: true,
              memberCode: true,
              memberSubscriptions: {
                where: { status: 'ACTIVE' },
                take: 1,
                select: {
                  id: true, status: true, startDate: true, endDate: true, amount: true,
                  plan: { select: { name: true, type: true } },
                },
              },
            },
          } : false,
        },
      }),
      this.prisma.user.count({ where }),
    ]);

    const data = users.map((u: any) => {
      const { member, ...rest } = u;
      return {
        ...rest,
        memberCode: member?.memberCode ?? null,
        memberId: member?.id ?? null,
        memberships: member?.memberSubscriptions ?? [],
      };
    });

    return { data, total, page: +page, limit: +limit, totalPages: Math.ceil(total / limit) };
  }

  async findOne(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        phone: true,
        role: true,
        avatar: true,
        dateOfBirth: true,
        gender: true,
        address: true,
        city: true,
        state: true,
        pincode: true,
        country: true,
        emergencyContact: true,
        isActive: true,
        gymId: true,
        lastLoginAt: true,
        createdAt: true,
        gym: { select: { id: true, name: true } },
        trainer: true,
      },
    });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async update(id: string, data: any) {
    await this.findOne(id);
    return this.prisma.user.update({
      where: { id },
      data,
      select: {
        id: true, email: true, firstName: true, lastName: true,
        phone: true, role: true, avatar: true, updatedAt: true,
      },
    });
  }

  async updateOwnProfile(id: string, data: any) {
    // Strip fields a user must never self-assign
    const { role, gymId, isActive, isEmailVerified, password, memberCode, qrCode, ...safeData } = data;
    await this.findOne(id);
    return this.prisma.user.update({
      where: { id },
      data: safeData,
      select: {
        id: true, email: true, firstName: true, lastName: true,
        phone: true, avatar: true, dateOfBirth: true, gender: true,
        address: true, city: true, state: true, pincode: true, country: true, updatedAt: true,
      },
    });
  }

  async deactivate(id: string) {
    await this.findOne(id);
    return this.prisma.user.update({ where: { id }, data: { isActive: false } });
  }

  /** Data-portability export of everything directly owned by the requesting user. */
  async exportOwnData(id: string) {
    const data = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true, email: true, phone: true, firstName: true, lastName: true, role: true,
        avatar: true, dateOfBirth: true, gender: true, address: true, city: true, state: true,
        pincode: true, country: true, timezone: true, emergencyContact: true,
        createdAt: true, updatedAt: true, lastLoginAt: true,
        member: true,
        trainer: true,
        staff: true,
        notifications: true,
        leaveRequests: true,
        attendanceRecords: true,
        supplementOrders: true,
        invoices: true,
      },
    });
    if (!data) throw new NotFoundException('User not found');
    return data;
  }

  async activate(id: string) {
    await this.findOne(id);
    return this.prisma.user.update({ where: { id }, data: { isActive: true } });
  }

  async remove(id: string) {
    const snapshot = await this.findOne(id);
    await this.prisma.$transaction(async (tx) => {
      const trainer = await tx.trainer.findUnique({ where: { userId: id } });
      if (trainer) {
        await tx.trainerAssignment.deleteMany({ where: { trainerId: trainer.id } });
        await tx.workoutPlan.updateMany({ where: { trainerId: trainer.id }, data: { trainerId: null } });
        await tx.dietPlan.updateMany({ where: { trainerId: trainer.id }, data: { trainerId: null } });
      }

      const staff = await tx.staff.findUnique({ where: { userId: id } });

      const memberRecord = await tx.member.findFirst({ where: { userId: id } });
      if (memberRecord) {
        await tx.trainerAssignment.deleteMany({ where: { memberId: memberRecord.id } });
        await tx.workoutAssignment.deleteMany({ where: { memberId: memberRecord.id } });
        await tx.dietAssignment.deleteMany({ where: { memberId: memberRecord.id } });
        await tx.attendance.deleteMany({ where: { memberId: memberRecord.id } });
        await tx.memberSubscription.deleteMany({ where: { memberId: memberRecord.id } });
        await tx.progressLog.deleteMany({ where: { memberId: memberRecord.id } });
        await tx.payment.deleteMany({ where: { memberId: memberRecord.id } });
        await tx.member.delete({ where: { id: memberRecord.id } });
      }

      await tx.notification.deleteMany({ where: { userId: id } });
      await tx.otpCode.deleteMany({ where: { userId: id } });
      await tx.auditLog.deleteMany({ where: { userId: id } });

      if (trainer) await tx.trainer.delete({ where: { id: trainer.id } });
      if (staff) await tx.staff.delete({ where: { id: staff.id } });

      await tx.user.delete({ where: { id } });
    });

    // Logged after the transaction (not inside it) — the deleteMany above wipes audit rows
    // authored by this user (as required for erasure), but this entry records the erasure
    // event itself, so the deletion is traceable even though the actor record is gone.
    await this.auditService.log({
      action: 'USER_ERASED',
      entity: 'User',
      entityId: id,
      gymId: snapshot.gymId ?? undefined,
      oldValues: snapshot,
    });

    return { id };
  }

  private generateReferralCode(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    return Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  }

  private async generateMemberCode(gymId: string): Promise<string> {
    const gym = await this.prisma.gym.findUnique({ where: { id: gymId }, select: { name: true } });
    const prefix = (gym?.name ?? 'MB').slice(0, 2).toUpperCase();
    const count = await this.prisma.member.count({ where: { gymId } });

    // Try sequential codes first; fall back to a random suffix if collision detected
    for (let attempt = 0; attempt < 10; attempt++) {
      const code = `${prefix}${String(count + 1 + attempt).padStart(3, '0')}`;
      const existing = await this.prisma.member.findFirst({ where: { memberCode: code } });
      if (!existing) return code;
    }
    return `${prefix}${uuidv4().replace(/-/g, '').slice(0, 6).toUpperCase()}`;
  }

  async getMemberGrowth(gymId: string) {
    const now = new Date();
    const months = Array.from({ length: 6 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - 5 + i, 1);
      return {
        label: d.toLocaleDateString('en', { month: 'short' }),
        start: new Date(d.getFullYear(), d.getMonth(), 1),
        end: new Date(d.getFullYear(), d.getMonth() + 1, 1),
      };
    });

    return Promise.all(
      months.map(async ({ label, start, end }) => {
        const [newCount, churnedCount] = await Promise.all([
          this.prisma.member.count({ where: { ...(gymId ? { gymId } : {}), createdAt: { gte: start, lt: end } } }),
          this.prisma.memberSubscription.count({
            where: { ...(gymId ? { gymId } : {}), status: { in: ['EXPIRED', 'CANCELLED'] }, updatedAt: { gte: start, lt: end } },
          }),
        ]);
        return { month: label, new: newCount, churned: churnedCount };
      }),
    );
  }

  async getAtRiskMembers(gymId: string, inactiveDays = 14) {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - inactiveDays);

    const activeMembers = await this.prisma.memberSubscription.findMany({
      where: { gymId, status: 'ACTIVE' },
      select: { memberId: true },
      distinct: ['memberId'],
    });

    const activeMemberIds = activeMembers.map((m) => m.memberId);
    if (activeMemberIds.length === 0) return [];

    const recentAttendance = await this.prisma.attendance.findMany({
      where: { memberId: { in: activeMemberIds }, checkInTime: { gte: cutoff } },
      select: { memberId: true },
      distinct: ['memberId'],
    });

    const recentSet = new Set(recentAttendance.map((a) => a.memberId));
    const atRiskIds = activeMemberIds.filter((id) => !recentSet.has(id));

    if (atRiskIds.length === 0) return [];

    const members = await this.prisma.member.findMany({
      where: { id: { in: atRiskIds }, gymId },
      include: {
        user: { select: { firstName: true, lastName: true, avatar: true } },
        attendance: { orderBy: { checkInTime: 'desc' }, take: 1, select: { checkInTime: true } },
        memberSubscriptions: { where: { status: 'ACTIVE' }, select: { endDate: true }, take: 1 },
      },
    });

    const now = new Date();
    return members.map((m) => {
      const lastCheckIn = m.attendance[0]?.checkInTime ?? null;
      const daysSince = lastCheckIn ? Math.floor((now.getTime() - lastCheckIn.getTime()) / 86400000) : null;
      return {
        memberId: m.id,
        userId: m.userId,
        memberCode: m.memberCode,
        firstName: m.user.firstName,
        lastName: m.user.lastName,
        avatar: m.user.avatar,
        lastCheckIn,
        daysSinceLastVisit: daysSince,
        membershipEndDate: m.memberSubscriptions[0]?.endDate ?? null,
      };
    }).sort((a, b) => (b.daysSinceLastVisit ?? 999) - (a.daysSinceLastVisit ?? 999));
  }

  async sendWinbackMessage(memberId: string, gymId: string) {
    const member = await this.prisma.member.findFirst({
      where: { id: memberId, gymId },
      include: { user: true, gym: { select: { name: true } } },
    });
    if (!member) throw new Error('Member not found');

    await Promise.all([
      this.emailService.sendWinbackEmail(member.user.email, member.user.firstName, member.gym.name),
      this.prisma.notification.create({
        data: {
          userId: member.userId,
          gymId,
          type: 'WINBACK' as any,
          title: `${member.gym.name} misses you! 💪`,
          message: `It's been a while! Come back and keep up with your fitness goals. We're here to support you.`,
        },
      }),
    ]);

    return { sent: true };
  }

  async getMemberStats(gymId?: string) {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const whereGym = gymId ? { gymId } : {};

    const [total, active, newThisMonth, expiringSoon] = await Promise.all([
      this.prisma.member.count({ where: whereGym }),
      this.prisma.memberSubscription.count({ where: { ...whereGym, status: 'ACTIVE' } }),
      this.prisma.member.count({ where: { ...whereGym, createdAt: { gte: startOfMonth } } }),
      this.prisma.memberSubscription.count({
        where: {
          ...whereGym,
          status: 'ACTIVE',
          endDate: { lte: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) },
        },
      }),
    ]);

    return { total, active, newThisMonth, expiringSoon };
  }
}
