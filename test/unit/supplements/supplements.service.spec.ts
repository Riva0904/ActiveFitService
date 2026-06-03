import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { SupplementsService } from '../../../src/supplements/supplements.service';
import { PrismaService } from '../../../src/prisma/prisma.service';

const mockSupplement = {
  id: 'sup-001',
  name: 'Whey Protein',
  category: 'Protein',
  brand: 'ON',
  price: 3999,
  discountPrice: 3499,
  stock: 50,
  gymId: 'gym-001',
  isActive: true,
  images: [],
  flavor: [],
  createdAt: new Date(),
};

const mockPrisma = {
  supplement: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    count: jest.fn(),
  },
  supplementOrder: {
    create: jest.fn(),
    findMany: jest.fn(),
    update: jest.fn(),
    count: jest.fn(),
  },
};

describe('SupplementsService', () => {
  let service: SupplementsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SupplementsService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<SupplementsService>(SupplementsService);
    jest.clearAllMocks();
  });

  // ─── findAll ────────────────────────────────────────────────────────────────

  describe('findAll', () => {
    it('should return paginated active supplements for gym', async () => {
      mockPrisma.supplement.findMany.mockResolvedValue([mockSupplement]);
      mockPrisma.supplement.count.mockResolvedValue(1);

      const result: any = await service.findAll({}, 'gym-001');

      expect(result.data).toHaveLength(1);
      const where = mockPrisma.supplement.findMany.mock.calls[0][0].where;
      expect(where.isActive).toBe(true);
      expect(where.gymId).toBe('gym-001');
    });

    it('should filter by category', async () => {
      mockPrisma.supplement.findMany.mockResolvedValue([]);
      mockPrisma.supplement.count.mockResolvedValue(0);

      await service.findAll({ category: 'Protein' }, 'gym-001');

      const where = mockPrisma.supplement.findMany.mock.calls[0][0].where;
      expect(where.category).toBe('Protein');
    });
  });

  // ─── findOne ────────────────────────────────────────────────────────────────

  describe('findOne', () => {
    it('should return supplement by id', async () => {
      mockPrisma.supplement.findUnique.mockResolvedValue(mockSupplement);
      const result = await service.findOne('sup-001');
      expect(result).toEqual(mockSupplement);
    });

    it('should throw NotFoundException for unknown supplement', async () => {
      mockPrisma.supplement.findUnique.mockResolvedValue(null);
      await expect(service.findOne('bad')).rejects.toThrow(NotFoundException);
    });
  });

  // ─── updateStock ─────────────────────────────────────────────────────────────

  describe('updateStock', () => {
    it('should add quantity to existing stock', async () => {
      mockPrisma.supplement.findUnique.mockResolvedValue(mockSupplement); // stock: 50
      mockPrisma.supplement.update.mockResolvedValue({ ...mockSupplement, stock: 70 });

      await service.updateStock('sup-001', 20);

      expect(mockPrisma.supplement.update).toHaveBeenCalledWith({
        where: { id: 'sup-001' },
        data: { stock: 70 },
      });
    });

    it('should subtract stock with negative quantity', async () => {
      mockPrisma.supplement.findUnique.mockResolvedValue(mockSupplement);
      mockPrisma.supplement.update.mockResolvedValue({ ...mockSupplement, stock: 40 });

      await service.updateStock('sup-001', -10);

      expect(mockPrisma.supplement.update).toHaveBeenCalledWith({
        where: { id: 'sup-001' },
        data: { stock: 40 },
      });
    });
  });

  // ─── createOrder ─────────────────────────────────────────────────────────────

  describe('createOrder', () => {
    it('should create order with correct total amount', async () => {
      mockPrisma.supplement.findUnique.mockResolvedValue(mockSupplement); // price 3499
      mockPrisma.supplement.update.mockResolvedValue(mockSupplement);
      mockPrisma.supplementOrder.create.mockResolvedValue({
        id: 'ord-001',
        orderNumber: 'ORD-001',
        totalAmount: 3499 * 2,
        items: [],
      });

      const result: any = await service.createOrder('user-001', 'gym-001', [
        { supplementId: 'sup-001', quantity: 2 },
      ]);

      expect(mockPrisma.supplementOrder.create).toHaveBeenCalled();
      const createData = mockPrisma.supplementOrder.create.mock.calls[0][0].data;
      expect(createData.totalAmount).toBe(3499 * 2);
    });

    it('should throw BadRequestException for insufficient stock', async () => {
      mockPrisma.supplement.findUnique.mockResolvedValue({ ...mockSupplement, stock: 1 });

      await expect(
        service.createOrder('user-001', 'gym-001', [{ supplementId: 'sup-001', quantity: 5 }]),
      ).rejects.toThrow(BadRequestException);
    });

    it('should use discountPrice when available', async () => {
      mockPrisma.supplement.findUnique.mockResolvedValue(mockSupplement); // discountPrice: 3499
      mockPrisma.supplement.update.mockResolvedValue(mockSupplement);
      mockPrisma.supplementOrder.create.mockResolvedValue({ id: 'o1', items: [] });

      await service.createOrder('user-001', 'gym-001', [{ supplementId: 'sup-001', quantity: 1 }]);

      const createData = mockPrisma.supplementOrder.create.mock.calls[0][0].data;
      expect(createData.totalAmount).toBe(3499); // discount price used
    });

    it('should deduct stock after successful order', async () => {
      mockPrisma.supplement.findUnique.mockResolvedValue(mockSupplement);
      mockPrisma.supplement.update.mockResolvedValue(mockSupplement);
      mockPrisma.supplementOrder.create.mockResolvedValue({ id: 'o1', items: [] });

      await service.createOrder('user-001', 'gym-001', [{ supplementId: 'sup-001', quantity: 3 }]);

      expect(mockPrisma.supplement.update).toHaveBeenCalledWith({
        where: { id: 'sup-001' },
        data: { stock: { decrement: 3 } },
      });
    });
  });

  // ─── updateOrderStatus ───────────────────────────────────────────────────────

  describe('updateOrderStatus', () => {
    it('should update order status', async () => {
      mockPrisma.supplementOrder.update.mockResolvedValue({ id: 'ord-001', status: 'DELIVERED' });

      await service.updateOrderStatus('ord-001', 'DELIVERED' as any);

      expect(mockPrisma.supplementOrder.update).toHaveBeenCalledWith({
        where: { id: 'ord-001' },
        data: { status: 'DELIVERED' },
      });
    });
  });
});
