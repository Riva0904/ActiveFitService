import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PaymentsService } from '../../../src/payments/payments.service';
import { PrismaService } from '../../../src/prisma/prisma.service';

// Mock Razorpay
jest.mock('razorpay', () => {
  return jest.fn().mockImplementation(() => ({
    orders: {
      create: jest.fn().mockResolvedValue({
        id: 'order_test123',
        amount: 299900,
        currency: 'INR',
      }),
    },
  }));
});

const mockPayment = {
  id: 'pay-001',
  amount: 2999,
  type: 'MEMBERSHIP',
  status: 'PENDING',
  method: 'RAZORPAY',
  razorpayOrderId: 'order_test123',
  userId: 'user-001',
  gymId: 'gym-001',
  createdAt: new Date(),
};

const mockPrisma = {
  payment: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    count: jest.fn(),
    aggregate: jest.fn(),
  },
};

const mockConfig = {
  get: jest.fn((key: string, fallback?: any) => {
    const map: Record<string, string> = {
      RAZORPAY_KEY_ID: 'rzp_test_key',
      RAZORPAY_KEY_SECRET: 'test_secret',
    };
    return map[key] ?? fallback;
  }),
};

describe('PaymentsService', () => {
  let service: PaymentsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentsService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: ConfigService, useValue: mockConfig },
      ],
    }).compile();

    service = module.get<PaymentsService>(PaymentsService);
    jest.clearAllMocks();
  });

  // ─── findAll ────────────────────────────────────────────────────────────────

  describe('findAll', () => {
    it('should return paginated payments filtered by gym', async () => {
      mockPrisma.payment.findMany.mockResolvedValue([mockPayment]);
      mockPrisma.payment.count.mockResolvedValue(1);

      const result: any = await service.findAll({}, 'gym-001');

      expect(result.data).toHaveLength(1);
      const where = mockPrisma.payment.findMany.mock.calls[0][0].where;
      expect(where.gymId).toBe('gym-001');
    });

    it('should filter by status and type', async () => {
      mockPrisma.payment.findMany.mockResolvedValue([]);
      mockPrisma.payment.count.mockResolvedValue(0);

      await service.findAll({ status: 'COMPLETED', type: 'MEMBERSHIP' }, 'gym-001');

      const where = mockPrisma.payment.findMany.mock.calls[0][0].where;
      expect(where.status).toBe('COMPLETED');
      expect(where.type).toBe('MEMBERSHIP');
    });
  });

  // ─── createRazorpayOrder ──────────────────────────────────────────────────────

  describe('createRazorpayOrder', () => {
    it('should create Razorpay order and payment record', async () => {
      mockPrisma.payment.create.mockResolvedValue(mockPayment);

      const result: any = await service.createRazorpayOrder(2999, 'user-001', 'gym-001', 'MEMBERSHIP');

      expect(result.orderId).toBe('order_test123');
      expect(result.amount).toBe(2999);
      expect(result.currency).toBe('INR');
      expect(result.paymentId).toBeDefined();
    });

    it('should store pending payment in DB', async () => {
      mockPrisma.payment.create.mockResolvedValue(mockPayment);

      await service.createRazorpayOrder(1500, 'user-001', 'gym-001', 'SUPPLEMENT');

      expect(mockPrisma.payment.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            amount: 1500,
            status: 'PENDING',
            method: 'RAZORPAY',
          }),
        }),
      );
    });
  });

  // ─── verifyPayment ───────────────────────────────────────────────────────────

  describe('verifyPayment', () => {
    it('should throw NotFoundException for unknown payment', async () => {
      mockPrisma.payment.findUnique.mockResolvedValue(null);

      await expect(
        service.verifyPayment('bad-id', 'pay_xxx', 'sig_xxx'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should mark payment as FAILED on invalid signature', async () => {
      mockPrisma.payment.findUnique.mockResolvedValue(mockPayment);
      mockPrisma.payment.update.mockResolvedValue({ ...mockPayment, status: 'FAILED' });

      await expect(
        service.verifyPayment('pay-001', 'pay_xxx', 'invalid_signature'),
      ).rejects.toThrow();

      expect(mockPrisma.payment.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { status: 'FAILED' } }),
      );
    });
  });

  // ─── recordCashPayment ───────────────────────────────────────────────────────

  describe('recordCashPayment', () => {
    it('should create COMPLETED payment with CASH method', async () => {
      mockPrisma.payment.create.mockResolvedValue({
        ...mockPayment, method: 'CASH', status: 'COMPLETED',
      });

      await service.recordCashPayment({
        amount: 2000, type: 'MEMBERSHIP', userId: 'user-001', gymId: 'gym-001',
      });

      expect(mockPrisma.payment.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            method: 'CASH',
            status: 'COMPLETED',
            paidAt: expect.any(Date),
          }),
        }),
      );
    });
  });

  // ─── getRevenueStats ─────────────────────────────────────────────────────────

  describe('getRevenueStats', () => {
    it('should return monthly, yearly and pending revenue', async () => {
      mockPrisma.payment.aggregate
        .mockResolvedValueOnce({ _sum: { amount: 50000 } }) // monthly
        .mockResolvedValueOnce({ _sum: { amount: 350000 } }) // yearly
        .mockResolvedValueOnce({ _sum: { amount: 15000 }, _count: 7 }); // pending

      const result: any = await service.getRevenueStats('gym-001');

      expect(result.monthlyRevenue).toBe(50000);
      expect(result.yearlyRevenue).toBe(350000);
      expect(result.pendingAmount).toBe(15000);
      expect(result.pendingCount).toBe(7);
    });

    it('should return 0 for null aggregation result', async () => {
      mockPrisma.payment.aggregate.mockResolvedValue({ _sum: { amount: null }, _count: 0 });

      const result: any = await service.getRevenueStats('gym-001');
      expect(result.monthlyRevenue).toBe(0);
    });
  });
});
