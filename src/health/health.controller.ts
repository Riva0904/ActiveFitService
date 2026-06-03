import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from '../email/email.service';

@ApiTags('Health')
@Controller('health')
export class HealthController {
  constructor(
    private prisma: PrismaService,
    private emailService: EmailService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Health check — returns system status' })
  async check() {
    const [dbOk, smtpOk] = await Promise.all([
      this.prisma.$queryRaw`SELECT 1`.then(() => true).catch(() => false),
      this.emailService.verifyConnection(),
    ]);

    const status = dbOk && smtpOk ? 'ok' : 'degraded';

    return {
      status,
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version ?? '1.0.0',
      uptime: process.uptime(),
      services: {
        database: dbOk ? 'up' : 'down',
        smtp: smtpOk ? 'up' : 'down',
      },
      environment: process.env.NODE_ENV ?? 'development',
    };
  }

  @Get('ping')
  @ApiOperation({ summary: 'Simple ping endpoint' })
  ping() {
    return { message: 'pong', timestamp: new Date().toISOString() };
  }
}
