'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Cookies from 'js-cookie';
import { useAuthStore } from '@/store/authStore';

export default function HomePage() {
  const router = useRouter();
  const { user, logout } = useAuthStore();
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const unsub = useAuthStore.persist.onFinishHydration(() => setHydrated(true));
    if (useAuthStore.persist.hasHydrated()) setHydrated(true);
    return unsub;
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    if (!user) {
      // Clear any stale cookie so middleware doesn't redirect back here
      Cookies.remove('ab_token');
      router.replace('/login');
      return;
    }
    switch (user?.role) {
      case 'SUPER_ADMIN': router.replace('/super-admin'); break;
      case 'GYM_ADMIN':   router.replace('/admin');       break;
      case 'STAFF':       router.replace('/staff');       break;
      case 'TRAINER':     router.replace('/trainer');     break;
      case 'MEMBER':      router.replace('/user');        break;
      default:
        logout();
        router.replace('/login');
    }
  }, [hydrated, user, router, logout]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-4">
        <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        <p className="text-muted-foreground">Loading ActiveFit...</p>
      </div>
    </div>
  );
}
