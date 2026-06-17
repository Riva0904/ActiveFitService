import { Test, TestingModule } from '@nestjs/testing';
import { ChatService } from '../../../src/chat/chat.service';
import { PrismaService } from '../../../src/prisma/prisma.service';

const mockPrisma = {
  chatConversation: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  chatMessage: {
    findMany: jest.fn(),
  },
  user: { findFirst: jest.fn() },
};

describe('ChatService', () => {
  let service: ChatService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ChatService, { provide: PrismaService, useValue: mockPrisma }],
    }).compile();

    service = module.get<ChatService>(ChatService);
    jest.clearAllMocks();
  });

  describe('getAllConversations', () => {
    it('caps the result with a take limit so it cannot grow unbounded', async () => {
      mockPrisma.chatConversation.findMany.mockResolvedValue([]);
      await service.getAllConversations('gym-001');

      const args = mockPrisma.chatConversation.findMany.mock.calls[0][0];
      expect(args.where).toEqual({ gymId: 'gym-001', type: 'GYM' });
      expect(args.take).toBe(200);
    });
  });

  describe('getAllSupportConversations', () => {
    it('caps the platform-wide support list with a take limit', async () => {
      mockPrisma.chatConversation.findMany.mockResolvedValue([]);
      await service.getAllSupportConversations();

      const args = mockPrisma.chatConversation.findMany.mock.calls[0][0];
      expect(args.where).toEqual({ type: 'SUPPORT' });
      expect(args.take).toBe(200);
    });
  });
});
