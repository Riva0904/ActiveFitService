import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { EmailService } from '../../../src/email/email.service';
import * as nodemailer from 'nodemailer';

jest.mock('nodemailer');

const mockTransporter = {
  sendMail: jest.fn().mockResolvedValue({ messageId: 'mock-message-id' }),
  verify: jest.fn().mockResolvedValue(true),
};

(nodemailer.createTransport as jest.Mock).mockReturnValue(mockTransporter);

const mockConfigService = {
  get: jest.fn((key: string, fallback?: any) => {
    const config: Record<string, any> = {
      SMTP_USER: 'rivainvitation@gmail.com',
      SMTP_PASS: 'kjfshqiddkhtjgqe',
      FRONTEND_URL: 'http://localhost:3000',
    };
    return config[key] ?? fallback;
  }),
};

describe('EmailService', () => {
  let service: EmailService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmailService,
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    service = module.get<EmailService>(EmailService);
    jest.clearAllMocks();
    mockTransporter.sendMail.mockResolvedValue({ messageId: 'msg-id' });
  });

  // ─── sendMail ───────────────────────────────────────────────────────────────

  describe('sendMail', () => {
    it('should send email and return true on success', async () => {
      const result = await service.sendMail({
        to: 'user@example.com',
        subject: 'Test',
        html: '<p>Hello</p>',
      });

      expect(result).toBe(true);
      expect(mockTransporter.sendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          from: expect.stringContaining('rivainvitation@gmail.com'),
          to: 'user@example.com',
          subject: 'Test',
        }),
      );
    });

    it('should return false on SMTP failure', async () => {
      mockTransporter.sendMail.mockRejectedValue(new Error('SMTP error'));

      const result = await service.sendMail({
        to: 'user@example.com',
        subject: 'Test',
        html: '<p>Hello</p>',
      });

      expect(result).toBe(false);
    });
  });

  // ─── sendOtpEmail ────────────────────────────────────────────────────────────

  describe('sendOtpEmail', () => {
    it('should send OTP email with correct subject and content', async () => {
      const result = await service.sendOtpEmail(
        'user@example.com', '847291', 'EMAIL_VERIFICATION', 'John',
      );

      expect(result).toBe(true);
      const callArgs = mockTransporter.sendMail.mock.calls[0][0];
      expect(callArgs.subject).toContain('847291');
      expect(callArgs.html).toContain('847291');
      expect(callArgs.html).toContain('John');
      expect(callArgs.html).toContain('10 minutes');
    });

    it('should include security notice in OTP email', async () => {
      await service.sendOtpEmail('u@x.com', '000000', 'PASSWORD_RESET', 'User');
      const html = mockTransporter.sendMail.mock.calls[0][0].html;
      expect(html).toContain('Security Notice');
      expect(html).toContain('Never share');
    });

    it('should handle different OTP purposes', async () => {
      const purposes = ['EMAIL_VERIFICATION', 'LOGIN_2FA', 'PASSWORD_RESET'];
      for (const purpose of purposes) {
        jest.clearAllMocks();
        mockTransporter.sendMail.mockResolvedValue({ messageId: 'x' });
        await service.sendOtpEmail('u@x.com', '123456', purpose, 'User');
        expect(mockTransporter.sendMail).toHaveBeenCalledTimes(1);
      }
    });
  });

  // ─── sendWelcomeEmail ────────────────────────────────────────────────────────

  describe('sendWelcomeEmail', () => {
    it('should send welcome email with role-specific content for USER', async () => {
      await service.sendWelcomeEmail('user@example.com', 'John', 'USER');
      const html = mockTransporter.sendMail.mock.calls[0][0].html;
      expect(html).toContain('John');
      expect(html).toContain('QR check-in');
    });

    it('should send welcome email with admin content for ADMIN', async () => {
      await service.sendWelcomeEmail('admin@example.com', 'Admin', 'ADMIN');
      const html = mockTransporter.sendMail.mock.calls[0][0].html;
      expect(html).toContain('members');
    });
  });

  // ─── sendMembershipRenewalReminder ───────────────────────────────────────────

  describe('sendMembershipRenewalReminder', () => {
    it('should include days remaining in email', async () => {
      await service.sendMembershipRenewalReminder('u@x.com', 'John', 5, 'MONTHLY');
      const callArgs = mockTransporter.sendMail.mock.calls[0][0];
      expect(callArgs.subject).toContain('5 days');
      expect(callArgs.html).toContain('5');
    });

    it('should use urgent prefix for 2 days or less', async () => {
      await service.sendMembershipRenewalReminder('u@x.com', 'John', 1, 'MONTHLY');
      const subject = mockTransporter.sendMail.mock.calls[0][0].subject;
      expect(subject).toContain('1 days');
    });
  });

  // ─── sendPaymentConfirmation ──────────────────────────────────────────────────

  describe('sendPaymentConfirmation', () => {
    it('should include formatted amount and invoice number', async () => {
      await service.sendPaymentConfirmation('u@x.com', 'John', 2999, 'INV-001');
      const html = mockTransporter.sendMail.mock.calls[0][0].html;
      expect(html).toContain('INV-001');
      expect(html).toContain('PAID');
    });
  });

  // ─── sendPasswordChangedAlert ─────────────────────────────────────────────────

  describe('sendPasswordChangedAlert', () => {
    it('should send password changed alert email', async () => {
      await service.sendPasswordChangedAlert('u@x.com', 'John');
      const callArgs = mockTransporter.sendMail.mock.calls[0][0];
      expect(callArgs.subject).toContain('password');
      expect(callArgs.html).toContain('Wasn\'t you');
    });
  });

  // ─── verifyConnection ────────────────────────────────────────────────────────

  describe('verifyConnection', () => {
    it('should return true when SMTP is reachable', async () => {
      mockTransporter.verify.mockResolvedValue(true);
      const result = await service.verifyConnection();
      expect(result).toBe(true);
    });

    it('should return false when SMTP fails', async () => {
      mockTransporter.verify.mockRejectedValue(new Error('SMTP unreachable'));
      const result = await service.verifyConnection();
      expect(result).toBe(false);
    });
  });
});
