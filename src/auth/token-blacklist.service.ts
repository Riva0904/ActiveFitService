import { Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class TokenBlacklistService {
  constructor(private readonly prisma: PrismaService) {}

  async add(jti: string, expiresAt?: Date): Promise<void> {
    const ttl = expiresAt ?? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    await this.prisma.revokedToken.upsert({
      where: { jti },
      create: { jti, expiresAt: ttl },
      update: {},
    });
  }

  async has(jti: string): Promise<boolean> {
    const record = await this.prisma.revokedToken.findUnique({ where: { jti } });
    return !!record;
  }

  @Cron(CronExpression.EVERY_DAY_AT_2AM)
  async cleanupExpired(): Promise<void> {
    await this.prisma.revokedToken.deleteMany({ where: { expiresAt: { lt: new Date() } } });
  }
}
