import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const sanitizeHtml: (html: string, opts?: any) => string = require('sanitize-html');

const MAX_MESSAGE_LENGTH = 4000;
const ALLOWED_EMOJI_REGEX = /^\p{Emoji}$/u;

const GYM_INCLUDE = {
  user: { select: { id: true, firstName: true, lastName: true, role: true, avatar: true } },
};

const MSG_INCLUDE = {
  sender: { select: { id: true, firstName: true, lastName: true, role: true, avatar: true } },
};

@Injectable()
export class ChatService {
  constructor(private prisma: PrismaService) {}

  // ─── GYM conversations (member/trainer/staff ↔ gym admin) ────────────────

  async getOrCreateConversation(gymId: string, userId: string) {
    // Verify the user actually belongs to this gym before creating a conversation
    const user = await this.prisma.user.findFirst({ where: { id: userId, gymId } });
    if (!user) throw new BadRequestException('User does not belong to this gym');

    let conv = await this.prisma.chatConversation.findUnique({
      where: { gymId_userId_type: { gymId, userId, type: 'GYM' } },
      include: GYM_INCLUDE,
    });
    if (!conv) {
      conv = await this.prisma.chatConversation.create({
        data: { gymId, userId, type: 'GYM' },
        include: GYM_INCLUDE,
      });
    }
    return conv;
  }

  async getAllConversations(gymId: string) {
    return this.prisma.chatConversation.findMany({
      where: { gymId, type: 'GYM' },
      include: GYM_INCLUDE,
      orderBy: { lastMessageAt: 'desc' },
    });
  }

  async getMessages(gymId: string, userId: string, take = 50, skip = 0) {
    const conv = await this.prisma.chatConversation.findUnique({
      where: { gymId_userId_type: { gymId, userId, type: 'GYM' } },
    });
    if (!conv) return [];
    return this.prisma.chatMessage.findMany({
      where: { conversationId: conv.id, isDeleted: false },
      include: MSG_INCLUDE,
      orderBy: { createdAt: 'asc' },
      skip,
      take,
    });
  }

  async saveMessage(
    gymId: string,
    userId: string,
    senderId: string,
    content: string,
    attachment?: { url: string; name: string; type: string },
  ) {
    const safeContent = sanitizeHtml(content ?? '', { allowedTags: [], allowedAttributes: {} }).slice(0, MAX_MESSAGE_LENGTH);

    const conv = await this.getOrCreateConversation(gymId, userId);
    const msg = await this.prisma.chatMessage.create({
      data: {
        conversationId: conv.id,
        senderId,
        content: safeContent,
        ...(attachment && {
          attachmentUrl: attachment.url,
          attachmentName: attachment.name,
          attachmentType: attachment.type,
        }),
      },
      include: MSG_INCLUDE,
    });
    const isAdmin = msg.sender.role === 'GYM_ADMIN';
    const preview = attachment ? `📎 ${attachment.name}` : content;
    await this.prisma.chatConversation.update({
      where: { id: conv.id },
      data: {
        lastMessage: preview,
        lastMessageAt: new Date(),
        unreadAdmin: isAdmin ? 0 : { increment: 1 },
        unreadUser: isAdmin ? { increment: 1 } : 0,
      },
    });
    return msg;
  }

  async markRead(gymId: string, userId: string, readerIsAdmin: boolean) {
    const conv = await this.prisma.chatConversation.findUnique({
      where: { gymId_userId_type: { gymId, userId, type: 'GYM' } },
    });
    if (!conv) return;
    await this.prisma.chatConversation.update({
      where: { id: conv.id },
      data: readerIsAdmin ? { unreadAdmin: 0 } : { unreadUser: 0 },
    });
    await this.prisma.chatMessage.updateMany({
      where: { conversationId: conv.id, isRead: false },
      data: { isRead: true },
    });
  }

  // ─── SUPPORT conversations (gym admin ↔ super admin) ─────────────────────

  async getOrCreateSupportConversation(gymId: string, gymAdminId: string) {
    let conv = await this.prisma.chatConversation.findUnique({
      where: { gymId_userId_type: { gymId, userId: gymAdminId, type: 'SUPPORT' } },
      include: {
        ...GYM_INCLUDE,
        gym: { select: { id: true, name: true, logo: true } },
      },
    });
    if (!conv) {
      conv = await this.prisma.chatConversation.create({
        data: { gymId, userId: gymAdminId, type: 'SUPPORT' },
        include: {
          ...GYM_INCLUDE,
          gym: { select: { id: true, name: true, logo: true } },
        },
      });
    }
    return conv;
  }

  async getAllSupportConversations() {
    return this.prisma.chatConversation.findMany({
      where: { type: 'SUPPORT' },
      include: {
        ...GYM_INCLUDE,
        gym: { select: { id: true, name: true, logo: true } },
      },
      orderBy: { lastMessageAt: 'desc' },
    });
  }

  async getSupportMessages(gymId: string, gymAdminId: string, take = 50, skip = 0) {
    const conv = await this.prisma.chatConversation.findUnique({
      where: { gymId_userId_type: { gymId, userId: gymAdminId, type: 'SUPPORT' } },
    });
    if (!conv) return [];
    return this.prisma.chatMessage.findMany({
      where: { conversationId: conv.id, isDeleted: false },
      include: MSG_INCLUDE,
      orderBy: { createdAt: 'asc' },
      skip,
      take,
    });
  }

  async saveSupportMessage(
    gymId: string,
    gymAdminId: string,
    senderId: string,
    content: string,
    attachment?: { url: string; name: string; type: string },
  ) {
    const safeContent = sanitizeHtml(content ?? '', { allowedTags: [], allowedAttributes: {} }).slice(0, MAX_MESSAGE_LENGTH);

    const conv = await this.getOrCreateSupportConversation(gymId, gymAdminId);
    const msg = await this.prisma.chatMessage.create({
      data: {
        conversationId: conv.id,
        senderId,
        content: safeContent,
        ...(attachment && {
          attachmentUrl: attachment.url,
          attachmentName: attachment.name,
          attachmentType: attachment.type,
        }),
      },
      include: MSG_INCLUDE,
    });
    // unreadAdmin = unread for SuperAdmin, unreadUser = unread for GymAdmin
    const isSuperAdmin = msg.sender.role === 'SUPER_ADMIN';
    const preview = attachment ? `📎 ${attachment.name}` : content;
    await this.prisma.chatConversation.update({
      where: { id: conv.id },
      data: {
        lastMessage: preview,
        lastMessageAt: new Date(),
        unreadAdmin: isSuperAdmin ? 0 : { increment: 1 },
        unreadUser: isSuperAdmin ? { increment: 1 } : 0,
      },
    });
    return msg;
  }

  async markSupportRead(gymId: string, gymAdminId: string, readerIsSuperAdmin: boolean) {
    const conv = await this.prisma.chatConversation.findUnique({
      where: { gymId_userId_type: { gymId, userId: gymAdminId, type: 'SUPPORT' } },
    });
    if (!conv) return;
    await this.prisma.chatConversation.update({
      where: { id: conv.id },
      data: readerIsSuperAdmin ? { unreadAdmin: 0 } : { unreadUser: 0 },
    });
    await this.prisma.chatMessage.updateMany({
      where: { conversationId: conv.id, isRead: false },
      data: { isRead: true },
    });
  }

  // ─── Shared (delete & react work on any conversation) ────────────────────

  async deleteMessage(messageId: string, requesterId: string) {
    const message = await this.prisma.chatMessage.findUnique({
      where: { id: messageId },
      include: { conversation: true },
    });
    if (!message) return null;
    if (message.senderId !== requesterId) return null;

    await this.prisma.chatMessage.update({
      where: { id: messageId },
      data: { isDeleted: true, content: '' },
    });

    return {
      messageId,
      conversationUserId: message.conversation.userId,
      gymId: message.conversation.gymId,
      conversationType: message.conversation.type,
    };
  }

  async addReaction(messageId: string, userId: string, userName: string, emoji: string) {
    if (!ALLOWED_EMOJI_REGEX.test(emoji)) return null; // reject non-emoji strings

    const message = await this.prisma.chatMessage.findUnique({
      where: { id: messageId },
      include: { conversation: true },
    });
    if (!message) return null;

    const reactions = (Array.isArray(message.reactions) ? message.reactions : []) as any[];
    const existingIdx = reactions.findIndex((r: any) => r.userId === userId && r.emoji === emoji);

    if (existingIdx >= 0) {
      reactions.splice(existingIdx, 1);
    } else {
      reactions.push({ emoji, userId, userName });
    }

    await this.prisma.chatMessage.update({ where: { id: messageId }, data: { reactions } });
    return {
      messageId,
      reactions,
      conversationUserId: message.conversation.userId,
      gymId: message.conversation.gymId,
      conversationType: message.conversation.type,
    };
  }
}
