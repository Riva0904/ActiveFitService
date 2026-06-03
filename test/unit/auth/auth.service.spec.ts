import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import {
  ConflictException, UnauthorizedException,
  BadRequestException, NotFoundException,
} from '@nestjs/common';
import { AuthService } from '../../../src/auth/auth.service';
import { PrismaService } from '../../../src/prisma/prisma.service';
import { OtpService } from '../../../src/otp/otp.service';
import { EmailService } from '../../../src/email/email.service';

// Mock bcrypt at module level so compare/hash are configurable
jest.mock('bcrypt', () => ({
  hash: jest.fn().mockResolvedValue('$2b$12$hashedpassword'),
  compare: jest.fn().mockResolvedValue(true),
}));
// eslint-disable-next-line @typescript-eslint/no-require-imports
const bcryptMock = require('bcrypt') as { compare: jest.Mock; hash: jest.Mock };

// Mock qrcode
jest.mock('qrcode', () => ({ toDataURL: jest.fn().mockResolvedValue('data:image/png;base64,xxx') }));

// ─── Mock Factories ──────────────────────────────────────────────────────────

const mockUser = {
  id: 'user-uuid-001',
  email: 'test@example.com',
  firstName: 'Test',
  lastName: 'User',
  password: '$2b$12$hashedpassword',
  role: 'USER',
  gymId: 'gym-001',
  isActive: true,
  isEmailVerified: true,
  lastLogin: null,
  qrCode: 'data:image/png;base64,xxx',
  phone: null,
  avatar: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const mockPrismaService = {
  user: {
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    findFirst: jest.fn(),
  },
};

const mockJwtService = {
  sign: jest.fn().mockReturnValue('mock.jwt.token'),
};

const mockConfigService = {
  get: jest.fn((key: string, fallback?: any) => {
    const config: Record<string, any> = {
      JWT_SECRET: 'test-secret',
      JWT_EXPIRES_IN: '7d',
      FRONTEND_URL: 'http://localhost:3000',
    };
    return config[key] ?? fallback;
  }),
};

const mockOtpService = {
  sendOtp: jest.fn().mockResolvedValue({ message: 'OTP sent', expiresIn: 600 }),
  verifyOtp: jest.fn().mockResolvedValue(undefined),
};

const mockEmailService = {
  sendWelcomeEmail: jest.fn().mockResolvedValue(true),
  sendPasswordChangedAlert: jest.fn().mockResolvedValue(true),
  sendOtpEmail: jest.fn().mockResolvedValue(true),
};

// ─── Test Suite ──────────────────────────────────────────────────────────────

describe('AuthService', () => {
  let service: AuthService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: JwtService, useValue: mockJwtService },
        { provide: ConfigService, useValue: mockConfigService },
        { provide: OtpService, useValue: mockOtpService },
        { provide: EmailService, useValue: mockEmailService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    jest.clearAllMocks();
  });

  // ─── register ───────────────────────────────────────────────────────────────

  describe('register', () => {
    const registerDto = {
      firstName: 'John',
      lastName: 'Doe',
      email: 'john@example.com',
      password: 'Password@123',
    };

    it('should register user and send verification OTP', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);
      mockPrismaService.user.create.mockResolvedValue({
        id: 'new-user-id',
        email: registerDto.email,
        firstName: registerDto.firstName,
        lastName: registerDto.lastName,
        role: 'USER',
        gymId: null,
        isEmailVerified: false,
        createdAt: new Date(),
      });

      const result = await service.register(registerDto);

      expect(result.requiresEmailVerification).toBe(true);
      expect(result.message).toContain('verify your email');
      expect(mockOtpService.sendOtp).toHaveBeenCalledWith(
        registerDto.email, 'EMAIL_VERIFICATION', registerDto.firstName,
      );
    });

    it('should throw ConflictException if email already registered', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);

      await expect(service.register(registerDto))
        .rejects.toThrow(ConflictException);
      expect(mockOtpService.sendOtp).not.toHaveBeenCalled();
    });

    it('should hash password before storing', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);
      mockPrismaService.user.create.mockImplementation(({ data }) => {
        // bcrypt.hash is mocked; password should not equal raw input
        expect(data.password).not.toBe(registerDto.password);
        return Promise.resolve({ id: 'uid', email: data.email, firstName: 'John', lastName: 'Doe', role: 'USER', gymId: null, isEmailVerified: false, createdAt: new Date() });
      });

      await service.register(registerDto);
      expect(bcryptMock.hash).toHaveBeenCalledWith(registerDto.password, 12);
      expect(mockPrismaService.user.create).toHaveBeenCalled();
    });

    it('should reject duplicate phone number', async () => {
      mockPrismaService.user.findUnique
        .mockResolvedValueOnce(null)           // email check passes
        .mockResolvedValueOnce({ id: 'x' });  // phone check fails

      await expect(service.register({ ...registerDto, phone: '+91 9876543210' }))
        .rejects.toThrow(ConflictException);
    });
  });

  // ─── verifyEmail ────────────────────────────────────────────────────────────

  describe('verifyEmail', () => {
    const dto = { email: 'john@example.com', otp: '123456' };

    it('should verify email, update user and return tokens', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({ ...mockUser, isEmailVerified: false });
      mockPrismaService.user.update.mockResolvedValue({ ...mockUser, isEmailVerified: true });
      mockOtpService.verifyOtp.mockResolvedValue(undefined);

      const result: any = await service.verifyEmail(dto);

      expect(mockPrismaService.user.update).toHaveBeenCalledWith({
        where: { email: dto.email },
        data: { isEmailVerified: true },
      });
      expect(mockEmailService.sendWelcomeEmail).toHaveBeenCalled();
      expect(result.accessToken).toBeDefined();
    });

    it('should throw if user not found', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);
      await expect(service.verifyEmail(dto)).rejects.toThrow(NotFoundException);
    });

    it('should throw if email already verified', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({ ...mockUser, isEmailVerified: true });
      await expect(service.verifyEmail(dto)).rejects.toThrow(BadRequestException);
    });

    it('should propagate OTP service errors', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({ ...mockUser, isEmailVerified: false });
      mockOtpService.verifyOtp.mockRejectedValue(new BadRequestException('Invalid OTP'));
      await expect(service.verifyEmail(dto)).rejects.toThrow(BadRequestException);
    });
  });

  // ─── login ──────────────────────────────────────────────────────────────────

  describe('login', () => {
    const loginDto = { email: 'test@example.com', password: 'Password@123' };

    beforeEach(() => {
      bcryptMock.compare.mockResolvedValue(true);
    });

    it('should return tokens on successful login', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);
      mockPrismaService.user.update.mockResolvedValue(mockUser);

      const result: any = await service.login(loginDto);

      expect(result.accessToken).toBe('mock.jwt.token');
      expect(result.user.password).toBeUndefined();
      expect(mockPrismaService.user.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { lastLogin: expect.any(Date) } }),
      );
    });

    it('should throw UnauthorizedException for unknown email', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);
      await expect(service.login(loginDto)).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException for wrong password', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);
      bcryptMock.compare.mockResolvedValue(false);
      await expect(service.login(loginDto)).rejects.toThrow(UnauthorizedException);
    });

    it('should throw if account is deactivated', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({ ...mockUser, isActive: false });
      await expect(service.login(loginDto)).rejects.toThrow(UnauthorizedException);
    });

    it('should throw and resend OTP if email not verified', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({ ...mockUser, isEmailVerified: false });
      await expect(service.login(loginDto)).rejects.toThrow(UnauthorizedException);
      expect(mockOtpService.sendOtp).toHaveBeenCalledWith(
        loginDto.email, 'EMAIL_VERIFICATION', mockUser.firstName,
      );
    });

    it('should not expose password in response', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);
      mockPrismaService.user.update.mockResolvedValue(mockUser);

      const result: any = await service.login(loginDto);
      expect(result.user).not.toHaveProperty('password');
    });
  });

  // ─── forgotPassword ──────────────────────────────────────────────────────────

  describe('forgotPassword', () => {
    it('should send reset OTP if user exists', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);

      const result = await service.forgotPassword({ email: mockUser.email });

      expect(mockOtpService.sendOtp).toHaveBeenCalledWith(
        mockUser.email, 'PASSWORD_RESET', mockUser.firstName,
      );
      expect(result.expiresIn).toBe(600);
    });

    it('should return same message even if user does not exist (security)', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);

      const result = await service.forgotPassword({ email: 'unknown@x.com' });

      expect(result.message).toContain('If an account exists');
      expect(mockOtpService.sendOtp).not.toHaveBeenCalled();
    });
  });

  // ─── resetPassword ───────────────────────────────────────────────────────────

  describe('resetPassword', () => {
    const dto = { email: 'test@example.com', otp: '123456', newPassword: 'NewPass@123' };

    it('should reset password and send alert email', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);
      mockOtpService.verifyOtp.mockResolvedValue(undefined);
      mockPrismaService.user.update.mockResolvedValue(mockUser);

      const result = await service.resetPassword(dto);

      expect(bcryptMock.hash).toHaveBeenCalledWith(dto.newPassword, 12);
      expect(mockPrismaService.user.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { password: expect.any(String) } }),
      );
      expect(mockEmailService.sendPasswordChangedAlert).toHaveBeenCalled();
      expect(result.message).toContain('successfully');
    });

    it('should throw NotFoundException if user not found', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);
      await expect(service.resetPassword(dto)).rejects.toThrow(NotFoundException);
    });

    it('should propagate OTP errors (invalid/expired)', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);
      mockOtpService.verifyOtp.mockRejectedValue(new BadRequestException('OTP expired'));
      await expect(service.resetPassword(dto)).rejects.toThrow(BadRequestException);
    });
  });

  // ─── changePassword ──────────────────────────────────────────────────────────

  describe('changePassword', () => {
    it('should change password when current password is correct', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);
      bcryptMock.compare.mockResolvedValue(true);
      mockPrismaService.user.update.mockResolvedValue(mockUser);

      const result = await service.changePassword(mockUser.id, {
        currentPassword: 'OldPass@123',
        newPassword: 'NewPass@123',
      });

      expect(result.message).toContain('successfully');
      expect(mockEmailService.sendPasswordChangedAlert).toHaveBeenCalled();
    });

    it('should throw BadRequestException if current password is wrong', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);
      bcryptMock.compare.mockResolvedValue(false);

      await expect(service.changePassword(mockUser.id, {
        currentPassword: 'WrongPass',
        newPassword: 'NewPass@123',
      })).rejects.toThrow(BadRequestException);
    });
  });

  // ─── generateTokens ──────────────────────────────────────────────────────────

  describe('generateTokens', () => {
    it('should return access token and metadata', () => {
      const result = service.generateTokens('user-id', 'test@x.com', 'USER');

      expect(result.accessToken).toBeDefined();
      expect(result.tokenType).toBe('Bearer');
      expect(result.expiresIn).toBeDefined();
      expect(mockJwtService.sign).toHaveBeenCalledWith(
        { sub: 'user-id', email: 'test@x.com', role: 'USER' },
        expect.any(Object),
      );
    });
  });
});
