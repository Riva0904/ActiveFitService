import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, ForbiddenException } from '@nestjs/common';
import { GymsService } from '../../../src/gyms/gyms.service';
import { PrismaService } from '../../../src/prisma/prisma.service';

const mockGym = {
  id: 'gym-001',
  name: 'FitnessHub',
  email: 'info@fitnesshub.com',
  phone: '+91 9876543210',
  address: '123 St',
  city: 'Bangalore',
  state: 'Karnataka',
  pincode: '560001',
  status: 'ACTIVE',
  subscriptionPlan: 'PROFESSIONAL',
  subscriptionStatus: 'ACTIVE',
  adminId: 'admin-001',
  createdAt: new Date(),
};

const mockPrisma = {
  gym: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    count: jest.fn(),
  },
  user: { count: jest.fn() },
  membership: { count: jest.fn() },
  attendance: { count: jest.fn() },
  payment: {
    aggregate: jest.fn().mockResolvedValue({ _sum: { amount: 50000 } }),
    count: jest.fn(),
  },
};

describe('GymsService', () => {
  let service: GymsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GymsService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<GymsService>(GymsService);
    jest.clearAllMocks();
  });

  // ─── findAll ────────────────────────────────────────────────────────────────

  describe('findAll', () => {
    it('should return paginated gyms', async () => {
      mockPrisma.gym.findMany.mockResolvedValue([mockGym]);
      mockPrisma.gym.count.mockResolvedValue(1);

      const result: any = await service.findAll({ page: 1, limit: 10 });

      expect(result.data).toHaveLength(1);
      expect(result.total).toBe(1);
    });

    it('should filter by status', async () => {
      mockPrisma.gym.findMany.mockResolvedValue([]);
      mockPrisma.gym.count.mockResolvedValue(0);

      await service.findAll({ status: 'PENDING' });

      const where = mockPrisma.gym.findMany.mock.calls[0][0].where;
      expect(where.status).toBe('PENDING');
    });

    it('should search by name and city', async () => {
      mockPrisma.gym.findMany.mockResolvedValue([]);
      mockPrisma.gym.count.mockResolvedValue(0);

      await service.findAll({ search: 'fitness' });

      const where = mockPrisma.gym.findMany.mock.calls[0][0].where;
      expect(where.OR).toBeDefined();
    });
  });

  // ─── findOne ────────────────────────────────────────────────────────────────

  describe('findOne', () => {
    it('should return gym with admin and counts', async () => {
      mockPrisma.gym.findUnique.mockResolvedValue(mockGym);
      const result = await service.findOne('gym-001');
      expect(result).toEqual(mockGym);
    });

    it('should throw NotFoundException if not found', async () => {
      mockPrisma.gym.findUnique.mockResolvedValue(null);
      await expect(service.findOne('bad-id')).rejects.toThrow(NotFoundException);
    });
  });

  // ─── create ─────────────────────────────────────────────────────────────────

  describe('create', () => {
    it('should create and return gym', async () => {
      mockPrisma.gym.create.mockResolvedValue(mockGym);
      const result = await service.create({ name: 'FitnessHub', email: 'x@x.com' });
      expect(result).toEqual(mockGym);
    });
  });

  // ─── update ─────────────────────────────────────────────────────────────────

  describe('update', () => {
    it('should update gym when called by Super Admin', async () => {
      mockPrisma.gym.findUnique.mockResolvedValue(mockGym);
      mockPrisma.gym.update.mockResolvedValue({ ...mockGym, name: 'Updated' });

      await service.update('gym-001', { name: 'Updated' }, { role: 'SUPER_ADMIN', id: 'sa-001' });

      expect(mockPrisma.gym.update).toHaveBeenCalledWith({
        where: { id: 'gym-001' },
        data: { name: 'Updated' },
      });
    });

    it('should allow Admin to update own gym', async () => {
      mockPrisma.gym.findUnique.mockResolvedValue({ ...mockGym, adminId: 'admin-001' });
      mockPrisma.gym.update.mockResolvedValue(mockGym);

      await service.update('gym-001', {}, { role: 'ADMIN', id: 'admin-001' });
      expect(mockPrisma.gym.update).toHaveBeenCalled();
    });

    it('should throw ForbiddenException if Admin tries to update another gym', async () => {
      mockPrisma.gym.findUnique.mockResolvedValue({ ...mockGym, adminId: 'other-admin' });

      await expect(
        service.update('gym-001', {}, { role: 'ADMIN', id: 'admin-001' }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw NotFoundException for non-existent gym', async () => {
      mockPrisma.gym.findUnique.mockResolvedValue(null);
      await expect(service.update('bad', {}, { role: 'SUPER_ADMIN', id: 'x' })).rejects.toThrow(NotFoundException);
    });
  });

  // ─── updateStatus ────────────────────────────────────────────────────────────

  describe('updateStatus', () => {
    it('should update gym status', async () => {
      mockPrisma.gym.findUnique.mockResolvedValue(mockGym);
      mockPrisma.gym.update.mockResolvedValue({ ...mockGym, status: 'SUSPENDED' });

      await service.updateStatus('gym-001', 'SUSPENDED' as any);

      expect(mockPrisma.gym.update).toHaveBeenCalledWith({
        where: { id: 'gym-001' },
        data: { status: 'SUSPENDED' },
      });
    });
  });

  // ─── remove ─────────────────────────────────────────────────────────────────

  describe('remove', () => {
    it('should delete gym if it exists', async () => {
      mockPrisma.gym.findUnique.mockResolvedValue(mockGym);
      mockPrisma.gym.delete.mockResolvedValue(mockGym);

      await service.remove('gym-001');
      expect(mockPrisma.gym.delete).toHaveBeenCalledWith({ where: { id: 'gym-001' } });
    });

    it('should throw NotFoundException for non-existent gym', async () => {
      mockPrisma.gym.findUnique.mockResolvedValue(null);
      await expect(service.remove('bad')).rejects.toThrow(NotFoundException);
    });
  });

  // ─── getStats ────────────────────────────────────────────────────────────────

  describe('getStats', () => {
    it('should return gym statistics', async () => {
      mockPrisma.user.count.mockResolvedValue(150);
      mockPrisma.membership.count.mockResolvedValue(120);
      mockPrisma.attendance.count.mockResolvedValue(45);
      mockPrisma.payment.aggregate.mockResolvedValue({ _sum: { amount: 75000 } });
      mockPrisma.payment.count.mockResolvedValue(3);

      const result: any = await service.getStats('gym-001');

      expect(result.totalMembers).toBe(150);
      expect(result.activeMembers).toBe(120);
      expect(result.todayAttendance).toBe(45);
      expect(result.monthlyRevenue).toBe(75000);
      expect(result.pendingPayments).toBe(3);
    });

    it('should return 0 for missing revenue data', async () => {
      mockPrisma.user.count.mockResolvedValue(0);
      mockPrisma.membership.count.mockResolvedValue(0);
      mockPrisma.attendance.count.mockResolvedValue(0);
      mockPrisma.payment.aggregate.mockResolvedValue({ _sum: { amount: null } });
      mockPrisma.payment.count.mockResolvedValue(0);

      const result: any = await service.getStats('gym-001');
      expect(result.monthlyRevenue).toBe(0);
    });
  });
});
