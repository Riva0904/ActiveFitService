import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { BaseRepository } from './base.repository';

@Injectable()
export class MemberRepository extends BaseRepository<any> {
  constructor(prisma: PrismaService, gymId: string) {
    super(prisma, 'member', gymId);
  }

  async findByUserId(userId: string) {
    return this.prisma.member.findFirst({ where: this.scope({ userId }) as any });
  }

  async findByCode(code: string) {
    return this.prisma.member.findFirst({
      where: this.scope({ OR: [{ memberCode: code }, { qrToken: code }] }) as any,
      include: { user: true },
    });
  }

  async findManyPaginated(opts: {
    skip?: number;
    take?: number;
    search?: string;
    status?: string;
  }) {
    const where: any = this.scope();
    if (opts.search) {
      where.user = {
        OR: [
          { firstName: { contains: opts.search, mode: 'insensitive' } },
          { lastName: { contains: opts.search, mode: 'insensitive' } },
          { email: { contains: opts.search, mode: 'insensitive' } },
        ],
      };
    }

    const [data, total] = await Promise.all([
      this.prisma.member.findMany({
        where,
        skip: opts.skip ?? 0,
        take: opts.take ?? 10,
        orderBy: { createdAt: 'desc' },
        include: {
          user: { select: { id: true, firstName: true, lastName: true, email: true, phone: true, avatar: true, isActive: true, role: true } },
          memberSubscriptions: { where: { status: 'ACTIVE' }, take: 1 },
        },
      }),
      this.prisma.member.count({ where }),
    ]);
    return { data, total };
  }
}
