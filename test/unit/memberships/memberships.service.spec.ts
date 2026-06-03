import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { MembershipsService } from '../../../src/memberships/memberships.service';
import { PrismaService } from '../../../src/prisma/prisma.service';

const now = new Date();
const monthFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

const mockMembership = {
  id: 'mem-001',
  type: 'MONTHLY',
  status: 'ACTIVE',
  price: 2000,
  startDate: now,
  endDate: monthFromNow,
  autoRenew: false,
  userId: 'user-001',
  gymId: 'gym-001',
  createdAt: now,
  user: { id: 'user-001', firstName: 'John', lastName: 'Doe', email: 'j@x.com', phone: '+91 9876543210' },
};

const mockPrisma = {
  membership: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
    count: jest.fn(),
  },
  invoice: {
    create: jest.fn().mockResolvedValue({ id: 'inv-001' }),
  },
};

describe('MembershipsService', () => {
  let service: MembershipsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MembershipsService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<MembershipsService>(MembershipsService);
    jest.clearAllMocks();
  });

  // ─── findAll ────────────────────────────────────────────────────────────────

  describe('findAll', () => {
    it('should return paginated memberships', async () => {
      mockPrisma.membership.findMany.mockResolvedValue([mockMembership]);
      mockPrisma.membership.count.mockResolvedValue(1);

      const result: any = await service.findAll({ page: 1, limit: 10 }, 'gym-001');

      expect(result.data).toHaveLength(1);
      expect(result.total).toBe(1);
    });

    it('should filter by status', async () => {
      mockPrisma.membership.findMany.mockResolvedValue([]);
      mockPrisma.membership.count.mockResolvedValue(0);

      await service.findAll({ status: 'EXPIRED' }, 'gym-001');

      const where = mockPrisma.membership.findMany.mock.calls[0][0].where;
      expect(where.status).toBe('EXPIRED');
    });
  });

  // ─── findOne ────────────────────────────────────────────────────────────────

  describe('findOne', () => {
    it('should return membership with user details', async () => {
      mockPrisma.membership.findUnique.mockResolvedValue(mockMembership);
      const result = await service.findOne('mem-001');
      expect(result).toEqual(mockMembership);
    });

    it('should throw NotFoundException for unknown id', async () => {
      mockPrisma.membership.findUnique.mockResolvedValue(null);
      await expect(service.findOne('bad')).rejects.toThrow(NotFoundException);
    });
  });

  // ─── create ─────────────────────────────────────────────────────────────────

  describe('create', () => {
    it('should create membership and generate invoice', async () => {
      mockPrisma.membership.create.mockResolvedValue(mockMembership);

      const result = await service.create({
        type: 'MONTHLY', price: 2000, startDate: now, endDate: monthFromNow,
        userId: 'user-001', gymId: 'gym-001',
      });

      expect(mockPrisma.membership.create).toHaveBeenCalled();
      expect(mockPrisma.invoice.create).toHaveBeenCalled();
      expect(result).toEqual(mockMembership);
    });

    it('should calculate 18% tax in invoice', async () => {
      mockPrisma.membership.create.mockResolvedValue(mockMembership);

      await service.create({
        type: 'MONTHLY', price: 2000, startDate: now, endDate: monthFromNow,
        userId: 'user-001', gymId: 'gym-001',
      });

      const invoiceData = mockPrisma.invoice.create.mock.calls[0][0].data;
      expect(invoiceData.tax).toBe(2000 * 0.18);
      expect(invoiceData.totalAmount).toBe(2000 * 1.18);
    });
  });

  // ─── renew ──────────────────────────────────────────────────────────────────

  describe('renew', () => {
    it('should extend MONTHLY membership by 1 month', async () => {
      mockPrisma.membership.findUnique.mockResolvedValue(mockMembership);
      mockPrisma.membership.update.mockResolvedValue({
        ...mockMembership,
        endDate: new Date(monthFromNow.getTime() + 30 * 24 * 60 * 60 * 1000),
      });

      await service.renew('mem-001');

      const updateData = mockPrisma.membership.update.mock.calls[0][0].data;
      expect(updateData.status).toBe('ACTIVE');
      expect(updateData.endDate).toBeInstanceOf(Date);
    });

    it('should renew YEARLY by 1 year', async () => {
      const yearlyEnd = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000);
      mockPrisma.membership.findUnique.mockResolvedValue({
        ...mockMembership, type: 'YEARLY', endDate: yearlyEnd,
      });
      mockPrisma.membership.update.mockResolvedValue(mockMembership);

      await service.renew('mem-001');

      const updateData = mockPrisma.membership.update.mock.calls[0][0].data;
      const expectedEnd = new Date(yearlyEnd);
      expectedEnd.setFullYear(expectedEnd.getFullYear() + 1);
      expect(updateData.endDate.getFullYear()).toBe(expectedEnd.getFullYear());
    });

    it('should start renewal from today if membership already expired', async () => {
      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
      mockPrisma.membership.findUnique.mockResolvedValue({
        ...mockMembership, endDate: yesterday,
      });
      mockPrisma.membership.update.mockResolvedValue(mockMembership);

      await service.renew('mem-001');

      const updateData = mockPrisma.membership.update.mock.calls[0][0].data;
      const startDate: Date = updateData.startDate;
      const today = new Date();
      expect(startDate.getDate()).toBe(today.getDate());
    });
  });

  // ─── getExpiringMembers ──────────────────────────────────────────────────────

  describe('getExpiringMembers', () => {
    it('should return members expiring within specified days', async () => {
      mockPrisma.membership.findMany.mockResolvedValue([mockMembership]);

      const result = await service.getExpiringMembers('gym-001', 7);

      expect(result).toHaveLength(1);
      const where = mockPrisma.membership.findMany.mock.calls[0][0].where;
      expect(where.status).toBe('ACTIVE');
      expect(where.endDate).toBeDefined();
    });
  });

  // ─── checkExpiredMemberships (cron) ──────────────────────────────────────────

  describe('checkExpiredMemberships', () => {
    it('should expire all past-due memberships', async () => {
      mockPrisma.membership.updateMany.mockResolvedValue({ count: 5 });

      await service.checkExpiredMemberships();

      expect(mockPrisma.membership.updateMany).toHaveBeenCalledWith({
        where: { status: 'ACTIVE', endDate: { lt: expect.any(Date) } },
        data: { status: 'EXPIRED' },
      });
    });
  });
});
