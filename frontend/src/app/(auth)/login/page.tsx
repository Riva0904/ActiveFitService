'use client';

import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Eye, EyeOff, Zap, ArrowRight } from 'lucide-react';
import toast from 'react-hot-toast';
import { authApi } from '@/lib/api';
import { useAuthStore } from '@/store/authStore';
import { cn } from '@/lib/utils';

const schema = z.object({
  email:    z.string().email('Enter a valid email'),
  password: z.string().min(1, 'Password is required'),
});
type FormData = z.infer<typeof schema>;

const platformStats = [
  { value: '50K+',  label: 'Active Members'  },
  { value: '500+',  label: 'Gyms Managed'    },
  { value: '₹2Cr+', label: 'Revenue Tracked' },
  { value: '99.9%', label: 'Uptime SLA'      },
];

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { setAuth } = useAuthStore();
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);

  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  const onSubmit = async (data: FormData) => {
    setLoading(true);
    try {
      const res: any = await authApi.login({ email: data.email!, password: data.password! });
      setAuth(res.user);
      toast.success(`Welcome back, ${res.user.firstName}! 🎉`);
      const redirect = searchParams.get('redirect');
      if (redirect && redirect.startsWith('/')) {
        router.push(redirect);
      } else {
        switch (res.user.role) {
          case 'SUPER_ADMIN': router.push('/super-admin'); break;
          case 'GYM_ADMIN':   router.push('/admin');       break;
          case 'STAFF':       router.push('/staff');       break;
          case 'TRAINER':     router.push('/trainer');     break;
          default:            router.push('/user');
        }
      }
    } catch (err: any) {
      const d = err?.response?.data;
      if (d?.message?.code === 'EMAIL_NOT_VERIFIED') {
        toast('Verify your email — OTP resent.', { icon: '📧' });
        router.push(`/verify-email?email=${encodeURIComponent(data.email!)}`);
      } else {
        toast.error(d?.message ?? 'Login failed. Check your credentials.');
      }
    } finally {
      setLoading(false);
    }
  };

  const inputCls = cn(
    'w-full h-[50px] rounded-xl border-2 border-border bg-card px-3.5 text-[15px]',
    'text-foreground outline-none transition-all placeholder:text-muted-foreground/60',
    'focus:border-primary focus:ring-4 focus:ring-primary/10',
  );

  return (
    <div className="min-h-screen flex">

      {/* ── Left hero panel ──────────────────────────────────────────────────── */}
      <div className="hidden lg:flex w-[52%] flex-col justify-between p-12 relative overflow-hidden gradient-brand">
        <div className="absolute -top-20 -right-20 w-80 h-80 rounded-full bg-white/[0.08]" />
        <div className="absolute -bottom-16 -left-16 w-60 h-60 rounded-full bg-black/10" />
        <div className="absolute top-[40%] right-[10%] w-40 h-40 rounded-full bg-white/[0.06]" />
        <div className="auth-hero-grid" />

        {/* Logo */}
        <div className="relative z-10 flex items-center gap-3">
          <div className="w-11 h-11 bg-white/[0.22] rounded-[14px] flex items-center justify-center border border-white/35">
            <Zap className="w-6 h-6 text-white" />
          </div>
          <div>
            <div className="text-white font-extrabold text-[22px] tracking-tight">ActiveFit</div>
            <div className="text-white/60 text-xs">Gym Management Platform</div>
          </div>
        </div>

        {/* Hero copy */}
        <div className="relative z-10">
          <div className="flex items-center gap-2 mb-6">
            <div className="w-2 h-2 rounded-full bg-green-400" />
            <span className="text-white/80 text-sm font-medium">Trusted by 500+ fitness businesses</span>
          </div>
          <h1 className="text-white text-[52px] font-black leading-[1.08] tracking-tight mb-5">
            Run your gym<br />
            <span className="text-white/65">like a </span>
            <span className="underline decoration-white/40 decoration-[3px]">pro</span>
          </h1>
          <p className="text-white/70 text-lg leading-relaxed mb-9 max-w-[400px]">
            All-in-one platform for members, trainers, payments, and analytics.
          </p>
          <div className="grid grid-cols-2 gap-3">
            {platformStats.map(({ value, label }) => (
              <div key={label} className="glass rounded-2xl p-5">
                <div className="text-white font-extrabold text-[26px] tracking-tight">{value}</div>
                <div className="text-white/65 text-xs mt-0.5">{label}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="relative z-10 text-white/35 text-xs">
          © 2025 ActiveFit · Privacy · Terms
        </div>
      </div>

      {/* ── Right login panel ─────────────────────────────────────────────────── */}
      <div className="flex-1 flex items-center justify-center px-6 py-10 bg-secondary/30 relative">
        <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(ellipse_60%_50%_at_70%_10%,rgba(249,115,22,0.06)_0%,transparent_60%)]" />

        <div className="w-full max-w-[420px] relative z-10">

          {/* Mobile logo */}
          <div className="flex items-center gap-3 mb-8 lg:hidden">
            <div className="w-10 h-10 rounded-xl gradient-brand flex items-center justify-center">
              <Zap className="w-5 h-5 text-white" />
            </div>
            <span className="font-extrabold text-xl">ActiveFit</span>
          </div>

          {/* Heading */}
          <div className="mb-8">
            <h2 className="font-extrabold text-[32px] tracking-tight">Welcome back</h2>
            <p className="text-muted-foreground mt-1.5 text-base">Sign in to your dashboard</p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit(onSubmit)} noValidate method="post" action="#">
            <div className="mb-5">
              <label className="block font-semibold text-sm mb-1.5">Email address</label>
              <input {...register('email')} type="email" placeholder="you@example.com" className={inputCls} />
              {errors.email && (
                <p className="text-destructive text-xs mt-1.5 flex items-center gap-1">⚠ {errors.email.message}</p>
              )}
            </div>

            <div className="mb-7">
              <div className="flex justify-between items-center mb-1.5">
                <label className="font-semibold text-sm">Password</label>
                <Link href="/forgot-password" className="text-[13px] text-primary font-medium hover:underline">
                  Forgot password?
                </Link>
              </div>
              <div className="relative">
                <input
                  {...register('password')}
                  type={showPass ? 'text' : 'password'}
                  placeholder="••••••••"
                  className={cn(inputCls, 'pr-12')}
                />
                <button type="button" onClick={() => setShowPass(!showPass)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors">
                  {showPass ? <EyeOff className="w-[18px] h-[18px]" /> : <Eye className="w-[18px] h-[18px]" />}
                </button>
              </div>
              {errors.password && (
                <p className="text-destructive text-xs mt-1.5">⚠ {errors.password.message}</p>
              )}
            </div>

            <button type="submit" disabled={loading}
              className="w-full h-[52px] rounded-[14px] gradient-brand shadow-brand text-white font-bold text-base flex items-center justify-center gap-2 hover:opacity-90 active:scale-[0.98] transition-all disabled:opacity-60 disabled:cursor-not-allowed">
              {loading ? (
                <><div className="w-[18px] h-[18px] rounded-full border-[2.5px] border-white/40 border-t-white animate-spin" />Signing in…</>
              ) : (
                <>Sign in <ArrowRight className="w-[18px] h-[18px]" /></>
              )}
            </button>
          </form>

          <div className="flex items-center gap-3 mt-6">
            <div className="flex-1 h-px bg-border" />
            <span className="text-muted-foreground text-xs whitespace-nowrap">or</span>
            <div className="flex-1 h-px bg-border" />
          </div>

          <Link href="/phone-login"
            className="mt-3 flex items-center justify-center gap-2 w-full h-12 rounded-[14px] border-2 border-border bg-card font-semibold text-[15px] hover:border-primary transition-colors no-underline">
            📱 Sign in with Phone (OTP)
          </Link>

          <p className="text-center text-[13px] text-muted-foreground mt-5 leading-relaxed">
            Access is by invitation only.<br />Contact your gym admin to get an account.
          </p>

          <div className="flex items-center gap-3 mt-5">
            <div className="flex-1 h-px bg-border" />
            <span className="text-muted-foreground text-xs whitespace-nowrap">Own a gym?</span>
            <div className="flex-1 h-px bg-border" />
          </div>

          <Link href="/register"
            className="mt-3 flex items-center justify-center gap-2 w-full h-12 rounded-[14px] border-2 border-primary bg-transparent text-primary font-bold text-[15px] hover:bg-primary/5 transition-colors no-underline">
            🏋️ Register your gym
          </Link>

        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}
