import {
  Injectable, BadRequestException, NotFoundException, HttpException, HttpStatus,
} from '@nestjs/common';
import { randomBytes } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from '../email/email.service';
import { OtpPurpose } from '@prisma/client';

const OTP_TTL_MINUTES = 10;
const MAX_ATTEMPTS = 5;
const RESEND_COOLDOWN_SECONDS = 60;

@Injectable()
export class OtpService {
  constructor(
    private prisma: PrismaService,
    private emailService: EmailService,
  ) {}

  private generateCode(): string {
    const n = randomBytes(4).readUInt32BE(0);
    return String(100000 + (n % 900000));
  }

  async sendOtp(email: string, purpose: OtpPurpose, name?: string): Promise<{ message: string; expiresIn: number }> {
    // Rate-limit: check if a recent OTP exists (within cooldown period)
    const recent = await this.prisma.otpCode.findFirst({
      where: {
        email,
        purpose,
        isUsed: false,
        createdAt: { gte: new Date(Date.now() - RESEND_COOLDOWN_SECONDS * 1000) },
      },
    });

    if (recent) {
      const waitSeconds = Math.ceil(
        (recent.createdAt.getTime() + RESEND_COOLDOWN_SECONDS * 1000 - Date.now()) / 1000,
      );
      throw new HttpException(
        `Please wait ${waitSeconds} second${waitSeconds > 1 ? 's' : ''} before requesting another OTP`,
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    // Invalidate all previous OTPs for this email + purpose
    await this.prisma.otpCode.updateMany({
      where: { email, purpose, isUsed: false },
      data: { isUsed: true },
    });

    const code = this.generateCode();
    const expiresAt = new Date(Date.now() + OTP_TTL_MINUTES * 60 * 1000);

    await this.prisma.otpCode.create({ data: { email, purpose, code, expiresAt } });

    const userName = name ?? email.split('@')[0];
    await this.emailService.sendOtpEmail(email, code, purpose, userName);

    return { message: `OTP sent to ${email}`, expiresIn: OTP_TTL_MINUTES * 60 };
  }

  async verifyOtp(email: string, code: string, purpose: OtpPurpose): Promise<void> {
    const otp = await this.prisma.otpCode.findFirst({
      where: { email, purpose, isUsed: false },
      orderBy: { createdAt: 'desc' },
    });

    if (!otp) {
      throw new NotFoundException('No active OTP found. Please request a new one.');
    }

    // Check expiry
    if (otp.expiresAt < new Date()) {
      await this.prisma.otpCode.update({ where: { id: otp.id }, data: { isUsed: true } });
      throw new BadRequestException('OTP has expired. Please request a new one.');
    }

    // Check max attempts
    if (otp.attempts >= MAX_ATTEMPTS) {
      await this.prisma.otpCode.update({ where: { id: otp.id }, data: { isUsed: true } });
      throw new BadRequestException('Too many failed attempts. Please request a new OTP.');
    }

    // Validate code
    if (otp.code !== code.trim()) {
      await this.prisma.otpCode.update({ where: { id: otp.id }, data: { attempts: { increment: 1 } } });
      const remaining = MAX_ATTEMPTS - otp.attempts - 1;
      throw new BadRequestException(`Invalid OTP. ${remaining} attempt${remaining !== 1 ? 's' : ''} remaining.`);
    }

    // Mark as used
    await this.prisma.otpCode.update({ where: { id: otp.id }, data: { isUsed: true } });
  }

  async cleanupExpired(): Promise<number> {
    const result = await this.prisma.otpCode.deleteMany({
      where: { expiresAt: { lt: new Date() } },
    });
    return result.count;
  }
}
