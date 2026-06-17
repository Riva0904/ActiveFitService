import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { SaasPlansService } from '../../../src/saas-plans/saas-plans.service';
import { PrismaService } from '../../../src/prisma/prisma.service';

const mockPlan = { id: 'plan-001', plan: 'STARTER', name: 'Starter', monthlyPrice: 2999 };

const mockPrisma = {
  saaSSubscriptionPlan: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
    upsert: jest.fn(),
  },
};

describe('SaasPlansService', () => {
  let service: SaasPlansService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [SaasPlansService, { provide: PrismaService, useValue: mockPrisma }],
    }).compile();

    service = module.get<SaasPlansService>(SaasPlansService);
    jest.clearAllMocks();
  });

  describe('findAll (caching)', () => {
    it('hits the DB on first call', async () => {
      mockPrisma.saaSSubscriptionPlan.findMany.mockResolvedValue([mockPlan]);
      const result = await service.findAll();
      expect(result).toEqual([mockPlan]);
      expect(mockPrisma.saaSSubscriptionPlan.findMany).toHaveBeenCalledTimes(1);
    });

    it('serves the second call from cache, not the DB', async () => {
      mockPrisma.saaSSubscriptionPlan.findMany.mockResolvedValue([mockPlan]);
      await service.findAll();
      await service.findAll();
      expect(mockPrisma.saaSSubscriptionPlan.findMany).toHaveBeenCalledTimes(1);
    });

    it('re-hits the DB after the TTL expires', async () => {
      jest.useFakeTimers();
      mockPrisma.saaSSubscriptionPlan.findMany.mockResolvedValue([mockPlan]);
      await service.findAll();
      jest.advanceTimersByTime(5 * 60 * 1000 + 1);
      await service.findAll();
      expect(mockPrisma.saaSSubscriptionPlan.findMany).toHaveBeenCalledTimes(2);
      jest.useRealTimers();
    });

    it('invalidates the cache after update()', async () => {
      mockPrisma.saaSSubscriptionPlan.findMany.mockResolvedValue([mockPlan]);
      mockPrisma.saaSSubscriptionPlan.findUnique.mockResolvedValue(mockPlan);
      mockPrisma.saaSSubscriptionPlan.update.mockResolvedValue({ ...mockPlan, monthlyPrice: 3999 });

      await service.findAll(); // populates cache
      await service.update('plan-001', { monthlyPrice: 3999 });
      await service.findAll(); // must re-hit DB, not serve stale cache

      expect(mockPrisma.saaSSubscriptionPlan.findMany).toHaveBeenCalledTimes(2);
    });

    it('invalidates the cache after initDefaults()', async () => {
      mockPrisma.saaSSubscriptionPlan.findMany.mockResolvedValue([mockPlan]);
      mockPrisma.saaSSubscriptionPlan.upsert.mockResolvedValue(mockPlan);

      await service.findAll(); // populates cache
      await service.initDefaults();
      await service.findAll();

      // initDefaults' own findMany + the two findAll calls = 3
      expect(mockPrisma.saaSSubscriptionPlan.findMany).toHaveBeenCalledTimes(3);
    });
  });

  describe('findOne', () => {
    it('throws NotFoundException for unknown id', async () => {
      mockPrisma.saaSSubscriptionPlan.findUnique.mockResolvedValue(null);
      await expect(service.findOne('bad-id')).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('throws NotFoundException for unknown id', async () => {
      mockPrisma.saaSSubscriptionPlan.findUnique.mockResolvedValue(null);
      await expect(service.update('bad-id', {})).rejects.toThrow(NotFoundException);
    });

    it('strips immutable fields before writing', async () => {
      mockPrisma.saaSSubscriptionPlan.findUnique.mockResolvedValue(mockPlan);
      mockPrisma.saaSSubscriptionPlan.update.mockResolvedValue(mockPlan);

      await service.update('plan-001', { id: 'x', plan: 'PRO', name: 'hack', monthlyPrice: 1 });

      expect(mockPrisma.saaSSubscriptionPlan.update).toHaveBeenCalledWith({
        where: { id: 'plan-001' },
        data: { monthlyPrice: 1 },
      });
    });
  });
});
