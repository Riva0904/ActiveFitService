import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class StaffsService {
  constructor(private prisma: PrismaService) {}

  async findAll(query: any, gymId?: string) {
    const { page = 1, limit = 10, search } = query;
    const skip = (page - 1) * +limit;
    const where: any = {};
    if (gymId) where.gymId = gymId;
    if (search) {
      where.user = {
        OR: [
          { firstName: { contains: search, mode: 'insensitive' } },
          { lastName: { contains: search, mode: 'insensitive' } },
          { email: { contains: search, mode: 'insensitive' } },
        ],
      };
    }

    const [staffs, total] = await Promise.all([
      this.prisma.staff.findMany({
        where,
        skip,
        take: +limit,
        orderBy: { createdAt: 'desc' },
        include: {
          user: { select: { id: true, firstName: true, lastName: true, email: true, phone: true, avatar: true, isActive: true, payoutUpiVpa: true } },
        },
      }),
      this.prisma.staff.count({ where }),
    ]);

    return { data: staffs, total, page: +page, limit: +limit, totalPages: Math.ceil(total / +limit) };
  }

  async findOne(id: string) {
    const staff = await this.prisma.staff.findUnique({
      where: { id },
      include: {
        user: { select: { id: true, firstName: true, lastName: true, email: true, phone: true, avatar: true, isActive: true, payoutUpiVpa: true } },
        gym: { select: { id: true, name: true, logo: true } },
      },
    });
    if (!staff) throw new NotFoundException('Staff not found');
    return staff;
  }

  async update(id: string, data: any) {
    await this.findOne(id);
    return this.prisma.staff.update({ where: { id }, data });
  }

  async remove(id: string) {
    const staff = await this.prisma.staff.findUnique({
      where: { id },
      select: { userId: true },
    });
    if (!staff) throw new NotFoundException('Staff not found');
    await this.prisma.staff.delete({ where: { id } });
    await this.prisma.user.delete({ where: { id: staff.userId } }).catch(() => {});
    return { message: 'Staff removed successfully' };
  }

  async getMyProfile(userId: string) {
    const staff = await this.prisma.staff.findFirst({
      where: { userId },
      include: {
        user: { select: { id: true, firstName: true, lastName: true, email: true, phone: true, avatar: true } },
        gym: { select: { id: true, name: true, logo: true, address: true } },
      },
    });
    if (!staff) throw new NotFoundException('Staff profile not found');
    return staff;
  }
}
