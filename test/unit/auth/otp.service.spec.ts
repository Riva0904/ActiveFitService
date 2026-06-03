import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException, HttpException } from '@nestjs/common';
import { OtpService } from '../../../src/otp/otp.service';
import { PrismaService } from '../../../src/prisma/prisma.service';
import { EmailService } from '../../../src/email/email.service';

const makeOtp = (overrides: any = {}) => ({
  id: 'otp-id-001',
  code: '123456',
  purpose: 'EMAIL_VERIFICATION' as const,
  email: 'test@example.com',
  expiresAt: new Date(Date.now() + 10 * 60 * 1000), // 10 min future
  isUsed: false,
  attempts: 0,
  createdAt: new Date(Date.now() - 30 * 1000), // 30s ago
  ...overrides,
});

const mockPrisma = {
  otpCode: {
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn().mockResolvedValue({ count: 0 }),
    deleteMany: jest.fn().mockResolvedValue({ count: 5 }),
  },
};

const mockEmail = {
  sendOtpEmail: jest.fn().mockResolvedValue(true),
};

describe('OtpService', () => {
  let service: OtpService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OtpService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: EmailService, useValue: mockEmail },
      ],
    }).compile();

    service = module.get<OtpService>(OtpService);
    jest.clearAllMocks();
  });

  // ─── sendOtp ────────────────────────────────────────────────────────────────

  describe('sendOtp', () => {
    it('should create OTP and send email on first request', async () => {
      mockPrisma.otpCode.findFirst.mockResolvedValue(null); // no rate-limit hit
      mockPrisma.otpCode.create.mockResolvedValue(makeOtp());

      const result = await service.sendOtp('test@example.com', 'EMAIL_VERIFICATION', 'John');

      expect(mockPrisma.otpCode.create).toHaveBeenCalled();
      expect(mockEmail.sendOtpEmail).toHaveBeenCalledWith(
        'test@example.com', expect.any(String), 'EMAIL_VERIFICATION', 'John',
      );
      expect(result.message).toContain('OTP sent');
      expect(result.expiresIn).toBe(600);
    });

    it('should throw TooManyRequestsException within cooldown period', async () => {
      mockPrisma.otpCode.findFirst.mockResolvedValue(makeOtp()); // recent OTP found

      await expect(service.sendOtp('test@example.com', 'EMAIL_VERIFICATION'))
        .rejects.toThrow(HttpException);
      expect(mockPrisma.otpCode.create).not.toHaveBeenCalled();
    });

    it('should invalidate previous OTPs before creating new one', async () => {
      mockPrisma.otpCode.findFirst.mockResolvedValue(null);
      mockPrisma.otpCode.create.mockResolvedValue(makeOtp());

      await service.sendOtp('test@example.com', 'EMAIL_VERIFICATION');

      expect(mockPrisma.otpCode.updateMany).toHaveBeenCalledWith({
        where: { email: 'test@example.com', purpose: 'EMAIL_VERIFICATION', isUsed: false },
        data: { isUsed: true },
      });
    });

    it('should generate a 6-digit numeric code', async () => {
      let createdCode: string;
      mockPrisma.otpCode.findFirst.mockResolvedValue(null);
      mockPrisma.otpCode.create.mockImplementation(({ data }) => {
        createdCode = data.code;
        return Promise.resolve(makeOtp({ code: data.code }));
      });

      await service.sendOtp('test@example.com', 'EMAIL_VERIFICATION');

      expect(createdCode!).toMatch(/^\d{6}$/);
    });

    it('should use email prefix as name when name not provided', async () => {
      mockPrisma.otpCode.findFirst.mockResolvedValue(null);
      mockPrisma.otpCode.create.mockResolvedValue(makeOtp());

      await service.sendOtp('testuser@example.com', 'EMAIL_VERIFICATION');

      expect(mockEmail.sendOtpEmail).toHaveBeenCalledWith(
        'testuser@example.com', expect.any(String), 'EMAIL_VERIFICATION', 'testuser',
      );
    });
  });

  // ─── verifyOtp ──────────────────────────────────────────────────────────────

  describe('verifyOtp', () => {
    it('should succeed with valid code', async () => {
      mockPrisma.otpCode.findFirst.mockResolvedValue(makeOtp({ code: '654321' }));
      mockPrisma.otpCode.update.mockResolvedValue({});

      await expect(service.verifyOtp('test@example.com', '654321', 'EMAIL_VERIFICATION'))
        .resolves.toBeUndefined();

      expect(mockPrisma.otpCode.update).toHaveBeenCalledWith({
        where: { id: 'otp-id-001' },
        data: { isUsed: true },
      });
    });

    it('should throw NotFoundException when no active OTP', async () => {
      mockPrisma.otpCode.findFirst.mockResolvedValue(null);

      await expect(service.verifyOtp('test@example.com', '123456', 'EMAIL_VERIFICATION'))
        .rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException for expired OTP', async () => {
      mockPrisma.otpCode.findFirst.mockResolvedValue(
        makeOtp({ expiresAt: new Date(Date.now() - 1000) }), // expired 1s ago
      );
      mockPrisma.otpCode.update.mockResolvedValue({});

      await expect(service.verifyOtp('test@example.com', '123456', 'EMAIL_VERIFICATION'))
        .rejects.toThrow(BadRequestException);
    });

    it('should throw and increment attempts for wrong code', async () => {
      mockPrisma.otpCode.findFirst.mockResolvedValue(makeOtp({ code: '999999', attempts: 2 }));
      mockPrisma.otpCode.update.mockResolvedValue({});

      await expect(service.verifyOtp('test@example.com', '000000', 'EMAIL_VERIFICATION'))
        .rejects.toThrow(BadRequestException);

      expect(mockPrisma.otpCode.update).toHaveBeenCalledWith({
        where: { id: 'otp-id-001' },
        data: { attempts: { increment: 1 } },
      });
    });

    it('should lock OTP after max attempts', async () => {
      mockPrisma.otpCode.findFirst.mockResolvedValue(makeOtp({ attempts: 5 }));
      mockPrisma.otpCode.update.mockResolvedValue({});

      await expect(service.verifyOtp('test@example.com', '123456', 'EMAIL_VERIFICATION'))
        .rejects.toThrow(BadRequestException);

      expect(mockPrisma.otpCode.update).toHaveBeenCalledWith({
        where: { id: 'otp-id-001' },
        data: { isUsed: true },
      });
    });

    it('should show remaining attempts in error message', async () => {
      mockPrisma.otpCode.findFirst.mockResolvedValue(makeOtp({ code: '999999', attempts: 3 }));
      mockPrisma.otpCode.update.mockResolvedValue({});

      try {
        await service.verifyOtp('test@example.com', '000000', 'EMAIL_VERIFICATION');
      } catch (e: any) {
        expect(e.message).toContain('1 attempt');
      }
    });
  });

  // ─── cleanupExpired ──────────────────────────────────────────────────────────

  describe('cleanupExpired', () => {
    it('should delete expired OTPs and return count', async () => {
      mockPrisma.otpCode.deleteMany.mockResolvedValue({ count: 7 });

      const count = await service.cleanupExpired();

      expect(count).toBe(7);
      expect(mockPrisma.otpCode.deleteMany).toHaveBeenCalledWith({
        where: { expiresAt: { lt: expect.any(Date) } },
      });
    });
  });
});
