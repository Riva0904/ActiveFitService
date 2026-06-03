import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ProgressLogsService {
  constructor(private prisma: PrismaService) {}

  async findByUser(userId: string, gymId: string) {
    const member = await this.prisma.member.findFirst({ where: { userId, gymId } });
    if (!member) return [];

    return this.prisma.progressLog.findMany({
      where: { memberId: member.id },
      orderBy: { logDate: 'desc' },
    });
  }

  async create(userId: string, gymId: string, data: any) {
    const member = await this.prisma.member.findFirst({ where: { userId, gymId } });
    if (!member) return null;

    const { weight, height } = data;
    let bmi: number | undefined;
    if (weight && height) {
      const heightM = height / 100;
      bmi = parseFloat((weight / (heightM * heightM)).toFixed(1));
    }

    return this.prisma.progressLog.create({
      data: { ...data, bmi: bmi ?? data.bmi, memberId: member.id, gymId },
    });
  }
}
