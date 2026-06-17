import { Test, TestingModule } from '@nestjs/testing';
import { PromoCodesService } from '../../../src/promo-codes/promo-codes.service';
import { PrismaService } from '../../../src/prisma/prisma.service';

const mockPrisma = {
  promoCode: {
    findFirst: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
    create: jest.fn(),
    delete: jest.fn(),
  },
};

describe('PromoCodesService', () => {
  let service: PromoCodesService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [PromoCodesService, { provide: PrismaService, useValue: mockPrisma }],
    }).compile();

    service = module.get<PromoCodesService>(PromoCodesService);
    jest.clearAllMocks();
  });

  describe('incrementUsage', () => {
    it('returns false when the promo code no longer exists', async () => {
      mockPrisma.promoCode.findUnique.mockResolvedValue(null);
      const result = await service.incrementUsage('missing-id');
      expect(result).toBe(false);
      expect(mockPrisma.promoCode.updateMany).not.toHaveBeenCalled();
    });

    it('guards the increment with usedCount < maxUses in the WHERE clause (race-safe)', async () => {
      mockPrisma.promoCode.findUnique.mockResolvedValue({ id: 'p1', maxUses: 1, usedCount: 0 });
      mockPrisma.promoCode.updateMany.mockResolvedValue({ count: 1 });

      const result = await service.incrementUsage('p1');

      expect(result).toBe(true);
      expect(mockPrisma.promoCode.updateMany).toHaveBeenCalledWith({
        where: { id: 'p1', usedCount: { lt: 1 } },
        data: { usedCount: { increment: 1 } },
      });
    });

    it('returns false when a concurrent payment already consumed the last use', async () => {
      mockPrisma.promoCode.findUnique.mockResolvedValue({ id: 'p1', maxUses: 1, usedCount: 1 });
      // Simulates the DB-level race: WHERE usedCount < maxUses matches 0 rows.
      mockPrisma.promoCode.updateMany.mockResolvedValue({ count: 0 });

      const result = await service.incrementUsage('p1');
      expect(result).toBe(false);
    });

    it('omits the usedCount guard for unlimited-use codes (maxUses: null)', async () => {
      mockPrisma.promoCode.findUnique.mockResolvedValue({ id: 'p1', maxUses: null, usedCount: 50 });
      mockPrisma.promoCode.updateMany.mockResolvedValue({ count: 1 });

      await service.incrementUsage('p1');

      expect(mockPrisma.promoCode.updateMany).toHaveBeenCalledWith({
        where: { id: 'p1' },
        data: { usedCount: { increment: 1 } },
      });
    });
  });

  describe('validate', () => {
    it('rejects when usage limit already reached', async () => {
      mockPrisma.promoCode.findFirst.mockResolvedValue({
        id: 'p1', maxUses: 5, usedCount: 5, isActive: true,
        validFrom: new Date(Date.now() - 1000), validTo: new Date(Date.now() + 100000),
      });
      const result = await service.validate('CODE', 'gym-001', 1000);
      expect(result.valid).toBe(false);
    });

    it('floors the discounted amount at 1, never 0 or negative', async () => {
      mockPrisma.promoCode.findFirst.mockResolvedValue({
        id: 'p1', maxUses: null, usedCount: 0, isActive: true,
        discountType: 'FLAT', discountValue: 9999,
        validFrom: new Date(Date.now() - 1000), validTo: new Date(Date.now() + 100000),
      });
      const result: any = await service.validate('CODE', 'gym-001', 100);
      expect(result.finalAmount).toBe(1);
    });
  });
});
