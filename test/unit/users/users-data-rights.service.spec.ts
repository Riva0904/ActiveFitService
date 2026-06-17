import { Test, TestingModule } from '@nestjs/testing';
import { UsersService } from '../../../src/users/users.service';
import { PrismaService } from '../../../src/prisma/prisma.service';
import { EmailService } from '../../../src/email/email.service';
import { AuditService } from '../../../src/common/services/audit.service';

const mockUserSnapshot = {
  id: 'user-001', email: 'a@b.com', firstName: 'John', lastName: 'Doe', phone: null,
  role: 'MEMBER', avatar: null, dateOfBirth: null, gender: null, address: null,
  city: null, state: null, pincode: null, country: 'India', emergencyContact: null,
  isActive: true, gymId: 'gym-001', lastLoginAt: null, createdAt: new Date(),
  gym: { id: 'gym-001', name: 'FitnessHub' }, trainer: null,
};

const mockPrisma = {
  user: { findUnique: jest.fn(), delete: jest.fn() },
  $transaction: jest.fn(),
};

const mockEmailService = {};
const mockAuditService = { log: jest.fn() };

describe('UsersService — data rights (erasure + export)', () => {
  let service: UsersService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: EmailService, useValue: mockEmailService },
        { provide: AuditService, useValue: mockAuditService },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
    jest.clearAllMocks();
  });

  describe('remove (right to erasure)', () => {
    it('logs a USER_ERASED audit entry after the transaction commits', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(mockUserSnapshot);
      mockPrisma.$transaction.mockImplementation(async (fn: any) => fn({
        trainer: { findUnique: jest.fn().mockResolvedValue(null) },
        staff: { findUnique: jest.fn().mockResolvedValue(null) },
        member: { findFirst: jest.fn().mockResolvedValue(null) },
        notification: { deleteMany: jest.fn() },
        otpCode: { deleteMany: jest.fn() },
        auditLog: { deleteMany: jest.fn() },
        user: { delete: jest.fn() },
      }));

      await service.remove('user-001');

      expect(mockAuditService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'USER_ERASED',
          entity: 'User',
          entityId: 'user-001',
          gymId: 'gym-001',
          oldValues: mockUserSnapshot,
        }),
      );
    });

    it('writes the audit entry even though the transaction deletes the user’s own audit rows', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(mockUserSnapshot);
      const auditLogDeleteMany = jest.fn();
      mockPrisma.$transaction.mockImplementation(async (fn: any) => fn({
        trainer: { findUnique: jest.fn().mockResolvedValue(null) },
        staff: { findUnique: jest.fn().mockResolvedValue(null) },
        member: { findFirst: jest.fn().mockResolvedValue(null) },
        notification: { deleteMany: jest.fn() },
        otpCode: { deleteMany: jest.fn() },
        auditLog: { deleteMany: auditLogDeleteMany },
        user: { delete: jest.fn() },
      }));

      await service.remove('user-001');

      // The deleteMany happens inside the transaction; the erasure log call
      // happens strictly after — order matters so the record survives.
      expect(auditLogDeleteMany).toHaveBeenCalled();
      expect(mockAuditService.log).toHaveBeenCalled();
    });
  });

  describe('exportOwnData', () => {
    it('returns the requesting user’s own data', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(mockUserSnapshot);
      const result = await service.exportOwnData('user-001');
      expect(result).toEqual(mockUserSnapshot);
    });

    it('scopes the query to the given user id only', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(mockUserSnapshot);
      await service.exportOwnData('user-001');
      expect(mockPrisma.user.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'user-001' } }),
      );
    });
  });
});
