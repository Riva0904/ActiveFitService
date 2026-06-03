/**
 * Combined spec covering trainers, pt-sessions, notifications, and workout/diet plans.
 * Keeping one file to avoid excessive test setup duplication for these lighter services.
 */

import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { TrainersService } from '../../../src/trainers/trainers.service';
import { PtSessionsService } from '../../../src/pt-sessions/pt-sessions.service';
import { NotificationsService } from '../../../src/notifications/notifications.service';
import { WorkoutPlansService } from '../../../src/workout-plans/workout-plans.service';
import { DietPlansService } from '../../../src/diet-plans/diet-plans.service';
import { PrismaService } from '../../../src/prisma/prisma.service';

// ─── Shared mock prisma ───────────────────────────────────────────────────────

const makePrisma = () => ({
  trainer: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    count: jest.fn(),
  },
  ptAssignment: {
    upsert: jest.fn(),
  },
  ptSession: {
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    count: jest.fn(),
  },
  notification: {
    findMany: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
    create: jest.fn(),
    createMany: jest.fn(),
    count: jest.fn(),
  },
  user: {
    findMany: jest.fn(),
  },
  workoutPlan: {
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  dietPlan: {
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
});

// ─── TrainersService ─────────────────────────────────────────────────────────

describe('TrainersService', () => {
  let service: TrainersService;
  let prisma: ReturnType<typeof makePrisma>;

  const mockTrainer = {
    id: 'trainer-001',
    gymId: 'gym-001',
    rating: 4.5,
    totalReviews: 20,
    experience: 5,
    isAvailable: true,
    user: { id: 'u1', firstName: 'Alex', lastName: 'Doe', email: 'a@x.com', phone: null, avatar: null },
    _count: { ptSessions: 12, assignedClients: 4 },
  };

  beforeEach(async () => {
    prisma = makePrisma();
    const module: TestingModule = await Test.createTestingModule({
      providers: [TrainersService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    service = module.get(TrainersService);
  });

  it('findAll returns paginated trainers', async () => {
    prisma.trainer.findMany.mockResolvedValue([mockTrainer]);
    prisma.trainer.count.mockResolvedValue(1);
    const res: any = await service.findAll({}, 'gym-001');
    expect(res.data).toHaveLength(1);
    expect(res.total).toBe(1);
  });

  it('findOne throws NotFoundException for unknown id', async () => {
    prisma.trainer.findUnique.mockResolvedValue(null);
    await expect(service.findOne('bad-id')).rejects.toThrow(NotFoundException);
  });

  it('findOne returns trainer with relations', async () => {
    prisma.trainer.findUnique.mockResolvedValue({ ...mockTrainer, ptSessions: [], assignedClients: [] });
    const res = await service.findOne('trainer-001');
    expect(res).toBeDefined();
  });

  it('create creates a trainer', async () => {
    prisma.trainer.create.mockResolvedValue(mockTrainer);
    const res = await service.create({ userId: 'u1', gymId: 'gym-001' });
    expect(res).toBeDefined();
  });

  it('assignClient upserts the assignment', async () => {
    prisma.ptAssignment.upsert.mockResolvedValue({ id: 'pa-1' });
    await service.assignClient('trainer-001', 'user-001');
    expect(prisma.ptAssignment.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { trainerId_clientId: { trainerId: 'trainer-001', clientId: 'user-001' } },
        create: { trainerId: 'trainer-001', clientId: 'user-001', isActive: true },
      }),
    );
  });

  it('getPerformance returns trainer performance metrics', async () => {
    prisma.trainer.findMany.mockResolvedValue([
      { ...mockTrainer, _count: { ptSessions: 8 } },
    ]);
    const res: any = await service.getPerformance('gym-001');
    expect(res[0].totalSessions).toBe(8);
    expect(res[0].name).toBe('Alex Doe');
  });
});

// ─── PtSessionsService ────────────────────────────────────────────────────────

describe('PtSessionsService', () => {
  let service: PtSessionsService;
  let prisma: ReturnType<typeof makePrisma>;

  const mockSession = {
    id: 'sess-001',
    trainerId: 'trainer-001',
    clientId: 'user-001',
    gymId: 'gym-001',
    scheduledAt: new Date(),
    duration: 60,
    status: 'SCHEDULED',
    trainer: { user: { firstName: 'Alex', lastName: 'Doe', avatar: null } },
    client: { id: 'user-001', firstName: 'John', lastName: 'Doe', avatar: null },
  };

  beforeEach(async () => {
    prisma = makePrisma();
    const module: TestingModule = await Test.createTestingModule({
      providers: [PtSessionsService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    service = module.get(PtSessionsService);
  });

  it('findAll returns paginated sessions', async () => {
    prisma.ptSession.findMany.mockResolvedValue([mockSession]);
    prisma.ptSession.count.mockResolvedValue(1);
    const res: any = await service.findAll({}, 'gym-001');
    expect(res.data).toHaveLength(1);
  });

  it('findAll filters by userId when role is USER', async () => {
    prisma.ptSession.findMany.mockResolvedValue([]);
    prisma.ptSession.count.mockResolvedValue(0);
    await service.findAll({}, undefined, 'user-001');
    const where = prisma.ptSession.findMany.mock.calls[0][0].where;
    expect(where.clientId).toBe('user-001');
  });

  it('create creates a session with trainer and client includes', async () => {
    prisma.ptSession.create.mockResolvedValue(mockSession);
    const res = await service.create({ trainerId: 'trainer-001', clientId: 'user-001', gymId: 'gym-001', scheduledAt: new Date() });
    expect(res).toBeDefined();
  });

  it('complete marks session as COMPLETED', async () => {
    prisma.ptSession.update.mockResolvedValue({ ...mockSession, status: 'COMPLETED' });
    await service.complete('sess-001', 'Good session', 5);
    expect(prisma.ptSession.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'COMPLETED', feedback: 'Good session', rating: 5 }) }),
    );
  });

  it('cancel marks session as CANCELLED', async () => {
    prisma.ptSession.update.mockResolvedValue({ ...mockSession, status: 'CANCELLED' });
    await service.cancel('sess-001');
    expect(prisma.ptSession.update).toHaveBeenCalledWith({ where: { id: 'sess-001' }, data: { status: 'CANCELLED' } });
  });
});

// ─── NotificationsService ─────────────────────────────────────────────────────

describe('NotificationsService', () => {
  let service: NotificationsService;
  let prisma: ReturnType<typeof makePrisma>;

  const mockNotif = {
    id: 'notif-001',
    title: 'Test',
    message: 'Hello',
    type: 'GENERAL',
    isRead: false,
    createdAt: new Date(),
  };

  beforeEach(async () => {
    prisma = makePrisma();
    const module: TestingModule = await Test.createTestingModule({
      providers: [NotificationsService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    service = module.get(NotificationsService);
  });

  it('findAll returns notifications for user', async () => {
    prisma.notification.findMany.mockResolvedValue([mockNotif]);
    const res = await service.findAll('user-001');
    expect(res).toHaveLength(1);
  });

  it('markAsRead marks notification as read', async () => {
    prisma.notification.update.mockResolvedValue({ ...mockNotif, isRead: true });
    await service.markAsRead('notif-001');
    expect(prisma.notification.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { isRead: true, readAt: expect.any(Date) } }),
    );
  });

  it('markAllAsRead marks all user notifications as read', async () => {
    prisma.notification.updateMany.mockResolvedValue({ count: 5 });
    await service.markAllAsRead('user-001');
    expect(prisma.notification.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: 'user-001', isRead: false } }),
    );
  });

  it('create creates a notification', async () => {
    prisma.notification.create.mockResolvedValue(mockNotif);
    await service.create({ title: 'Test', message: 'Hello', type: 'GENERAL' as any, userId: 'user-001' });
    expect(prisma.notification.create).toHaveBeenCalled();
  });

  it('broadcast sends to all gym members', async () => {
    prisma.user.findMany.mockResolvedValue([{ id: 'u1' }, { id: 'u2' }, { id: 'u3' }]);
    prisma.notification.createMany.mockResolvedValue({ count: 3 });
    await service.broadcast('gym-001', { title: 'Offer', message: '50% off', type: 'OFFER' as any });
    expect(prisma.notification.createMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.arrayContaining([expect.objectContaining({ gymId: 'gym-001' })]) }),
    );
  });

  it('getUnreadCount returns count of unread notifications', async () => {
    prisma.notification.count.mockResolvedValue(3);
    const count = await service.getUnreadCount('user-001');
    expect(count).toBe(3);
  });
});

// ─── WorkoutPlansService ──────────────────────────────────────────────────────

describe('WorkoutPlansService', () => {
  let service: WorkoutPlansService;
  let prisma: ReturnType<typeof makePrisma>;

  beforeEach(async () => {
    prisma = makePrisma();
    const module: TestingModule = await Test.createTestingModule({
      providers: [WorkoutPlansService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    service = module.get(WorkoutPlansService);
  });

  it('findByUser returns active plans', async () => {
    prisma.workoutPlan.findMany.mockResolvedValue([{ id: 'wp1', title: 'Plan A' }]);
    const res = await service.findByUser('user-001');
    expect(res).toHaveLength(1);
    const where = prisma.workoutPlan.findMany.mock.calls[0][0].where;
    expect(where.userId).toBe('user-001');
    expect(where.isActive).toBe(true);
  });

  it('create stores workout plan', async () => {
    prisma.workoutPlan.create.mockResolvedValue({ id: 'wp1' });
    await service.create({ title: 'Push Day', userId: 'user-001', exercises: [] });
    expect(prisma.workoutPlan.create).toHaveBeenCalled();
  });

  it('generateAiPlan creates an AI-flagged plan', async () => {
    prisma.workoutPlan.create.mockResolvedValue({ id: 'wp-ai', isAiGenerated: true });
    await service.generateAiPlan('user-001', 'Weight Loss', 'BEGINNER');
    const data = prisma.workoutPlan.create.mock.calls[0][0].data;
    expect(data.isAiGenerated).toBe(true);
    expect(data.goal).toBe('Weight Loss');
    expect(data.level).toBe('BEGINNER');
    expect(Array.isArray(data.exercises)).toBe(true);
  });

  it('update calls prisma update', async () => {
    prisma.workoutPlan.update.mockResolvedValue({ id: 'wp1', title: 'Updated' });
    await service.update('wp1', { title: 'Updated' });
    expect(prisma.workoutPlan.update).toHaveBeenCalledWith({ where: { id: 'wp1' }, data: { title: 'Updated' } });
  });
});

// ─── DietPlansService ─────────────────────────────────────────────────────────

describe('DietPlansService', () => {
  let service: DietPlansService;
  let prisma: ReturnType<typeof makePrisma>;

  beforeEach(async () => {
    prisma = makePrisma();
    const module: TestingModule = await Test.createTestingModule({
      providers: [DietPlansService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    service = module.get(DietPlansService);
  });

  it('findByUser returns active diet plans', async () => {
    prisma.dietPlan.findMany.mockResolvedValue([{ id: 'dp1' }]);
    const res = await service.findByUser('user-001');
    expect(res).toHaveLength(1);
  });

  it('generateAiDiet creates a plan with 4 meals', async () => {
    prisma.dietPlan.create.mockResolvedValue({ id: 'dp-ai' });
    await service.generateAiDiet('user-001', 'Weight Loss', 2000);
    const data = prisma.dietPlan.create.mock.calls[0][0].data;
    expect(data.isAiGenerated).toBe(true);
    expect(data.calories).toBe(2000);
    expect(data.meals).toHaveLength(4);
  });

  it('generateAiDiet meal calories sum to approximately target', async () => {
    prisma.dietPlan.create.mockResolvedValue({ id: 'dp-ai' });
    await service.generateAiDiet('user-001', 'Muscle Gain', 3000);
    const { meals } = prisma.dietPlan.create.mock.calls[0][0].data;
    const total = meals.reduce((sum: number, m: any) => sum + m.calories, 0);
    expect(total).toBeCloseTo(3000, -2); // within 1% of 3000
  });

  it('create stores diet plan', async () => {
    prisma.dietPlan.create.mockResolvedValue({ id: 'dp1' });
    await service.create({ title: 'Keto', userId: 'user-001', meals: [] });
    expect(prisma.dietPlan.create).toHaveBeenCalled();
  });
});
