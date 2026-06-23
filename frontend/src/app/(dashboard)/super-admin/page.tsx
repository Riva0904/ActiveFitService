'use client';

import { useEffect, useState } from 'react';
import {
  Building2, Users, ArrowRight, CheckCircle, Clock, XCircle,
  Crown, Activity, ShieldCheck, Zap, Lock, TrendingUp, Dumbbell,
  BarChart3, UserCheck,
} from 'lucide-react';
import { StatsCard } from '@/components/shared/StatsCard';
import { gymsApi, usersApi } from '@/lib/api';
import Link from 'next/link';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid } from 'recharts';

const PLAN_COLORS: Record<string, string> = {
  ENTERPRISE: '#8b5cf6',
  PROFESSIONAL: '#f97316',
  STARTER: '#94a3b8',
};

const STATUS_CFG: Record<string, { bg: string; text: string; icon: React.ElementType }> = {
  ACTIVE:    { bg: 'bg-emerald-100 dark:bg-emerald-900/30', text: 'text-emerald-700 dark:text-emerald-400', icon: CheckCircle },
  PENDING:   { bg: 'bg-amber-100 dark:bg-amber-900/30',    text: 'text-amber-700 dark:text-amber-400',    icon: Clock       },
  SUSPENDED: { bg: 'bg-rose-100 dark:bg-rose-900/30',      text: 'text-rose-700 dark:text-rose-400',      icon: XCircle     },
  INACTIVE:  { bg: 'bg-slate-100 dark:bg-slate-800/50',    text: 'text-slate-500 dark:text-slate-400',    icon: XCircle     },
};

const PLAN_BADGE: Record<string, { bg: string; text: string; label: string }> = {
  ENTERPRISE:   { bg: 'bg-purple-100 dark:bg-purple-900/30', text: 'text-purple-700 dark:text-purple-400', label: 'Enterprise' },
  PROFESSIONAL: { bg: 'bg-orange-100 dark:bg-orange-900/30', text: 'text-orange-700 dark:text-orange-400', label: 'Pro' },
  STARTER:      { bg: 'bg-slate-100 dark:bg-slate-800/60',   text: 'text-slate-500 dark:text-slate-400',   label: 'Free' },
};

export default function SuperAdminDashboard() {
  const [gyms, setGyms]         = useState<any[]>([]);
  const [allGyms, setAllGyms]   = useState<any[]>([]);
  const [totalGyms, setTotalGyms]     = useState(0);
  const [totalMembers, setTotalMembers] = useState(0);
  const [activeGyms, setActiveGyms]   = useState(0);
  const [inactiveGyms, setInactiveGyms] = useState(0);
  const [planData, setPlanData] = useState<any[]>([]);
  const [loading, setLoading]   = useState(true);

  useEffect(() => {
    Promise.all([
      gymsApi.getAll({ limit: 6 }),
      gymsApi.getAll({ limit: 1000 }),
      usersApi.getStats(),
    ]).then(([recent, all, memberStats]: any[]) => {
      setGyms(recent.data ?? []);
      const full: any[] = all.data ?? [];
      setAllGyms(full);
      setTotalGyms(all.total ?? 0);
      setActiveGyms(full.filter((g: any) => g.status === 'ACTIVE').length);
      setInactiveGyms(full.filter((g: any) => g.status !== 'ACTIVE').length);
      setTotalMembers(memberStats?.total ?? 0);
      const planCounts: Record<string, number> = {};
      full.forEach((g: any) => {
        const plan = g.subscriptionPlan ?? 'STARTER';
        planCounts[plan] = (planCounts[plan] ?? 0) + 1;
      });
      setPlanData(Object.entries(planCounts).map(([name, value]) => ({
        name: name.charAt(0) + name.slice(1).toLowerCase(),
        rawName: name, value, color: PLAN_COLORS[name] ?? '#94a3b8',
      })));
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const totalTrainers  = allGyms.reduce((s, g) => s + (g._count?.trainers ?? 0), 0);
  const subscribedGyms = allGyms.filter(g => g.status === 'ACTIVE' && g.subscriptionPlan !== 'STARTER').length;

  // Mock growth data (replace with real API if available)
  const growthData = ['Jan','Feb','Mar','Apr','May','Jun'].map((m, i) => ({
    month: m, gyms: Math.max(1, totalGyms - (5 - i) * 2 + Math.floor(Math.random() * 2)),
  }));

  return (
    <div className="space-y-6 animate-slide-up">

      {/* ── Hero ── */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 shadow-2xl">
        <div className="absolute inset-0 opacity-[0.03] bg-grid-24" />
        <div className="absolute -top-16 -right-16 w-96 h-96 rounded-full bg-orange-500/10 blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-12 w-64 h-64 rounded-full bg-purple-500/10 blur-3xl pointer-events-none" />

        <div className="relative z-10 px-8 py-8">
          <div className="flex items-start justify-between flex-wrap gap-6">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/8 border border-white/12 mb-4">
                <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                <span className="text-slate-300 text-xs font-medium">All Systems Operational</span>
              </div>
              <h1 className="text-4xl font-extrabold text-white tracking-tight">
                Platform <span className="bg-gradient-to-r from-orange-400 to-rose-400 bg-clip-text text-transparent">Control</span>
              </h1>
              <p className="text-slate-400 mt-2 max-w-sm">Manage the entire ActiveFit gym network</p>
              <div className="flex gap-3 mt-6 flex-wrap">
                <Link href="/super-admin/gyms" className="flex items-center gap-2 bg-gradient-to-r from-orange-500 to-rose-500 text-white font-bold px-5 py-2.5 rounded-xl text-sm shadow-lg hover:opacity-90 transition-all">
                  <Building2 className="w-4 h-4" /> Manage Gyms
                </Link>
                <Link href="/super-admin/subscriptions" className="flex items-center gap-2 bg-white/10 border border-white/20 text-white font-bold px-5 py-2.5 rounded-xl text-sm hover:bg-white/18 transition-all">
                  <Crown className="w-4 h-4" /> Subscriptions
                </Link>
                <Link href="/super-admin/analytics" className="flex items-center gap-2 bg-white/8 border border-white/12 text-white/80 font-bold px-5 py-2.5 rounded-xl text-sm hover:bg-white/15 transition-all">
                  <BarChart3 className="w-4 h-4" /> Analytics
                </Link>
              </div>
            </div>

            {/* Access policy card */}
            <div className="bg-white/6 border border-white/12 rounded-2xl p-5 min-w-[230px] backdrop-blur-sm">
              <div className="flex items-center gap-2 mb-4">
                <ShieldCheck className="w-4 h-4 text-green-400" />
                <span className="text-white font-bold text-sm">Access Policy</span>
              </div>
              <div className="space-y-3">
                {[
                  { icon: CheckCircle, color: 'text-green-400', text: 'Any gym can self-register' },
                  { icon: Zap, color: 'text-orange-400', text: 'Paid plan → full access' },
                  { icon: Lock, color: 'text-slate-400', text: 'Free plan → limited access' },
                ].map(({ icon: Icon, color, text }) => (
                  <div key={text} className="flex items-start gap-2.5">
                    <Icon className={`w-3.5 h-3.5 mt-0.5 shrink-0 ${color}`} />
                    <span className="text-slate-300 text-xs">{text}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Stats Row ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatsCard title="Total Gyms"   value={totalGyms}    icon={Building2}  gradient="orange" subtitle={`${activeGyms} active`} />
        <StatsCard title="Active Gyms"  value={activeGyms}   icon={CheckCircle} gradient="green"  subtitle="Approved & running" />
        <StatsCard title="Inactive"     value={inactiveGyms} icon={XCircle}    gradient="rose"   subtitle="Pending or suspended" />

        {/* Split Members + Trainers card */}
        <div className="relative overflow-hidden rounded-2xl bg-card border border-border/60 shadow-card hover:shadow-lifted hover:-translate-y-0.5 transition-all group">
          <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 via-blue-500/5 to-transparent opacity-60" />
          <div className="absolute -top-6 -right-6 w-28 h-28 rounded-full bg-white/5" />
          <div className="relative p-5">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-11 h-11 rounded-xl gradient-blue flex items-center justify-center text-white shadow-blue shrink-0">
                <Users className="w-5 h-5" />
              </div>
              <p className="text-sm font-medium text-muted-foreground">Platform People</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-3 text-center">
                <p className="text-2xl font-extrabold text-blue-600 dark:text-blue-400">{loading ? '…' : totalMembers}</p>
                <p className="text-xs text-blue-500/80 font-semibold mt-0.5 flex items-center justify-center gap-1">
                  <Users className="w-3 h-3" /> Members
                </p>
              </div>
              <div className="bg-purple-50 dark:bg-purple-900/20 rounded-xl p-3 text-center">
                <p className="text-2xl font-extrabold text-purple-600 dark:text-purple-400">{loading ? '…' : totalTrainers}</p>
                <p className="text-xs text-purple-500/80 font-semibold mt-0.5 flex items-center justify-center gap-1">
                  <Dumbbell className="w-3 h-3" /> Trainers
                </p>
              </div>
            </div>
          </div>
          <div className="absolute bottom-0 left-0 right-0 h-0.5 opacity-0 group-hover:opacity-100 gradient-blue transition-opacity" />
        </div>
      </div>

      {/* ── Middle: Plan dist + Subscription summary + Gym growth ── */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">

        {/* Plan distribution */}
        <div className="bg-card rounded-2xl border border-border/60 shadow-card p-6 flex flex-col">
          <h3 className="font-bold text-lg mb-1">Subscription Plans</h3>
          <p className="text-sm text-muted-foreground mb-5">Distribution across {totalGyms} gyms</p>

          {planData.length > 0 ? (
            <>
              <div className="flex justify-center mb-2">
                <ResponsiveContainer width={180} height={170}>
                  <PieChart>
                    <Pie data={planData} cx={90} cy={85} innerRadius={50} outerRadius={78} paddingAngle={4} dataKey="value" startAngle={90} endAngle={450}>
                      {planData.map((e, i) => <Cell key={i} fill={e.color} />)}
                    </Pie>
                    <Tooltip contentStyle={{ borderRadius: 10, fontSize: 12 }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="space-y-3">
                {planData.map(({ name, rawName, value, color }) => {
                  const b = PLAN_BADGE[rawName];
                  return (
                    <div key={name} className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <div className="w-2.5 h-2.5 rounded-full shrink-0 chart-dot" style={{ '--dot-color': color } as React.CSSProperties} />
                        <span className="text-sm font-semibold">{name}</span>
                        {b && <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${b.bg} ${b.text}`}>{b.label}</span>}
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-14 h-1.5 bg-muted rounded-full overflow-hidden">
                          <div className="progress-fill chart-dot" style={{ '--dot-color': color, '--progress-width': `${totalGyms ? Math.round(value / totalGyms * 100) : 0}%` } as React.CSSProperties} />
                        </div>
                        <span className="text-sm font-bold w-5 text-right">{value}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="mt-5 pt-4 border-t border-border/40 grid grid-cols-2 gap-3">
                <div className="bg-emerald-50 dark:bg-emerald-900/20 rounded-xl p-3 text-center">
                  <p className="text-xl font-extrabold text-emerald-600 dark:text-emerald-400">{subscribedGyms}</p>
                  <p className="text-xs text-emerald-600/70 font-medium">Subscribed</p>
                </div>
                <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-3 text-center">
                  <p className="text-xl font-extrabold text-slate-500">{totalGyms - subscribedGyms}</p>
                  <p className="text-xs text-slate-400 font-medium">Free / Pending</p>
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">
              {loading ? 'Loading…' : 'No data'}
            </div>
          )}
        </div>

        {/* Gym growth area chart */}
        <div className="xl:col-span-2 bg-card rounded-2xl border border-border/60 shadow-card p-6">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h3 className="font-bold text-lg">Platform Growth</h3>
              <p className="text-sm text-muted-foreground">Gym registrations over time</p>
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/60 px-3 py-1.5 rounded-lg">
              <Activity className="w-3.5 h-3.5" /> 6-month trend
            </div>
          </div>
          <div className="h-[220px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={growthData} margin={{ top: 5, right: 5, bottom: 0, left: -20 }}>
                <defs>
                  <linearGradient id="gymGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#f97316" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#f97316" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                <XAxis dataKey="month" tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid hsl(var(--border))', fontSize: 12 }} />
                <Area type="monotone" dataKey="gyms" stroke="#f97316" strokeWidth={2.5} fill="url(#gymGrad)" dot={{ fill: '#f97316', r: 4, strokeWidth: 0 }} activeDot={{ r: 6 }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Quick metrics below chart */}
          <div className="grid grid-cols-3 gap-3 mt-5 pt-4 border-t border-border/40">
            {[
              { label: 'Active Gyms', value: activeGyms, color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-900/20' },
              { label: 'Total Members', value: totalMembers, color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-50 dark:bg-blue-900/20' },
              { label: 'Subscribed', value: subscribedGyms, color: 'text-purple-600 dark:text-purple-400', bg: 'bg-purple-50 dark:bg-purple-900/20' },
            ].map(({ label, value, color, bg }) => (
              <div key={label} className={`${bg} rounded-xl p-3 text-center`}>
                <p className={`text-xl font-extrabold ${color}`}>{loading ? '…' : value}</p>
                <p className="text-xs text-muted-foreground font-medium mt-0.5">{label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Recent Gyms ── */}
      <div className="bg-card rounded-2xl border border-border/60 shadow-card overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border/50">
          <div>
            <h3 className="font-bold">Recent Gyms</h3>
            <p className="text-xs text-muted-foreground">Latest registrations on the platform</p>
          </div>
          <Link href="/super-admin/gyms" className="flex items-center gap-1.5 text-sm text-primary font-semibold hover:underline">
            View all <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        <div className="divide-y divide-border/40">
          {loading ? (
            Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4 px-6 py-4">
                <div className="w-10 h-10 rounded-xl shimmer-bg shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-3.5 w-40 shimmer-bg rounded" />
                  <div className="h-3 w-28 shimmer-bg rounded" />
                </div>
                <div className="h-7 w-20 shimmer-bg rounded-lg" />
              </div>
            ))
          ) : gyms.length === 0 ? (
            <div className="flex flex-col items-center py-12 text-muted-foreground">
              <Building2 className="w-12 h-12 mb-3 opacity-20" />
              <p className="font-semibold">No gyms yet</p>
            </div>
          ) : gyms.map((gym: any) => {
            const sc = STATUS_CFG[gym.status] ?? STATUS_CFG.INACTIVE;
            const StatusIcon = sc.icon;
            const plan = PLAN_BADGE[gym.subscriptionPlan];
            const isSubscribed = gym.status === 'ACTIVE' && gym.subscriptionPlan !== 'STARTER';
            return (
              <div key={gym.id} className="flex items-center gap-4 px-6 py-4 hover:bg-muted/30 transition-colors">
                <div className="w-10 h-10 bg-gradient-to-br from-orange-500 to-rose-500 rounded-xl flex items-center justify-center text-white font-extrabold text-sm shrink-0 shadow-sm">
                  {gym.name[0]}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold text-sm">{gym.name}</p>
                    {isSubscribed && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-900/30 px-1.5 py-0.5 rounded-full">
                        <Crown className="w-2.5 h-2.5" /> Subscribed
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground truncate">{gym.city}, {gym.state} · {gym._count?.members ?? 0} members</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className={`inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-lg ${sc.bg} ${sc.text}`}>
                    <StatusIcon className="w-3 h-3" /> {gym.status}
                  </span>
                  {plan && (
                    <span className={`text-xs font-bold px-2.5 py-1 rounded-lg ${plan.bg} ${plan.text}`}>{plan.label}</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Quick nav cards ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Gym Network',    icon: Building2,  href: '/super-admin/gyms',          gradient: 'gradient-brand',  glow: 'glow-brand'   },
          { label: 'Gym Admins',     icon: UserCheck,  href: '/super-admin/admins',         gradient: 'gradient-purple', glow: 'glow-purple'  },
          { label: 'Subscriptions',  icon: Crown,      href: '/super-admin/subscriptions',  gradient: 'gradient-green',  glow: 'glow-green'   },
          { label: 'Analytics',      icon: TrendingUp, href: '/super-admin/analytics',      gradient: 'gradient-blue',   glow: 'glow-blue'    },
        ].map(({ label, icon: Icon, href, gradient, glow }) => (
          <Link key={label} href={href}
            className="group relative overflow-hidden rounded-2xl bg-card border border-border/60 p-5 hover:shadow-lifted hover:-translate-y-1 transition-all duration-300">
            <div className={`w-11 h-11 ${gradient} rounded-xl flex items-center justify-center text-white mb-4 shadow-sm group-hover:scale-110 transition-transform`}>
              <Icon className="w-5 h-5" />
            </div>
            <p className="text-sm font-bold">{label}</p>
            <ArrowRight className="w-4 h-4 text-muted-foreground absolute bottom-5 right-5 group-hover:text-primary group-hover:translate-x-1 transition-all" />
          </Link>
        ))}
      </div>
    </div>
  );
}
