export type UserRole = 'SUPER_ADMIN' | 'GYM_ADMIN' | 'STAFF' | 'TRAINER' | 'MEMBER';

export interface AuthUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  gymId?: string | null;
  avatar?: string | null;
  phone?: string | null;
  qrCode?: string | null;
  memberCode?: string | null;
}

export interface Tokens {
  accessToken: string;
  refreshToken: string;
}

export interface MemberSubscription {
  id: string;
  status: string;
  startDate: string;
  endDate: string;
  plan: {
    name: string;
    type: string;
    durationMonths: number;
  };
}

export interface MobileHomeData {
  user: AuthUser & { gym?: { id: string; name: string; logo?: string } };
  membership: MemberSubscription | null;
  memberCode: string | null;
  qrToken: string | null;
  activeWorkout: { id: string; name: string; goal?: string; difficulty?: string } | null;
  activeDiet: { id: string; name: string } | null;
  isCheckedInToday: boolean;
  checkedInAt: string | null;
}

export interface TrainerHomeData {
  assignedMembersCount: number;
  sessionsToday: number;
  nextSession: {
    id: string;
    memberName: string;
    scheduledAt: string;
    durationMinutes: number;
  } | null;
  isCheckedInToday: boolean;
  checkedInAt: string | null;
  unreadNotifications: number;
}

export interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  isRead: boolean;
  createdAt: string;
}

export interface ChatMessage {
  id: string;
  content: string;
  senderId: string;
  senderName: string;
  attachmentUrl?: string;
  attachmentType?: string;
  reactions: { emoji: string; userId: string }[];
  isDeleted: boolean;
  createdAt: string;
}
