'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/store/authStore';
import { useSubscription } from '@/hooks/useSubscription';
import { chatApi } from '@/lib/api';
import { getSocket } from '@/lib/socket';
import { UpgradeModal } from '@/components/shared/UpgradeModal';
import { useState, useEffect } from 'react';
import {
  LayoutDashboard, Users, Building2, CreditCard, Dumbbell, Calendar,
  QrCode, UserCheck, Package, ShoppingBag, BarChart3, Bell, FileText,
  Settings, LogOut, Zap, Star, TrendingUp, Utensils, Activity, X,
  ChevronRight, Award, ShieldCheck, Receipt, Crown, Lock, CalendarOff,
  ClipboardList, MessageSquare,
} from 'lucide-react';
import toast from 'react-hot-toast';

interface NavItem {
  label: string;
  href: string;
  icon: React.ElementType;
  badge?: string;
  color?: string;
  pro?: boolean;
}

const superAdminNav: NavItem[] = [
  { label: 'Overview',      href: '/super-admin',                  icon: LayoutDashboard, color: 'text-orange-500' },
  { label: 'Gyms',          href: '/super-admin/gyms',             icon: Building2,       color: 'text-blue-500' },
  { label: 'Admins',        href: '/super-admin/admins',           icon: UserCheck,       color: 'text-purple-500' },
  { label: 'Subscriptions', href: '/super-admin/subscriptions',    icon: CreditCard,      color: 'text-green-500' },
  { label: 'Analytics',     href: '/super-admin/analytics',        icon: BarChart3,       color: 'text-rose-500' },
  { label: 'Support Chat',  href: '/super-admin/chat',             icon: MessageSquare,   color: 'text-violet-500' },
];

const adminNav: NavItem[] = [
  { label: 'Dashboard',   href: '/admin',               icon: LayoutDashboard, color: 'text-orange-500' },
  { label: 'Settings',    href: '/settings',            icon: Settings,        color: 'text-gray-500' },
  { label: 'People',       href: '/admin/members',       icon: Users,           color: 'text-blue-500' },
  { label: 'Attendance',  href: '/admin/attendance',    icon: ClipboardList,   color: 'text-green-500' },
  { label: 'PT Sessions', href: '/admin/pt-sessions',   icon: Calendar,        color: 'text-sky-500',    pro: true },
  { label: 'Payments',    href: '/admin/payments',      icon: TrendingUp,      color: 'text-emerald-500', pro: true },
  { label: 'Expenses',    href: '/admin/expenses',      icon: Receipt,         color: 'text-amber-500',  pro: true },
  { label: 'Supplements', href: '/admin/supplements',   icon: Package,         color: 'text-lime-500',   pro: true },
  { label: 'Diet Packages', href: '/admin/diet',        icon: Utensils,        color: 'text-teal-500',   pro: true },
  { label: 'Workout Packages', href: '/admin/workouts', icon: Dumbbell,        color: 'text-purple-500', pro: true },
  { label: 'Reports',     href: '/admin/reports',       icon: BarChart3,       color: 'text-sky-500',    pro: true },
  { label: 'Notifications', href: '/admin/notifications', icon: Bell,           color: 'text-indigo-500', pro: true },
  { label: 'Leave Requests', href: '/admin/leaves',      icon: CalendarOff,    color: 'text-rose-500',   pro: true },
  { label: 'Chat',           href: '/admin/chat',         icon: MessageSquare,  color: 'text-cyan-500' },
];

const staffNav: NavItem[] = [
  { label: 'Dashboard',    href: '/staff',            icon: LayoutDashboard, color: 'text-orange-500' },
  { label: 'My Attendance', href: '/staff/check-in',  icon: Activity,        color: 'text-green-500' },
  { label: 'Leave',        href: '/staff/leave',      icon: CalendarOff,     color: 'text-rose-500' },
  { label: 'Chat',         href: '/staff/chat',       icon: MessageSquare,   color: 'text-cyan-500' },
  { label: 'Settings',     href: '/settings',         icon: Settings,        color: 'text-gray-500' },
];

const trainerNav: NavItem[] = [
  { label: 'Dashboard',    href: '/trainer',              icon: LayoutDashboard, color: 'text-orange-500' },
  { label: 'My Members',   href: '/trainer/members',      icon: Users,           color: 'text-blue-500' },
  { label: 'My Attendance', href: '/trainer/attendance',  icon: Activity,        color: 'text-green-500' },
  { label: 'PT Sessions',  href: '/trainer/sessions',     icon: Calendar,        color: 'text-purple-500' },
  { label: 'Leave',        href: '/trainer/leave',        icon: CalendarOff,     color: 'text-rose-500' },
  { label: 'Chat',         href: '/trainer/chat',         icon: MessageSquare,   color: 'text-cyan-500' },
  { label: 'Settings',     href: '/settings',             icon: Settings,        color: 'text-gray-500' },
];

const userNav: NavItem[] = [
  { label: 'Home',       href: '/user',              icon: LayoutDashboard, color: 'text-orange-500' },
  { label: 'Membership', href: '/user/membership',   icon: Star,            color: 'text-yellow-500' },
  { label: 'Attendance', href: '/user/attendance',   icon: Activity,        color: 'text-green-500' },
  { label: 'Workouts',   href: '/user/workouts',     icon: Dumbbell,        color: 'text-purple-500' },
  { label: 'Diet Plans', href: '/user/diet',         icon: Utensils,        color: 'text-teal-500' },
  { label: 'My Trainer', href: '/user/trainer',      icon: Award,           color: 'text-blue-500' },
  { label: 'Payments',   href: '/user/payments',     icon: CreditCard,      color: 'text-emerald-500' },
  { label: 'Supplements', href: '/user/supplements', icon: ShoppingBag,     color: 'text-rose-500' },
  { label: 'Progress',   href: '/user/progress',     icon: TrendingUp,      color: 'text-amber-500' },
  { label: 'Chat',       href: '/user/chat',          icon: MessageSquare,   color: 'text-cyan-500' },
  { label: 'Profile',    href: '/user/profile',      icon: Settings,        color: 'text-sky-500' },
  { label: 'Settings',  href: '/settings',          icon: Settings,        color: 'text-gray-500' },
];

const roleConfig = {
  SUPER_ADMIN: { label: 'Super Admin', badge: 'PLATFORM', badgeColor: 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-400', icon: ShieldCheck },
  GYM_ADMIN: { label: 'Gym Admin', badge: 'ADMIN', badgeColor: 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-400', icon: UserCheck },
  STAFF: { label: 'Staff', badge: 'STAFF', badgeColor: 'bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-400', icon: UserCheck },
  TRAINER: { label: 'Trainer', badge: 'TRAINER', badgeColor: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-400', icon: Dumbbell },
  MEMBER: { label: 'Member', badge: 'MEMBER', badgeColor: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400', icon: Users },
};

// Maps nav item text-color → light background for active icon
const colorBgMap: Record<string, string> = {
  'text-orange-500':  'bg-orange-100 dark:bg-orange-900/30',
  'text-blue-500':    'bg-blue-100 dark:bg-blue-900/30',
  'text-purple-500':  'bg-purple-100 dark:bg-purple-900/30',
  'text-green-500':   'bg-green-100 dark:bg-green-900/30',
  'text-teal-500':    'bg-teal-100 dark:bg-teal-900/30',
  'text-sky-500':     'bg-sky-100 dark:bg-sky-900/30',
  'text-emerald-500': 'bg-emerald-100 dark:bg-emerald-900/30',
  'text-amber-500':   'bg-amber-100 dark:bg-amber-900/30',
  'text-lime-500':    'bg-lime-100 dark:bg-lime-900/30',
  'text-rose-500':    'bg-rose-100 dark:bg-rose-900/30',
  'text-indigo-500':  'bg-indigo-100 dark:bg-indigo-900/30',
  'text-cyan-500':    'bg-cyan-100 dark:bg-cyan-900/30',
  'text-gray-500':    'bg-gray-100 dark:bg-gray-800/50',
};

interface SidebarProps { isOpen?: boolean; onClose?: () => void; }

export function Sidebar({ isOpen = true, onClose }: SidebarProps) {
  const pathname = usePathname();
  const { user, logout } = useAuthStore();
  const router = useRouter();
  const { info: subInfo } = useSubscription();
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const [upgradeFeat, setUpgradeFeat] = useState<string>();

  const isFreePlan = user?.role === 'GYM_ADMIN' && (subInfo?.isFreePlan ?? false);

  const [chatUnread, setChatUnread] = useState(0);

  // Fetch once on mount + stay live via socket — not on every navigation, which
  // was firing a full getAllConversations() round trip on every route change
  // just to recompute a badge count.
  useEffect(() => {
    if (user?.role !== 'GYM_ADMIN') return;

    chatApi.getAllConversations()
      .then((res: any) => {
        const convs = Array.isArray(res) ? res : Array.isArray(res?.data) ? res.data : [];
        setChatUnread(convs.reduce((s: number, c: any) => s + (c.unreadAdmin || 0), 0));
      })
      .catch(() => {});

    const socket = getSocket();
    const handleMsg = (msg: any) => {
      if (msg.sender?.role !== 'GYM_ADMIN') {
        setChatUnread((n) => n + 1);
      }
    };
    socket.on('chat:message', handleMsg);
    return () => { socket.off('chat:message', handleMsg); };
  }, [user?.role]);

  useEffect(() => {
    if (pathname === '/admin/chat') setChatUnread(0);
  }, [pathname]);

  const navItems =
    user?.role === 'SUPER_ADMIN' ? superAdminNav :
    user?.role === 'GYM_ADMIN'   ? adminNav :
    user?.role === 'STAFF'       ? staffNav :
    user?.role === 'TRAINER'     ? trainerNav :
    userNav;
  const role = roleConfig[user?.role ?? 'MEMBER'] ?? roleConfig['MEMBER'];

  const handleLogout = () => {
    logout();
    toast.success('Signed out successfully');
    router.push('/login');
  };

  const initials = `${user?.firstName?.[0] ?? ''}${user?.lastName?.[0] ?? ''}`.toUpperCase();

  const handleProClick = (label: string) => {
    setUpgradeFeat(label);
    setUpgradeOpen(true);
  };

  return (
    <>
      {isOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40 lg:hidden" onClick={onClose} />
      )}

      <aside className={cn(
        'fixed top-0 left-0 h-full z-50 flex flex-col transition-transform duration-300 ease-in-out',
        'w-[var(--sidebar-width)]',
        'bg-card/95 backdrop-blur-xl border-r border-border/60',
        'lg:translate-x-0 lg:z-auto',
        isOpen ? 'translate-x-0 shadow-lifted' : '-translate-x-full',
      )}>

        {/* Logo */}
        <div className="flex items-center justify-between px-5 h-[var(--header-height)] border-b border-border/60 shrink-0">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="w-9 h-9 gradient-brand rounded-xl flex items-center justify-center logo-pulse">
                <Zap className="w-5 h-5 text-white" />
              </div>
              <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-500 rounded-full border-2 border-card" />
            </div>
            <div>
              <span className="font-extrabold text-base tracking-tight">ActiveFit</span>
              <div className={cn('inline-flex items-center text-[10px] font-bold px-1.5 py-0.5 rounded-md ml-1', role.badgeColor)}>
                {role.badge}
              </div>
            </div>
          </div>
          <button onClick={onClose} aria-label="Close sidebar" className="lg:hidden p-1.5 hover:bg-muted rounded-lg text-muted-foreground">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* User quick info */}
        <div className="px-4 py-3 border-b border-border/40">
          <div className="sidebar-user-card">
            <div className="w-9 h-9 rounded-xl shrink-0 shadow-sm overflow-hidden">
              {user?.avatar ? (
                <img src={user.avatar} alt={`${user.firstName} ${user.lastName}`} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full gradient-brand flex items-center justify-center text-white text-xs font-bold">
                  {initials}
                </div>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold truncate leading-tight">{user?.firstName} {user?.lastName}</p>
              <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
            </div>
          </div>
        </div>

        {/* Free plan banner */}
        {isFreePlan && (
          <button
            onClick={() => { setUpgradeFeat(undefined); setUpgradeOpen(true); }}
            className="mx-3 mt-3 flex items-center gap-2 px-3 py-2 rounded-xl bg-gradient-to-r from-purple-50 to-orange-50 dark:from-purple-950/30 dark:to-orange-950/30 border border-purple-200 dark:border-purple-800/40 hover:opacity-90 transition-all"
          >
            <Crown className="w-4 h-4 text-purple-500 shrink-0" />
            <div className="flex-1 text-left min-w-0">
              <p className="text-xs font-bold text-foreground">Free Plan</p>
              <p className="text-[10px] text-muted-foreground">Upgrade for full access</p>
            </div>
            <Zap className="w-3.5 h-3.5 text-orange-500 shrink-0" />
          </button>
        )}

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto scrollbar-hide px-3 py-3">
          <div className="space-y-0.5 nav-stagger">
            {navItems.map((item) => {
              const peopleHrefs = ['/admin/members', '/admin/trainers', '/admin/staffs'];
              const isActive = pathname === item.href || (item.href === '/admin/members' && peopleHrefs.includes(pathname));
              const isLocked = isFreePlan && item.pro;

              if (isLocked) {
                return (
                  <button
                    key={item.href}
                    onClick={() => handleProClick(item.label)}
                    className="w-full group flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 text-muted-foreground/50 hover:text-muted-foreground hover:bg-muted/40 animate-slide-up"
                  >
                    <div className={cn('w-7 h-7 rounded-lg flex items-center justify-center shrink-0 bg-muted/60 opacity-40', item.color)}>
                      <item.icon className="w-3.5 h-3.5" />
                    </div>
                    <span className="flex-1 text-left">{item.label}</span>
                    <Lock aria-hidden="true" className="w-3 h-3 text-purple-400 opacity-70" />
                  </button>
                );
              }

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={onClose}
                  className={cn(
                    'group flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 animate-slide-up',
                    isActive
                      ? 'nav-item-active bg-gradient-to-r from-primary/[0.13] via-primary/[0.06] to-transparent text-primary font-semibold'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted/60',
                  )}
                >
                  <div className={cn(
                    'w-7 h-7 rounded-lg flex items-center justify-center shrink-0 transition-all duration-200',
                    isActive
                      ? cn(colorBgMap[item.color ?? ''] ?? 'bg-primary/10', item.color, 'shadow-sm')
                      : cn('bg-muted group-hover:bg-background/80', item.color),
                  )}>
                    <item.icon className={cn('w-3.5 h-3.5 transition-transform duration-200', isActive && 'scale-110')} />
                  </div>
                  <span className="flex-1">{item.label}</span>
                  {isActive && <ChevronRight className="w-3 h-3 opacity-50 -translate-x-0.5" />}
                  {item.badge && (
                    <span className="text-[10px] font-bold bg-destructive text-white px-1.5 py-0.5 rounded-full animate-badge-pop">
                      {item.badge}
                    </span>
                  )}
                  {item.label === 'Chat' && chatUnread > 0 && !isActive && (
                    <span className="text-[10px] font-bold bg-red-500 text-white min-w-[18px] h-[18px] px-1 rounded-full flex items-center justify-center shrink-0 shadow-sm animate-badge-pop">
                      {chatUnread > 9 ? '9+' : chatUnread}
                    </span>
                  )}
                </Link>
              );
            })}
          </div>
        </nav>

        {/* Footer */}
        <div className="px-3 py-3 border-t border-border/40 shrink-0 space-y-1">
          <button
            onClick={handleLogout}
            aria-label="Sign out"
            className="w-full flex items-center gap-3 px-3 py-2.5 text-sm font-medium text-muted-foreground hover:text-destructive hover:bg-destructive/8 rounded-xl transition-all group"
          >
            <div className="w-7 h-7 rounded-lg bg-muted group-hover:bg-destructive/10 flex items-center justify-center shrink-0 transition-all">
              <LogOut className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
            </div>
            Sign Out
          </button>
        </div>
      </aside>

      <UpgradeModal open={upgradeOpen} onClose={() => setUpgradeOpen(false)} featureName={upgradeFeat} />
    </>
  );
}
