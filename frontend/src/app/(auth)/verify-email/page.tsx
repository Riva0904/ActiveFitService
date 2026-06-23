'use client';

import { Suspense, useState, useRef, useEffect, KeyboardEvent } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Zap, Mail, RefreshCw, CheckCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import { Button } from '@/components/ui/button';
import { useAuthStore } from '@/store/authStore';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api/v1';

async function apiPost(path: string, body: object) {
  const res = await fetch(`${API_URL}${path}`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw data;
  return data;
}

function VerifyEmailForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { setAuth } = useAuthStore();

  const email = searchParams.get('email') ?? '';
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [verifying, setVerifying] = useState(false);
  const [resending, setResending] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [autoSubmitted, setAutoSubmitted] = useState(false);
  const inputRefs = useRef<Array<HTMLInputElement | null>>([]);

  useEffect(() => {
    if (!email) { router.replace('/register'); return; }
    inputRefs.current[0]?.focus();
  }, [email, router]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  const handleChange = (idx: number, val: string) => {
    if (!/^\d*$/.test(val)) return;
    const next = [...otp];
    next[idx] = val.slice(-1);
    setOtp(next);
    if (val && idx < 5) inputRefs.current[idx + 1]?.focus();
  };

  const handleKeyDown = (idx: number, e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !otp[idx] && idx > 0) inputRefs.current[idx - 1]?.focus();
    if (e.key === 'ArrowLeft' && idx > 0) inputRefs.current[idx - 1]?.focus();
    if (e.key === 'ArrowRight' && idx < 5) inputRefs.current[idx + 1]?.focus();
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    const text = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (text.length === 6) {
      setOtp(text.split(''));
      inputRefs.current[5]?.focus();
    }
  };

  const submitVerify = async (code: string) => {
    if (verifying) return;
    setVerifying(true);
    try {
      const data = await apiPost('/auth/verify-email', { email, otp: code });
      setAuth(data.user);
      toast.success(`Welcome, ${data.user.firstName}! Email verified.`);
      switch (data.user.role) {
        case 'SUPER_ADMIN': router.push('/super-admin'); break;
        case 'GYM_ADMIN':   router.push('/admin');       break;
        case 'STAFF':       router.push('/staff');       break;
        case 'TRAINER':     router.push('/trainer');     break;
        default:            router.push('/user');
      }
    } catch (err: any) {
      const msg = err?.message ?? 'Verification failed';
      toast.error(Array.isArray(msg) ? msg[0] : msg);
      setOtp(['', '', '', '', '', '']);
      setAutoSubmitted(false);
      setTimeout(() => inputRefs.current[0]?.focus(), 50);
    } finally {
      setVerifying(false);
    }
  };

  // Auto-submit on 6 digits
  useEffect(() => {
    const code = otp.join('');
    if (code.length === 6 && !autoSubmitted && !verifying) {
      setAutoSubmitted(true);
      submitVerify(code);
    }
  }, [otp]);

  const handleResend = async () => {
    if (cooldown > 0 || resending) return;
    setResending(true);
    try {
      await apiPost('/auth/resend-otp', { email, purpose: 'EMAIL_VERIFICATION' });
      toast.success('New OTP sent! Check your inbox.');
      setCooldown(60);
      setOtp(['', '', '', '', '', '']);
      setAutoSubmitted(false);
      setTimeout(() => inputRefs.current[0]?.focus(), 50);
    } catch (err: any) {
      const msg = err?.message ?? 'Failed to resend OTP';
      toast.error(Array.isArray(msg) ? msg[0] : msg);
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-gradient-to-br from-orange-50 via-background to-background dark:from-orange-950/20">
      <div className="w-full max-w-md">
        <div className="flex items-center gap-3 mb-8">
          <div className="w-9 h-9 gradient-brand rounded-xl flex items-center justify-center">
            <Zap className="w-5 h-5 text-white" />
          </div>
          <span className="font-bold text-xl">ActiveFit</span>
        </div>

        <div className="bg-card rounded-2xl border border-border p-8 shadow-xl shadow-black/5">
          <div className="flex justify-center mb-5">
            <div className="w-16 h-16 bg-orange-100 dark:bg-orange-900/30 rounded-2xl flex items-center justify-center">
              <Mail className="w-8 h-8 text-orange-500" />
            </div>
          </div>

          <h2 className="text-2xl font-bold text-center">Verify your email</h2>
          <p className="text-muted-foreground text-center text-sm mt-2 mb-6">
            We sent a 6-digit code to<br />
            <span className="font-semibold text-foreground">{email}</span>
          </p>

          {/* OTP boxes */}
          <div className="flex gap-2.5 justify-center mb-6" onPaste={handlePaste}>
            {otp.map((digit, idx) => (
              <input
                key={idx}
                ref={(el) => { inputRefs.current[idx] = el; }}
                type="text"
                inputMode="numeric"
                maxLength={1}
                value={digit}
                onChange={(e) => handleChange(idx, e.target.value)}
                onKeyDown={(e) => handleKeyDown(idx, e)}
                disabled={verifying}
                className={[
                  'w-12 h-14 text-center text-2xl font-bold rounded-xl border-2 bg-background',
                  'transition-all focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20',
                  'disabled:opacity-60',
                  digit ? 'border-primary bg-primary/5 text-primary' : 'border-border',
                ].join(' ')}
              />
            ))}
          </div>

          <Button
            variant="brand"
            className="w-full h-11"
            onClick={() => submitVerify(otp.join(''))}
            loading={verifying}
            disabled={otp.some(d => !d) || verifying}
          >
            <CheckCircle className="w-4 h-4 mr-2" />
            Verify Email
          </Button>

          <div className="text-center mt-4">
            <p className="text-sm text-muted-foreground">
              Didn&apos;t receive the code?{' '}
              <button
                onClick={handleResend}
                disabled={cooldown > 0 || resending}
                className="text-primary font-semibold hover:underline disabled:opacity-50 disabled:no-underline inline-flex items-center gap-1"
              >
                {resending ? (
                  <><RefreshCw className="w-3 h-3 animate-spin" />Sending…</>
                ) : cooldown > 0 ? (
                  `Resend in ${cooldown}s`
                ) : 'Resend OTP'}
              </button>
            </p>
          </div>

          <div className="mt-5 p-3 bg-muted/50 rounded-xl text-center">
            <p className="text-xs text-muted-foreground">
              Code expires in{' '}
              <span className="font-semibold text-foreground">10 minutes</span>
              {' '}·{' '}Check your spam folder if not received
            </p>
          </div>
        </div>

        <p className="text-center text-sm text-muted-foreground mt-4">
          Wrong email?{' '}
          <a href="/register" className="text-primary font-semibold hover:underline">
            Go back
          </a>
        </p>
      </div>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={null}>
      <VerifyEmailForm />
    </Suspense>
  );
}
