import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { UsersService } from '../../../src/users/users.service';
import { PrismaService } from '../../../src/prisma/prisma.service';

const mockUser = {
  id: 'user-001',
  email: 'user@example.com',
  firstName: 'John',
  lastName: 'Doe',
  phone: '+91 9876543210',
  role: 'USER',
  avatar: null,
  isActive: true,
  gymId: 'gym-001',
  lastLogin: null,
  createdAt: new Date(),
  memberships: [],
};

const mockPrisma = {
  user: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
    count: jest.fn(),
  },
  membership: {
    count: jest.fn(),
  },
};

describe('UsersService', () => {
  let service: UsersService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
    jest.clearAllMocks();
  });

  // ─── findAll ────────────────────────────────────────────────────────────────

  describe('findAll', () => {
    it('should return paginated users for a gym', async () => {
      mockPrisma.user.findMany.mockResolvedValue([mockUser]);
      mockPrisma.user.count.mockResolvedValue(1);

      const result: any = await service.findAll({ page: 1, limit: 10 }, 'gym-001');

      expect(result.data).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(result.page).toBe(1);
      expect(result.totalPages).toBe(1);
    });

    it('should apply search filter', async () => {
      mockPrisma.user.findMany.mockResolvedValue([]);
      mockPrisma.user.count.mockResolvedValue(0);

      await service.findAll({ search: 'john' }, 'gym-001');

      const where = mockPrisma.user.findMany.mock.calls[0][0].where;
      expect(where.OR).toBeDefined();
      expect(where.OR.some((o: any) => o.firstName)).toBe(true);
    });

    it('should apply role filter', async () => {
      mockPrisma.user.findMany.mockResolvedValue([]);
      mockPrisma.user.count.mockResolvedValue(0);

      await service.findAll({ role: 'ADMIN' }, undefined);

      const where = mockPrisma.user.findMany.mock.calls[0][0].where;
      expect(where.role).toBe('ADMIN');
    });

    it('should calculate correct totalPages for large datasets', async () => {
      mockPrisma.user.findMany.mockResolvedValue(Array(10).fill(mockUser));
      mockPrisma.user.count.mockResolvedValue(25);

      const result: any = await service.findAll({ page: 1, limit: 10 });
      expect(result.totalPages).toBe(3);
    });
  });

  // ─── findOne ────────────────────────────────────────────────────────────────

  describe('findOne', () => {
    it('should return user by id', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(mockUser);

      const result = await service.findOne('user-001');
      expect(result).toEqual(mockUser);
      expect(mockPrisma.user.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'user-001' } }),
      );
    });

    it('should throw NotFoundException if user does not exist', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);
      await expect(service.findOne('nonexistent')).rejects.toThrow(NotFoundException);
    });
  });

  // ─── update ─────────────────────────────────────────────────────────────────

  describe('update', () => {
    it('should update user and return selected fields', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(mockUser);
      const updatedUser = { ...mockUser, firstName: 'Updated' };
      mockPrisma.user.update.mockResolvedValue(updatedUser);

      const result = await service.update('user-001', { firstName: 'Updated' });
      expect(mockPrisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'user-001' },
          data: { firstName: 'Updated' },
        }),
      );
    });

    it('should throw NotFoundException for nonexistent user', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);
      await expect(service.update('bad-id', {})).rejects.toThrow(NotFoundException);
    });
  });

  // ─── deactivate / activate ───────────────────────────────────────────────────

  describe('deactivate', () => {
    it('should set isActive to false', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(mockUser);
      mockPrisma.user.update.mockResolvedValue({ ...mockUser, isActive: false });

      await service.deactivate('user-001');
      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-001' },
        data: { isActive: false },
      });
    });
  });

  describe('activate', () => {
    it('should set isActive to true', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ ...mockUser, isActive: false });
      mockPrisma.user.update.mockResolvedValue(mockUser);

      await service.activate('user-001');
      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-001' },
        data: { isActive: true },
      });
    });
  });

  // ─── getMemberStats ──────────────────────────────────────────────────────────

  describe('getMemberStats', () => {
    it('should return member statistics for a gym', async () => {
      mockPrisma.user.count
        .mockResolvedValueOnce(100)  // total
        .mockResolvedValueOnce(5);  // newThisMonth
      mockPrisma.membership.count
        .mockResolvedValueOnce(85)  // active memberships
        .mockResolvedValueOnce(8);  // expiring soon

      const result: any = await service.getMemberStats('gym-001');

      expect(result.total).toBe(100);
      expect(result.active).toBe(85);
      expect(result.newThisMonth).toBe(5);
      expect(result.expiringSoon).toBe(8);
    });
  });
});
