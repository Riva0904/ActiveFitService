import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { AttendanceService } from '../../../src/attendance/attendance.service';
import { PrismaService } from '../../../src/prisma/prisma.service';

const mockAttendance = {
  id: 'att-001',
  userId: 'user-001',
  gymId: 'gym-001',
  checkInTime: new Date(),
  checkOutTime: null,
  checkInMethod: 'QR',
  status: 'PRESENT',
  createdAt: new Date(),
};

const mockMembership = {
  id: 'mem-001',
  status: 'ACTIVE',
  endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
};

const mockPrisma = {
  attendance: {
    findFirst: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    count: jest.fn(),
  },
  membership: {
    findFirst: jest.fn(),
  },
  user: {
    findFirst: jest.fn(),
    count: jest.fn(),
  },
};

describe('AttendanceService', () => {
  let service: AttendanceService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AttendanceService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<AttendanceService>(AttendanceService);
    jest.clearAllMocks();
  });

  // ─── checkIn ────────────────────────────────────────────────────────────────

  describe('checkIn', () => {
    it('should check in user with active membership', async () => {
      mockPrisma.attendance.findFirst.mockResolvedValue(null); // not already checked in
      mockPrisma.membership.findFirst.mockResolvedValue(mockMembership);
      mockPrisma.attendance.create.mockResolvedValue(mockAttendance);

      const result = await service.checkIn('user-001', 'gym-001', 'QR');

      expect(result).toEqual(mockAttendance);
      expect(mockPrisma.attendance.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: 'user-001',
            gymId: 'gym-001',
            checkInMethod: 'QR',
          }),
        }),
      );
    });

    it('should throw BadRequestException if already checked in today', async () => {
      mockPrisma.attendance.findFirst.mockResolvedValue(mockAttendance);

      await expect(service.checkIn('user-001', 'gym-001')).rejects.toThrow(BadRequestException);
      expect(mockPrisma.attendance.create).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException with no active membership', async () => {
      mockPrisma.attendance.findFirst.mockResolvedValue(null);
      mockPrisma.membership.findFirst.mockResolvedValue(null);

      await expect(service.checkIn('user-001', 'gym-001')).rejects.toThrow(BadRequestException);
    });
  });

  // ─── checkOut ───────────────────────────────────────────────────────────────

  describe('checkOut', () => {
    it('should set checkOutTime on check-out', async () => {
      mockPrisma.attendance.findFirst.mockResolvedValue(mockAttendance);
      mockPrisma.attendance.update.mockResolvedValue({ ...mockAttendance, checkOutTime: new Date() });

      const result: any = await service.checkOut('att-001', 'user-001');
      expect(result.checkOutTime).toBeDefined();
      expect(mockPrisma.attendance.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { checkOutTime: expect.any(Date) } }),
      );
    });

    it('should throw NotFoundException if no active check-in', async () => {
      mockPrisma.attendance.findFirst.mockResolvedValue(null);
      await expect(service.checkOut('att-001', 'user-001')).rejects.toThrow(NotFoundException);
    });
  });

  // ─── checkInByQr ─────────────────────────────────────────────────────────────

  describe('checkInByQr', () => {
    it('should look up user by QR code and check in', async () => {
      mockPrisma.user.findFirst.mockResolvedValue({ id: 'user-001' });
      mockPrisma.attendance.findFirst.mockResolvedValue(null);
      mockPrisma.membership.findFirst.mockResolvedValue(mockMembership);
      mockPrisma.attendance.create.mockResolvedValue(mockAttendance);

      const result = await service.checkInByQr('qr-token', 'gym-001');
      expect(result).toEqual(mockAttendance);
    });

    it('should throw NotFoundException for invalid QR code', async () => {
      mockPrisma.user.findFirst.mockResolvedValue(null);
      await expect(service.checkInByQr('invalid-qr', 'gym-001')).rejects.toThrow(NotFoundException);
    });
  });

  // ─── getTodayStats ───────────────────────────────────────────────────────────

  describe('getTodayStats', () => {
    it('should return today attendance statistics', async () => {
      mockPrisma.attendance.count
        .mockResolvedValueOnce(42)  // totalToday
        .mockResolvedValueOnce(15); // currentlyIn
      mockPrisma.user.count.mockResolvedValue(200);

      const result: any = await service.getTodayStats('gym-001');

      expect(result.totalToday).toBe(42);
      expect(result.currentlyIn).toBe(15);
      expect(result.totalMembers).toBe(200);
    });
  });

  // ─── getWeeklyReport ─────────────────────────────────────────────────────────

  describe('getWeeklyReport', () => {
    it('should return 7 days of attendance data', async () => {
      mockPrisma.attendance.count.mockResolvedValue(25);

      const result: any = await service.getWeeklyReport('gym-001');

      expect(result).toHaveLength(7);
      result.forEach((day: any) => {
        expect(day).toHaveProperty('date');
        expect(day).toHaveProperty('count');
        expect(typeof day.count).toBe('number');
      });
    });

    it('should return dates in chronological order (oldest first)', async () => {
      mockPrisma.attendance.count.mockResolvedValue(0);
      const result: any = await service.getWeeklyReport('gym-001');

      for (let i = 1; i < result.length; i++) {
        expect(new Date(result[i].date).getTime()).toBeGreaterThan(
          new Date(result[i - 1].date).getTime(),
        );
      }
    });
  });

  // ─── findAll ────────────────────────────────────────────────────────────────

  describe('findAll', () => {
    it('should return paginated attendance records', async () => {
      mockPrisma.attendance.findMany.mockResolvedValue([mockAttendance]);
      mockPrisma.attendance.count.mockResolvedValue(1);

      const result: any = await service.findAll({ page: 1, limit: 20 }, 'gym-001');

      expect(result.data).toHaveLength(1);
      expect(result.total).toBe(1);
    });

    it('should filter by date', async () => {
      mockPrisma.attendance.findMany.mockResolvedValue([]);
      mockPrisma.attendance.count.mockResolvedValue(0);

      await service.findAll({ date: '2025-01-15' }, 'gym-001');

      const where = mockPrisma.attendance.findMany.mock.calls[0][0].where;
      expect(where.checkInTime).toBeDefined();
      expect(where.checkInTime.gte).toBeInstanceOf(Date);
      expect(where.checkInTime.lte).toBeInstanceOf(Date);
    });
  });
});
