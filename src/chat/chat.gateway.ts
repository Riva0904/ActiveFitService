import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { ChatService } from './chat.service';
import { PrismaService } from '../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import * as cookieParse from 'cookie';

@WebSocketGateway({ cors: { origin: process.env.CORS_ORIGIN || 'http://localhost:3000', credentials: true }, path: '/socket.io' })
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer() server: Server;

  constructor(
    private chatService: ChatService,
    private jwtService: JwtService,
    private prisma: PrismaService,
    private configService: ConfigService,
  ) {}

  async handleConnection(client: Socket) {
    try {
      // Prefer the explicit handshake token (split-domain deployments — the httpOnly
      // cookie is scoped to the Vercel proxy origin and never reaches this socket
      // origin). Fall back to the cookie for same-origin/local-dev setups.
      const cookies = cookieParse.parse(client.handshake.headers.cookie ?? '');
      const token = client.handshake.auth?.token ?? cookies['ab_token'];
      if (!token) { client.disconnect(); return; }
      const payload = this.jwtService.verify(token, { secret: this.configService.get('JWT_SECRET') }) as any;
      const user = await this.prisma.user.findUnique({
        where: { id: payload.sub },
        select: { id: true, gymId: true, role: true, firstName: true, lastName: true },
      });
      if (!user) { client.disconnect(); return; }
      // SUPER_ADMIN has no gymId — allow connection anyway
      if (!user.gymId && user.role !== 'SUPER_ADMIN') { client.disconnect(); return; }
      (client as any).user = user;

      client.join(`user:${user.id}`);
      if (user.role === 'GYM_ADMIN') {
        client.join(`gym-admins:${user.gymId}`);
      }
      if (user.role === 'SUPER_ADMIN') {
        client.join('super-admin');
      }
    } catch {
      client.disconnect();
    }
  }

  handleDisconnect(_client: Socket) {}

  // ─── GYM chat: member/trainer/staff ↔ gym admin ──────────────────────────

  @SubscribeMessage('chat:send')
  async handleSend(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: {
      toUserId?: string;
      content: string;
      attachmentUrl?: string;
      attachmentName?: string;
      attachmentType?: string;
    },
  ) {
    const user = (client as any).user;
    const hasContent = !!payload?.content?.trim();
    const hasAttachment = !!payload?.attachmentUrl;
    if (!user?.gymId || (!hasContent && !hasAttachment)) return;

    const isAdmin = user.role === 'GYM_ADMIN';
    const conversationUserId = isAdmin ? payload.toUserId : user.id;
    if (!conversationUserId) return;

    try {
      const msg = await this.chatService.saveMessage(
        user.gymId,
        conversationUserId,
        user.id,
        payload.content?.trim() ?? '',
        hasAttachment ? { url: payload.attachmentUrl!, name: payload.attachmentName ?? '', type: payload.attachmentType ?? '' } : undefined,
      );
      if (isAdmin) {
        this.server.to(`user:${conversationUserId}`).emit('chat:message', msg);
        this.server.to(`user:${user.id}`).emit('chat:message', msg);
      } else {
        this.server.to(`user:${user.id}`).emit('chat:message', msg);
        this.server.to(`gym-admins:${user.gymId}`).emit('chat:message', msg);
      }
    } catch {
      client.emit('chat:error', { message: 'Failed to send message' });
    }
  }

  // ─── SUPPORT chat: gym admin ↔ super admin ───────────────────────────────

  @SubscribeMessage('chat:support-send')
  async handleSupportSend(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: {
      toGymAdminId?: string; // only used when sender is SUPER_ADMIN
      gymId?: string;        // only used when sender is SUPER_ADMIN
      content: string;
      attachmentUrl?: string;
      attachmentName?: string;
      attachmentType?: string;
    },
  ) {
    const user = (client as any).user;
    const hasContent = !!payload?.content?.trim();
    const hasAttachment = !!payload?.attachmentUrl;
    if (!hasContent && !hasAttachment) return;

    const isSuperAdmin = user.role === 'SUPER_ADMIN';
    const isGymAdmin = user.role === 'GYM_ADMIN';
    if (!isSuperAdmin && !isGymAdmin) return;

    // Resolve gymId and gymAdminId for the conversation
    const gymId = isSuperAdmin ? payload.gymId : user.gymId;
    const gymAdminId = isSuperAdmin ? payload.toGymAdminId : user.id;
    if (!gymId || !gymAdminId) return;

    try {
      const msg = await this.chatService.saveSupportMessage(
        gymId,
        gymAdminId,
        user.id,
        payload.content?.trim() ?? '',
        hasAttachment ? { url: payload.attachmentUrl!, name: payload.attachmentName ?? '', type: payload.attachmentType ?? '' } : undefined,
      );
      // Deliver to gym admin's personal room and all super admin sockets
      this.server.to(`user:${gymAdminId}`).emit('chat:support-message', msg);
      this.server.to('super-admin').emit('chat:support-message', msg);
    } catch {
      client.emit('chat:error', { message: 'Failed to send support message' });
    }
  }

  // ─── Delete ───────────────────────────────────────────────────────────────

  @SubscribeMessage('chat:delete')
  async handleDelete(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { messageId: string },
  ) {
    const user = (client as any).user;
    if (!payload?.messageId) return;

    try {
      const result = await this.chatService.deleteMessage(payload.messageId, user.id);
      if (!result) return;
      const deletedPayload = { messageId: result.messageId };

      if (result.conversationType === 'SUPPORT') {
        this.server.to(`user:${result.conversationUserId}`).emit('chat:deleted', deletedPayload);
        this.server.to('super-admin').emit('chat:deleted', deletedPayload);
      } else {
        this.server.to(`user:${result.conversationUserId}`).emit('chat:deleted', deletedPayload);
        this.server.to(`user:${user.id}`).emit('chat:deleted', deletedPayload);
        this.server.to(`gym-admins:${result.gymId}`).emit('chat:deleted', deletedPayload);
      }
    } catch { /* ignore */ }
  }

  // ─── React ────────────────────────────────────────────────────────────────

  @SubscribeMessage('chat:react')
  async handleReact(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { messageId: string; emoji: string },
  ) {
    const user = (client as any).user;
    if (!payload?.messageId || !payload?.emoji) return;

    try {
      const result = await this.chatService.addReaction(
        payload.messageId, user.id, `${user.firstName} ${user.lastName}`, payload.emoji,
      );
      if (!result) return;
      const update = { messageId: result.messageId, reactions: result.reactions };

      if (result.conversationType === 'SUPPORT') {
        this.server.to(`user:${result.conversationUserId}`).emit('chat:reaction', update);
        this.server.to('super-admin').emit('chat:reaction', update);
      } else {
        this.server.to(`user:${result.conversationUserId}`).emit('chat:reaction', update);
        this.server.to(`user:${user.id}`).emit('chat:reaction', update);
        this.server.to(`gym-admins:${result.gymId}`).emit('chat:reaction', update);
      }
    } catch { /* ignore */ }
  }

  // ─── Typing ───────────────────────────────────────────────────────────────

  @SubscribeMessage('chat:typing')
  handleTyping(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { toUserId?: string },
  ) {
    const user = (client as any).user;
    if (!user?.gymId) return;
    const isAdmin = user.role === 'GYM_ADMIN';
    const target = isAdmin ? `user:${payload?.toUserId}` : `gym-admins:${user.gymId}`;
    client.to(target).emit('chat:typing', { userId: user.id, role: user.role });
  }

  @SubscribeMessage('chat:support-typing')
  handleSupportTyping(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { toGymAdminId?: string },
  ) {
    const user = (client as any).user;
    const isSuperAdmin = user.role === 'SUPER_ADMIN';
    const isGymAdmin = user.role === 'GYM_ADMIN';
    if (!isSuperAdmin && !isGymAdmin) return;

    if (isSuperAdmin && payload?.toGymAdminId) {
      client.to(`user:${payload.toGymAdminId}`).emit('chat:support-typing', { userId: user.id, role: user.role });
    } else if (isGymAdmin) {
      client.to('super-admin').emit('chat:support-typing', { userId: user.id, role: user.role });
    }
  }
}
