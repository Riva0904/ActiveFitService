import {
  Injectable, UnauthorizedException, ConflictException,
  BadRequestException, NotFoundException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { randomBytes } from 'crypto';
import { v4 as uuidv4 } from 'uuid';

import { PrismaService } from '../prisma/prisma.service';
import { OtpService } from '../otp/otp.service';
import { EmailService } from '../email/email.service';
import { TokenBlacklistService } from './token-blacklist.service';
import { AuditService } from '../common/services/audit.service';
import {
  RegisterDto, RegisterGymDto, LoginDto, ChangePasswordDto,
  ForgotPasswordDto, ResetPasswordDto, VerifyEmailDto, Verify2FaDto,
} from './dto/auth.dto';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private configService: ConfigService,
    private otpService: OtpService,
    private emailService: EmailService,
    private tokenBlacklist: TokenBlacklistService,
    private auditService: AuditService,
  ) {}

  // ─── Register ─────────────────────────────────────────────────────────────

  async register(dto: RegisterDto) {
    const existing = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (existing) throw new ConflictException('Email already registered');

    if (dto.phone) {
      const phoneExists = await this.prisma.user.findUnique({ where: { phone: dto.phone } });
      if (phoneExists) throw new ConflictException('Phone number already registered');
    }

    const hashedPassword = await bcrypt.hash(dto.password, 12);

    const user = await this.prisma.user.create({
      data: {
        firstName: dto.firstName,
        lastName: dto.lastName,
        email: dto.email,
        phone: dto.phone,
        password: hashedPassword,
        role: (dto.role as any) ?? 'MEMBER',
        gymId: dto.gymId,
        isEmailVerified: false,
      },
      select: {
        id: true, email: true, firstName: true, lastName: true,
        role: true, gymId: true, isEmailVerified: true, createdAt: true,
      },
    });

    // Send email verification OTP
    await this.otpService.sendOtp(dto.email, 'EMAIL_VERIFICATION', dto.firstName);

    return {
      user,
      message: `Account created! Please verify your email. OTP sent to ${dto.email}`,
      requiresEmailVerification: true,
    };
  }

  // ─── Register Gym (self-service) ──────────────────────────────────────────

  async registerGym(dto: RegisterGymDto) {
    const existing = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (existing) throw new ConflictException('Email already registered');

    const slug = dto.gymName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') + '-' + uuidv4().slice(0, 6);
    const gym = await this.prisma.gym.create({
      data: {
        name: dto.gymName,
        slug,
        email: dto.gymEmail || dto.email,
        phone: dto.gymPhone || dto.phone,
        address: dto.gymAddress,
        city: dto.gymCity,
        state: dto.gymState,
        pincode: dto.gymPincode,
        description: dto.gymDescription,
        status: 'PENDING',
        saasPlan: 'STARTER',
      },
    });

    const hashedPassword = await bcrypt.hash(dto.password, 12);

    const user = await this.prisma.user.create({
      data: {
        firstName: dto.firstName,
        lastName: dto.lastName,
        email: dto.email,
        phone: dto.phone,
        password: hashedPassword,
        role: 'GYM_ADMIN',
        gymId: gym.id,
        isEmailVerified: false,
      },
      select: { id: true, email: true, firstName: true, lastName: true, role: true, gymId: true },
    });
    await this.otpService.sendOtp(dto.email, 'EMAIL_VERIFICATION', dto.firstName);

    return {
      user,
      gym: { id: gym.id, name: gym.name },
      message: `Gym registered! Please verify your email. OTP sent to ${dto.email}`,
      requiresEmailVerification: true,
    };
  }

  // ─── Verify Email ──────────────────────────────────────────────────────────

  async verifyEmail(dto: VerifyEmailDto) {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (!user) throw new NotFoundException('User not found');
    if (user.isEmailVerified) throw new BadRequestException('Email already verified');

    await this.otpService.verifyOtp(dto.email, dto.otp, 'EMAIL_VERIFICATION');

    await this.prisma.user.update({
      where: { email: dto.email },
      data: { isEmailVerified: true },
    });

    // Send welcome email
    await this.emailService.sendWelcomeEmail(dto.email, user.firstName, user.role);

    const tokens = await this.generateTokens(user.id, user.email, user.role);
    return { message: 'Email verified successfully!', ...tokens, user: { ...user, isEmailVerified: true } };
  }

  // ─── Login ─────────────────────────────────────────────────────────────────

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
      include: { member: { select: { id: true, memberCode: true, qrToken: true } } },
    });
    if (!user) throw new UnauthorizedException('Invalid email or password');
    if (!user.isActive) throw new UnauthorizedException('Your account has been deactivated. Contact support.');

    const isMatch = await bcrypt.compare(dto.password, user.password);
    if (!isMatch) throw new UnauthorizedException('Invalid email or password');

    if (!user.isEmailVerified) {
      await this.otpService.sendOtp(dto.email, 'EMAIL_VERIFICATION', user.firstName);
      throw new UnauthorizedException({
        message: 'Please verify your email first. A new OTP has been sent.',
        code: 'EMAIL_NOT_VERIFIED',
        email: dto.email,
      });
    }

    await this.prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
    await this.auditService.log({ userId: user.id, gymId: user.gymId ?? undefined, action: 'USER_LOGIN', entity: 'User', entityId: user.id });

    const tokens = await this.generateTokens(user.id, user.email, user.role);
    const { password: _, member, ...userData } = user as any;
    return {
      user: {
        ...userData,
        qrCode: member?.qrToken ?? null,
        memberCode: member?.memberCode ?? null,
      },
      ...tokens,
    };
  }

  // ─── Forgot Password ───────────────────────────────────────────────────────

  async forgotPassword(dto: ForgotPasswordDto) {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email } });
    // Don't reveal if user exists or not (security)
    if (!user) {
      return { message: 'If an account exists with this email, a password reset OTP has been sent.' };
    }

    await this.otpService.sendOtp(dto.email, 'PASSWORD_RESET', user.firstName);
    return { message: `Password reset OTP sent to ${dto.email}`, expiresIn: 600 };
  }

  // ─── Reset Password ────────────────────────────────────────────────────────

  async resetPassword(dto: ResetPasswordDto) {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (!user) throw new NotFoundException('User not found');

    await this.otpService.verifyOtp(dto.email, dto.otp, 'PASSWORD_RESET');

    const hashed = await bcrypt.hash(dto.newPassword, 12);
    await this.prisma.user.update({ where: { email: dto.email }, data: { password: hashed } });
    await this.emailService.sendPasswordChangedAlert(dto.email, user.firstName);

    return { message: 'Password reset successfully. You can now log in with your new password.' };
  }

  // ─── Change Password (authenticated) ──────────────────────────────────────

  async changePassword(userId: string, dto: ChangePasswordDto, currentJti?: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');
    const isMatch = await bcrypt.compare(dto.currentPassword, user.password);
    if (!isMatch) throw new BadRequestException('Current password is incorrect');

    const hashed = await bcrypt.hash(dto.newPassword, 12);
    await this.prisma.user.update({ where: { id: userId }, data: { password: hashed, refreshToken: null } });
    await this.emailService.sendPasswordChangedAlert(user.email, user.firstName);
    await this.auditService.log({ userId, action: 'PASSWORD_CHANGED', entity: 'User', entityId: userId });

    // Invalidate the current session token
    if (currentJti) await this.tokenBlacklist.add(currentJti);

    return { message: 'Password changed successfully. Please log in again.' };
  }

  async logout(jti: string, userId?: string) {
    if (jti) await this.tokenBlacklist.add(jti);
    if (userId) {
      await this.prisma.user.update({ where: { id: userId }, data: { refreshToken: null } });
    }
    return { message: 'Logged out successfully' };
  }

  async refreshTokens(refreshTokenValue: string) {
    let payload: any;
    try {
      payload = this.jwtService.verify(refreshTokenValue, {
        secret: this.configService.get('JWT_REFRESH_SECRET', this.configService.get('JWT_SECRET')),
      });
    } catch {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    const user = await this.prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user || !user.refreshToken || !user.isActive) {
      throw new UnauthorizedException('Session expired — please log in again');
    }

    const isMatch = await bcrypt.compare(refreshTokenValue, user.refreshToken);
    if (!isMatch) throw new UnauthorizedException('Refresh token reuse detected — please log in again');

    return await this.generateTokens(user.id, user.email, user.role);
  }

  // ─── Admin: Send/Check email OTP (no user-existence check) ───────────────

  async sendEmailOtp(email: string, name?: string) {
    return this.otpService.sendOtp(email, 'EMAIL_VERIFICATION', name ?? email.split('@')[0]);
  }

  async checkEmailOtp(email: string, otp: string) {
    await this.otpService.verifyOtp(email, otp, 'EMAIL_VERIFICATION');
    return { verified: true, message: 'Email verified successfully' };
  }

  // ─── Resend OTP ────────────────────────────────────────────────────────────

  async resendOtp(email: string, purpose: string) {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) throw new NotFoundException('User not found');

    const otpPurpose = purpose as any;
    return this.otpService.sendOtp(email, otpPurpose, user.firstName);
  }

  // ─── Get Profile ───────────────────────────────────────────────────────────

  async getProfile(userId: string) {
    return this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true, email: true, firstName: true, lastName: true, phone: true,
        role: true, avatar: true, dateOfBirth: true, gender: true, address: true,
        city: true, state: true, pincode: true, gymId: true,
        isActive: true, isEmailVerified: true, lastLoginAt: true, createdAt: true,
        gym: { select: { id: true, name: true, logo: true, address: true } },
      },
    });
  }

  // ─── Helpers ───────────────────────────────────────────────────────────────

  async generateTokens(userId: string, email: string, role: string) {
    const jti = uuidv4();
    const payload = { sub: userId, email, role, jti };

    const accessToken = this.jwtService.sign(payload, {
      expiresIn: this.configService.get('JWT_EXPIRES_IN', '15m'),
    });

    const rawRefresh = randomBytes(40).toString('hex');
    // Hash is awaited before returning — prevents race conditions where the token
    // is used before the hash is persisted to the database.
    const hashed = await bcrypt.hash(rawRefresh, 10);
    await this.prisma.user.update({ where: { id: userId }, data: { refreshToken: hashed } });

    return { accessToken, refreshToken: rawRefresh, tokenType: 'Bearer', expiresIn: '15m' };
  }
}
