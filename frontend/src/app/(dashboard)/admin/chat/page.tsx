'use client';

import { useEffect, useState, useCallback } from 'react';
import { MessageSquare, Search, Users, MoreHorizontal, X, ShieldCheck } from 'lucide-react';
import { chatApi } from '@/lib/api';
import { getSocket } from '@/lib/socket';
import { useAuthStore } from '@/store/authStore';
import { ChatWindow, Message } from '@/components/chat/ChatWindow';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';
import toast from 'react-hot-toast';

interface Conversation {
  id: string;
  userId: string;
  lastMessage?: string;
  lastMessageAt: string;
  unreadAdmin: number;
  user: { id: string; firstName: string; lastName: string; role: string; avatar?: string };
}

interface SupportConversation {
  id: string;
  lastMessage?: string;
  lastMessageAt: string;
  unreadUser: number; // unread for GymAdmin in support conv
}

function ConvAvatar({ name, avatar }: { name: string; avatar?: string }) {
  const initials = name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase();
  if (avatar) return <img src={avatar} alt={name} className="w-10 h-10 rounded-full object-cover shrink-0" />;
  return (
    <div className="w-10 h-10 rounded-full gradient-brand flex items-center justify-center text-white text-sm font-bold shrink-0">
      {initials}
    </div>
  );
}

function roleBadge(role: string) {
  const map: Record<string, string> = {
    MEMBER: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400',
    TRAINER: 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-400',
    STAFF: 'bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-400',
  };
  return map[role] ?? 'bg-muted text-muted-foreground';
}

type ChatTab = 'gym' | 'support';

export default function AdminChatPage() {
  const { user } = useAuthStore();

  // ── GYM tab state ──────────────────────────────────────────────────────────
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loadingMsgs, setLoadingMsgs] = useState(false);
  const [typingUser, setTypingUser] = useState<string | null>(null);

  // ── SUPPORT tab state ──────────────────────────────────────────────────────
  const [supportConv, setSupportConv] = useState<SupportConversation | null>(null);
  const [supportMessages, setSupportMessages] = useState<Message[]>([]);
  const [supportLoading, setSupportLoading] = useState(false);
  const [supportTyping, setSupportTyping] = useState(false);

  // ── Shared UI state ────────────────────────────────────────────────────────
  const [tab, setTab] = useState<ChatTab>('gym');
  const [convSearch, setConvSearch] = useState('');
  const [showMsgSearch, setShowMsgSearch] = useState(false);
  const [msgSearchQuery, setMsgSearchQuery] = useState('');

  const selectedConv = conversations.find((c) => c.userId === selectedUserId);

  // ── Load gym conversations ─────────────────────────────────────────────────
  useEffect(() => {
    chatApi.getAllConversations()
      .then((res: any) => setConversations(Array.isArray(res) ? res : Array.isArray(res?.data) ? res.data : []))
      .catch(() => {});
  }, []);

  // ── Load support conversation ──────────────────────────────────────────────
  useEffect(() => {
    chatApi.getSupportConversation()
      .then((res: any) => setSupportConv(res?.data ?? res))
      .catch(() => {});
  }, []);

  // ── Load messages when a gym conversation is selected ─────────────────────
  useEffect(() => {
    if (!selectedUserId) return;
    setLoadingMsgs(true);
    setShowMsgSearch(false);
    setMsgSearchQuery('');
    chatApi.getConversationMessages(selectedUserId)
      .then((res: any) => setMessages(Array.isArray(res) ? res : Array.isArray(res?.data) ? res.data : []))
      .catch(() => {})
      .finally(() => setLoadingMsgs(false));
    chatApi.markConversationRead(selectedUserId).catch(() => {});
    setConversations((prev) => prev.map((c) => c.userId === selectedUserId ? { ...c, unreadAdmin: 0 } : c));
  }, [selectedUserId]);

  // ── Load support messages when support tab is opened ──────────────────────
  useEffect(() => {
    if (tab !== 'support') return;
    setSupportLoading(true);
    chatApi.getSupportMessages()
      .then((res: any) => setSupportMessages(Array.isArray(res) ? res : Array.isArray(res?.data) ? res.data : []))
      .catch(() => {})
      .finally(() => setSupportLoading(false));
    chatApi.markSupportRead().catch(() => {});
    setSupportConv((prev) => prev ? { ...prev, unreadUser: 0 } : prev);
  }, [tab]);

  // ── Socket listeners ───────────────────────────────────────────────────────
  useEffect(() => {
    const socket = getSocket();

    // GYM messages
    const handleMessage = (msg: Message) => {
      const isFromAdmin = msg.sender.role === 'GYM_ADMIN';
      const msgConvUserId = isFromAdmin ? selectedUserId : msg.senderId;

      if (msgConvUserId && msgConvUserId === selectedUserId) {
        setMessages((prev) => {
          if (prev.some((m) => m.id === msg.id)) return prev;
          return [...prev, msg];
        });
      }

      setConversations((prev) => {
        const updated = prev.map((c) => {
          const isThisConv = isFromAdmin ? c.userId === selectedUserId : c.userId === msg.senderId;
          if (!isThisConv) return c;
          const preview = msg.attachmentUrl ? `📎 ${msg.attachmentName ?? 'File'}` : msg.content;
          const newUnread = (!isFromAdmin && c.userId !== selectedUserId) ? c.unreadAdmin + 1 : 0;
          return { ...c, lastMessage: preview, lastMessageAt: msg.createdAt, unreadAdmin: newUnread };
        });
        const exists = prev.some((c) => c.userId === msg.senderId);
        if (!exists && !isFromAdmin) {
          chatApi.getAllConversations()
            .then((res: any) => setConversations(Array.isArray(res) ? res : Array.isArray(res?.data) ? res.data : []))
            .catch(() => {});
          return prev;
        }
        return updated.sort((a, b) => new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime());
      });
    };

    // SUPPORT messages
    const handleSupportMessage = (msg: Message) => {
      setSupportMessages((prev) => {
        if (prev.some((m) => m.id === msg.id)) return prev;
        return [...prev, msg];
      });
      setSupportConv((prev) => {
        if (!prev) return prev;
        const preview = msg.attachmentUrl ? `📎 ${msg.attachmentName ?? 'File'}` : msg.content;
        const isMine = msg.sender.id === user?.id;
        return {
          ...prev,
          lastMessage: preview,
          lastMessageAt: msg.createdAt,
          unreadUser: (tab !== 'support' && !isMine) ? prev.unreadUser + 1 : 0,
        };
      });
      // Auto-mark as read when on support tab
      if (tab === 'support') {
        chatApi.markSupportRead().catch(() => {});
      }
    };

    const handleTyping = ({ userId, role }: { userId: string; role: string }) => {
      if (role !== 'GYM_ADMIN' && userId === selectedUserId) {
        setTypingUser(role);
        setTimeout(() => setTypingUser(null), 2000);
      }
    };

    const handleSupportTyping = ({ role }: { role: string }) => {
      if (role === 'SUPER_ADMIN') {
        setSupportTyping(true);
        setTimeout(() => setSupportTyping(false), 2000);
      }
    };

    const handleError = ({ message }: { message: string }) => {
      toast.error(message ?? 'Failed to send message');
    };

    const handleReaction = ({ messageId, reactions }: { messageId: string; reactions: any[] }) => {
      setMessages((prev) => prev.map((m) => m.id === messageId ? { ...m, reactions } : m));
      setSupportMessages((prev) => prev.map((m) => m.id === messageId ? { ...m, reactions } : m));
    };

    const handleDeleted = ({ messageId }: { messageId: string }) => {
      setMessages((prev) => prev.filter((m) => m.id !== messageId));
      setSupportMessages((prev) => prev.filter((m) => m.id !== messageId));
    };

    const handleReconnect = () => {
      if (tab === 'gym' && selectedUserId) {
        chatApi.getConversationMessages(selectedUserId)
          .then((res: any) => setMessages(Array.isArray(res) ? res : Array.isArray(res?.data) ? res.data : []))
          .catch(() => {});
      }
      if (tab === 'support') {
        chatApi.getSupportMessages()
          .then((res: any) => setSupportMessages(Array.isArray(res) ? res : Array.isArray(res?.data) ? res.data : []))
          .catch(() => {});
      }
    };

    socket.on('chat:message', handleMessage);
    socket.on('chat:support-message', handleSupportMessage);
    socket.on('chat:typing', handleTyping);
    socket.on('chat:support-typing', handleSupportTyping);
    socket.on('chat:error', handleError);
    socket.on('chat:reaction', handleReaction);
    socket.on('chat:deleted', handleDeleted);
    socket.io.on('reconnect', handleReconnect);

    return () => {
      socket.off('chat:message', handleMessage);
      socket.off('chat:support-message', handleSupportMessage);
      socket.off('chat:typing', handleTyping);
      socket.off('chat:support-typing', handleSupportTyping);
      socket.off('chat:error', handleError);
      socket.off('chat:reaction', handleReaction);
      socket.off('chat:deleted', handleDeleted);
      socket.io.off('reconnect', handleReconnect);
    };
  }, [selectedUserId, tab, user?.id]);

  // ── Send handlers ──────────────────────────────────────────────────────────
  const handleSend = useCallback((content: string, attachment?: { url: string; name: string; type: string }) => {
    if (!selectedUserId || !user) return;
    const socket = getSocket();
    socket.emit('chat:send', {
      toUserId: selectedUserId,
      content,
      ...attachment && { attachmentUrl: attachment.url, attachmentName: attachment.name, attachmentType: attachment.type },
    });
  }, [selectedUserId, user]);

  const handleSupportSend = useCallback((content: string, attachment?: { url: string; name: string; type: string }) => {
    if (!user) return;
    const socket = getSocket();
    socket.emit('chat:support-send', {
      content,
      ...attachment && { attachmentUrl: attachment.url, attachmentName: attachment.name, attachmentType: attachment.type },
    });
  }, [user]);

  const handleTyping = useCallback(() => {
    if (!selectedUserId) return;
    getSocket().emit('chat:typing', { toUserId: selectedUserId });
  }, [selectedUserId]);

  const handleSupportTypingEmit = useCallback(() => {
    getSocket().emit('chat:support-typing', {});
  }, []);

  const handleReact = useCallback((messageId: string, emoji: string) => {
    getSocket().emit('chat:react', { messageId, emoji });
    const applyReact = (prev: Message[]) => prev.map((m) => {
      if (m.id !== messageId) return m;
      const reactions = [...(m.reactions || [])];
      const idx = reactions.findIndex((r) => r.userId === user?.id && r.emoji === emoji);
      if (idx >= 0) reactions.splice(idx, 1);
      else reactions.push({ emoji, userId: user?.id || '', userName: `${user?.firstName} ${user?.lastName}` });
      return { ...m, reactions };
    });
    setMessages(applyReact);
    setSupportMessages(applyReact);
  }, [user]);

  const handleDelete = useCallback((messageId: string) => {
    getSocket().emit('chat:delete', { messageId });
    setMessages((prev) => prev.filter((m) => m.id !== messageId));
    setSupportMessages((prev) => prev.filter((m) => m.id !== messageId));
  }, []);

  const toggleMsgSearch = () => {
    setShowMsgSearch((v) => {
      if (v) setMsgSearchQuery('');
      return !v;
    });
  };

  const filtered = conversations.filter((c) => {
    const name = `${c.user.firstName} ${c.user.lastName}`.toLowerCase();
    return name.includes(convSearch.toLowerCase());
  });

  const totalGymUnread = conversations.reduce((s, c) => s + c.unreadAdmin, 0);
  const supportUnread = supportConv?.unreadUser ?? 0;

  return (
    <div className="flex h-[calc(100vh-var(--header-height)-2rem)] rounded-2xl border border-border/60 overflow-hidden bg-card shadow-sm">

      {/* ── Left: Sidebar ───────────────────────────────────── */}
      <div className="w-72 shrink-0 flex flex-col border-r border-border/60">
        {/* Header + search */}
        <div className="px-4 pt-4 pb-3 border-b border-border/40">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-primary" />
              <h2 className="font-bold text-base">Messages</h2>
              {(totalGymUnread + supportUnread) > 0 && (
                <span className="text-[10px] font-bold bg-primary text-white px-1.5 py-0.5 rounded-full">
                  {totalGymUnread + supportUnread}
                </span>
              )}
            </div>
            <Users className="w-4 h-4 text-muted-foreground" />
          </div>

          {/* Tab switcher */}
          <div className="flex gap-1 bg-muted/60 p-1 rounded-xl mb-3">
            <button
              onClick={() => setTab('gym')}
              className={cn(
                'flex-1 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1',
                tab === 'gym' ? 'bg-card shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground',
              )}
            >
              Members
              {totalGymUnread > 0 && (
                <span className="text-[9px] font-bold bg-primary text-white px-1 py-0.5 rounded-full leading-none">
                  {totalGymUnread}
                </span>
              )}
            </button>
            <button
              onClick={() => setTab('support')}
              className={cn(
                'flex-1 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1',
                tab === 'support' ? 'bg-card shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground',
              )}
            >
              <ShieldCheck className="w-3 h-3" />
              Support
              {supportUnread > 0 && (
                <span className="text-[9px] font-bold bg-purple-500 text-white px-1 py-0.5 rounded-full leading-none">
                  {supportUnread}
                </span>
              )}
            </button>
          </div>

          {tab === 'gym' && (
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <input
                value={convSearch}
                onChange={(e) => setConvSearch(e.target.value)}
                placeholder="Search…"
                className="w-full h-9 pl-9 pr-3 text-sm bg-muted/60 border border-border/40 rounded-xl outline-none focus:border-primary/40 transition-all"
              />
            </div>
          )}
        </div>

        {/* Conversation list */}
        <div className="flex-1 overflow-y-auto scrollbar-hide">
          {tab === 'support' ? (
            /* Support: single pinned SuperAdmin conversation */
            <button
              onClick={() => {}} // already on support tab — nothing extra needed
              className="w-full flex items-center gap-3 px-4 py-3 text-left bg-purple-500/8 border-b border-border/20 border-l-2 border-l-purple-500"
            >
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-violet-600 flex items-center justify-center text-white shrink-0">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-1 mb-0.5">
                  <span className="text-sm font-semibold truncate">Platform Support</span>
                  {supportConv?.lastMessageAt && (
                    <span className="text-[10px] text-muted-foreground shrink-0">
                      {formatDistanceToNow(new Date(supportConv.lastMessageAt), { addSuffix: false })}
                    </span>
                  )}
                </div>
                <div className="flex items-center justify-between gap-1">
                  <span className="text-xs px-1.5 py-0.5 rounded font-medium bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-400">
                    Super Admin
                  </span>
                  {supportUnread > 0 && (
                    <span className="text-[10px] font-bold bg-purple-500 text-white w-5 h-5 rounded-full flex items-center justify-center shrink-0">
                      {supportUnread > 9 ? '9+' : supportUnread}
                    </span>
                  )}
                </div>
                {supportConv?.lastMessage && (
                  <p className="text-xs text-muted-foreground truncate mt-0.5">{supportConv.lastMessage}</p>
                )}
              </div>
            </button>
          ) : filtered.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground">
              <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-20" />
              <p className="text-sm">No conversations yet</p>
            </div>
          ) : filtered.map((conv) => {
            const name = `${conv.user.firstName} ${conv.user.lastName}`;
            const isActive = conv.userId === selectedUserId;
            return (
              <button
                key={conv.id}
                onClick={() => setSelectedUserId(conv.userId)}
                className={cn(
                  'w-full flex items-center gap-3 px-4 py-3 text-left transition-all border-b border-border/20',
                  isActive ? 'bg-primary/8 border-l-2 border-l-primary' : 'hover:bg-muted/50',
                )}
              >
                <div className="relative shrink-0">
                  <ConvAvatar name={name} avatar={conv.user.avatar} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-1 mb-0.5">
                    <span className="text-sm font-semibold truncate">{name}</span>
                    {conv.lastMessageAt && (
                      <span className="text-[10px] text-muted-foreground shrink-0">
                        {formatDistanceToNow(new Date(conv.lastMessageAt), { addSuffix: false })}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center justify-between gap-1">
                    <span className={cn('text-xs px-1.5 py-0.5 rounded font-medium', roleBadge(conv.user.role))}>
                      {conv.user.role.replace('_', ' ')}
                    </span>
                    {conv.unreadAdmin > 0 && (
                      <span className="text-[10px] font-bold bg-primary text-white w-5 h-5 rounded-full flex items-center justify-center shrink-0">
                        {conv.unreadAdmin > 9 ? '9+' : conv.unreadAdmin}
                      </span>
                    )}
                  </div>
                  {conv.lastMessage && (
                    <p className="text-xs text-muted-foreground truncate mt-0.5">{conv.lastMessage}</p>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Right: Chat area ──────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0">
        {tab === 'support' ? (
          /* ── SUPPORT chat with SuperAdmin ── */
          <>
            <div className="border-b border-border/60 shrink-0">
              <div className="flex items-center gap-3 px-5 py-3 bg-card">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-violet-600 flex items-center justify-center text-white shrink-0">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-sm leading-none">Platform Support</p>
                    <span className="text-[10px] px-1.5 py-0.5 rounded font-medium leading-none bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-400">
                      Super Admin
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">Direct line to the ActiveFit platform team</p>
                </div>
                <div className="flex items-center gap-0.5 shrink-0">
                  <button
                    type="button"
                    title="Search in conversation"
                    onClick={toggleMsgSearch}
                    className={cn(
                      'w-8 h-8 rounded-lg flex items-center justify-center transition-colors',
                      showMsgSearch ? 'text-primary bg-primary/10' : 'text-muted-foreground hover:text-foreground hover:bg-muted/60',
                    )}
                  >
                    <Search className="w-4 h-4" />
                  </button>
                </div>
              </div>
              {showMsgSearch && (
                <div className="px-5 py-2 bg-muted/30 flex items-center gap-2 border-t border-border/40">
                  <Search className="w-4 h-4 text-muted-foreground shrink-0" />
                  <input
                    autoFocus
                    value={msgSearchQuery}
                    onChange={(e) => setMsgSearchQuery(e.target.value)}
                    onKeyDown={(e) => e.key === 'Escape' && toggleMsgSearch()}
                    placeholder="Search messages…"
                    className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground/50"
                  />
                  {msgSearchQuery && (
                    <button onClick={() => setMsgSearchQuery('')} className="shrink-0 text-muted-foreground hover:text-foreground">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                  <button onClick={toggleMsgSearch} className="shrink-0 text-muted-foreground hover:text-foreground ml-1">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
            <ChatWindow
              currentUserId={user?.id ?? ''}
              messages={supportMessages}
              loading={supportLoading}
              onSend={handleSupportSend}
              onReact={handleReact}
              onDelete={handleDelete}
              onTyping={handleSupportTypingEmit}
              typingUser={supportTyping ? 'SUPER_ADMIN' : null}
              placeholder="Message Platform Support…"
              filterQuery={msgSearchQuery || undefined}
            />
          </>
        ) : selectedConv ? (
          /* ── GYM chat with member/trainer/staff ── */
          <>
            <div className="border-b border-border/60 shrink-0">
              <div className="flex items-center gap-3 px-5 py-3 bg-card">
                <div className="relative shrink-0">
                  <ConvAvatar name={`${selectedConv.user.firstName} ${selectedConv.user.lastName}`} avatar={selectedConv.user.avatar} />
                  <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-green-500 border-2 border-card" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-sm leading-none">
                      {selectedConv.user.firstName} {selectedConv.user.lastName}
                    </p>
                    <span className={cn('text-[10px] px-1.5 py-0.5 rounded font-medium leading-none', roleBadge(selectedConv.user.role))}>
                      {selectedConv.user.role.replace('_', ' ')}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-0.5 shrink-0">
                  <button
                    type="button"
                    title="Search in conversation"
                    onClick={toggleMsgSearch}
                    className={cn(
                      'w-8 h-8 rounded-lg flex items-center justify-center transition-colors',
                      showMsgSearch ? 'text-primary bg-primary/10' : 'text-muted-foreground hover:text-foreground hover:bg-muted/60',
                    )}
                  >
                    <Search className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    title="More options"
                    onClick={() => toast('More options coming soon', { icon: '⚙️' })}
                    className="w-8 h-8 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/60 flex items-center justify-center transition-colors"
                  >
                    <MoreHorizontal className="w-4 h-4" />
                  </button>
                </div>
              </div>
              {showMsgSearch && (
                <div className="px-5 py-2 bg-muted/30 flex items-center gap-2 border-t border-border/40">
                  <Search className="w-4 h-4 text-muted-foreground shrink-0" />
                  <input
                    autoFocus
                    value={msgSearchQuery}
                    onChange={(e) => setMsgSearchQuery(e.target.value)}
                    onKeyDown={(e) => e.key === 'Escape' && toggleMsgSearch()}
                    placeholder="Search messages…"
                    className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground/50"
                  />
                  {msgSearchQuery && (
                    <button onClick={() => setMsgSearchQuery('')} className="shrink-0 text-muted-foreground hover:text-foreground">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                  <button onClick={toggleMsgSearch} className="shrink-0 text-muted-foreground hover:text-foreground ml-1">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
            <ChatWindow
              currentUserId={user?.id ?? ''}
              targetUserId={selectedUserId ?? undefined}
              messages={messages}
              loading={loadingMsgs}
              onSend={handleSend}
              onReact={handleReact}
              onDelete={handleDelete}
              onTyping={handleTyping}
              typingUser={typingUser}
              placeholder={`Message ${selectedConv.user.firstName}…`}
              filterQuery={msgSearchQuery || undefined}
            />
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-center px-6 text-muted-foreground">
            <div className="w-16 h-16 rounded-2xl gradient-brand flex items-center justify-center mb-4 opacity-20">
              <MessageSquare className="w-8 h-8 text-white" />
            </div>
            <p className="font-semibold">Select a conversation</p>
            <p className="text-sm mt-1">Choose a member, trainer, or staff from the left panel</p>
          </div>
        )}
      </div>
    </div>
  );
}
