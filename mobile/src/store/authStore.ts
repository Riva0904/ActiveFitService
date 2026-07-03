import { create } from 'zustand';
import { AuthUser } from '../types';
import { tokenStore } from '../lib/secureStore';
import { disconnectSocket } from '../lib/socket';

interface AuthState {
  user: AuthUser | null;
  isLoading: boolean;
  setAuth: (user: AuthUser, accessToken: string, refreshToken: string) => Promise<void>;
  logout: () => Promise<void>;
  updateUser: (patch: Partial<AuthUser>) => void;
  hydrate: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  isLoading: true,

  setAuth: async (user, accessToken, refreshToken) => {
    await tokenStore.setTokens(accessToken, refreshToken);
    set({ user });
  },

  logout: async () => {
    disconnectSocket();
    const pushToken = await tokenStore.getPushToken();
    if (pushToken) {
      // Best-effort deactivate push token
      try {
        const { api } = await import('../lib/api');
        await api.post('/mobile/push-token/deactivate', { token: pushToken });
      } catch {}
    }
    await tokenStore.clear();
    set({ user: null });
  },

  updateUser: (patch) => {
    const current = get().user;
    if (current) set({ user: { ...current, ...patch } });
  },

  hydrate: async () => {
    const token = await tokenStore.getAccess();
    if (!token) {
      set({ isLoading: false });
      return;
    }
    try {
      const { api } = await import('../lib/api');
      const user = await api.get('/auth/profile') as any;
      set({ user, isLoading: false });
    } catch {
      await tokenStore.clear();
      set({ user: null, isLoading: false });
    }
  },
}));
