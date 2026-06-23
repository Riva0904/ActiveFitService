'use client';

import { useState, useRef, useEffect, useCallback, KeyboardEvent, ClipboardEvent } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Zap, ArrowRight, ArrowLeft, Phone, Shield, RefreshCw, CheckCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import { useFirebasePhoneAuth } from '@/hooks/useFirebasePhoneAuth';
import { authApi } from '@/lib/api';
import { useAuthStore } from '@/store/authStore';
import { cn } from '@/lib/utils';

const COUNTRY_CODES = [
  { code: '+91', label: '🇮🇳 +91' },
  { code: '+1',  label: '🇺🇸 +1'  },
  { code: '+44', label: '🇬🇧 +44' },
  { code: '+971',label: '🇦🇪 +971'},
  { code: '+65', label: '🇸🇬 +65' },
  { code: '+60', label: '🇲🇾 +60' },
];

const RECAPTCHA_ID = 'firebase-recaptcha-container';

// ─── OTP Box ─────────────────────────────────────────────────────────────────

interface OtpBoxesProps {
  otp: string[];
  refs: React.MutableRefObject<(HTMLInputElement | null)[]>;
  onChange: (i: number, val: string) => void;
  onKeyDown: (i: number, e: KeyboardEvent<HTMLInputElement>) => void;
  onPaste: (e: ClipboardEvent<HTMLInputElement>) => void;
  hasError: boolean;
}

function OtpBoxes({ otp, refs, onChange, onKeyDown, onPaste, hasError }: OtpBoxesProps) {
  return (
    <div className="flex gap-2.5 justify-center my-2">
      {otp.map((digit, i) => (
        <input
          key={i}
          ref={(el) => { refs.current[i] = el; }}
          type="text"
          inputMode="numeric"
          maxLength={1}
          value={digit}
          onChange={(e) => onChange(i, e.target.value)}
          onKeyDown={(e) => onKeyDown(i, e)}
          onPaste={onPaste}
          className={cn(
            'w-12 h-14 rounded-xl text-center text-[22px] font-bold outline-none transition-all caret-primary',
            'border-2',
            hasError ? 'border-destructive bg-destructive/5' :
            digit ? 'border-primary bg-primary/5 ring-2 ring-primary/10' :
            'border-border bg-card',
          )}
        />
      ))}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function PhoneLoginPage() {
  const router = useRouter();
  const { setAuth } = useAuthStore();

  const {
    step, loading, error, countdown,
    setError, initRecaptcha, sendOtp, verifyOtp, resendOtp, reset,
  } = useFirebasePhoneAuth();

  const [countryCode, setCountryCode] = useState('+91');
  const [phone, setPhone]             = useState('');
  const [phoneFocused, setPhoneFocused] = useState(false);
  const [otp, setOtp]                 = useState(['', '', '', '', '', '']);
  const [verified, setVerified]       = useState(false);

  const otpRefs  = useRef<(HTMLInputElement | null)[]>([]);
  const hasError = !!error;

  useEffect(() => {
    initRecaptcha(RECAPTCHA_ID);
    return reset;
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSendOtp = useCallback(async () => {
    const digits = phone.replace(/\D/g, '');
    if (digits.length < 7) { setError('Enter a valid phone number.'); return; }
    const fullPhone = `${countryCode}${digits}`;
    const ok = await sendOtp(fullPhone);
    if (ok) toast.success('OTP sent! Check your messages.');
  }, [phone, countryCode, sendOtp, setError]);

  const handleOtpChange = useCallback((i: number, val: string) => {
    if (!/^\d?$/.test(val)) return;
    setOtp((prev) => { const next = [...prev]; next[i] = val; return next; });
    if (val && i < 5) otpRefs.current[i + 1]?.focus();
  }, []);

  const handleOtpKeyDown = useCallback((i: number, e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !otp[i] && i > 0) otpRefs.current[i - 1]?.focus();
  }, [otp]);

  const handleOtpPaste = useCallback((e: ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (!pasted) return;
    const filled = [...pasted.padEnd(6, '').split('').slice(0, 6)];
    setOtp(filled);
    otpRefs.current[Math.min(pasted.length, 5)]?.focus();
  }, []);

  const handleVerify = useCallback(async () => {
    const code = otp.join('');
    if (code.length !== 6) { setError('Enter the complete 6-digit OTP.'); return; }
    try {
      const { idToken, phone: verifiedPhone } = await verifyOtp(code);
      try {
        const res: any = await authApi.phoneLogin({
          idToken,
          phone: verifiedPhone || `${countryCode}${phone.replace(/\D/g, '')}`,
        });
        setVerified(true);
        setAuth(res.user);
        toast.success(`Welcome, ${res.user.firstName}!`);
        await new Promise((r) => setTimeout(r, 800));
        switch (res.user.role) {
          case 'SUPER_ADMIN': router.push('/super-admin'); break;
          case 'ADMIN':       router.push('/admin');       break;
          default:            router.push('/user');
        }
      } catch (apiErr: any) {
        setError(apiErr?.response?.data?.message ?? 'Backend /auth/phone-login endpoint not configured.');
        toast('Phone verified by Firebase. Wire backend to finish.', { icon: '⚠️' });
      }
    } catch { }
  }, [otp, verifyOtp, setAuth, setError, router, countryCode, phone]);

  const handleResend = useCallback(async () => {
    if (countdown > 0) return;
    setOtp(['', '', '', '', '', '']);
    initRecaptcha(RECAPTCHA_ID);
    const fullPhone = `${countryCode}${phone.replace(/\D/g, '')}`;
    const ok = await resendOtp(fullPhone, RECAPTCHA_ID);
    if (ok) toast.success('New OTP sent!');
  }, [countdown, phone, countryCode, resendOtp, initRecaptcha]);

  const inputCls = cn(
    'w-full h-[50px] rounded-xl border-2 px-3.5 text-[15px] outline-none transition-all bg-card text-foreground',
    'placeholder:text-muted-foreground/60',
    phoneFocused ? 'border-primary ring-4 ring-primary/10' :
    hasError ? 'border-destructive ring-4 ring-destructive/10' :
    'border-border',
  );

  const btnCls = (disabled: boolean) => cn(
    'w-full h-[52px] rounded-[14px] text-white font-bold text-base flex items-center justify-center gap-2 transition-all',
    disabled ? 'bg-muted text-muted-foreground cursor-not-allowed' :
    'gradient-brand shadow-brand hover:opacity-90 active:scale-[0.98] cursor-pointer',
  );

  return (
    <div className="min-h-screen flex">

      {/* ── Left hero ─────────────────────────────────────────────────────────── */}
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
          <div className="flex items-center gap-2.5 mb-7 bg-white/[0.14] backdrop-blur-sm rounded-full px-4 py-2.5 w-fit border border-white/20">
            <Shield className="w-[18px] h-[18px] text-white" />
            <span className="text-white text-sm font-semibold">Phone sign-in with Firebase OTP</span>
          </div>
          <h1 className="text-white text-[48px] font-black leading-[1.08] tracking-tight mb-5">
            Secure login<br />
            <span className="text-white/65">in seconds</span>
          </h1>
          <p className="text-white/70 text-lg leading-relaxed mb-9 max-w-[400px]">
            No password needed. Just your phone number and a one-time code sent via SMS.
          </p>
          {[
            { icon: '🔒', text: 'End-to-end encrypted via Firebase Auth' },
            { icon: '⚡', text: 'OTP delivered in under 10 seconds' },
            { icon: '🌍', text: 'Works with any mobile number worldwide' },
          ].map(({ icon, text }) => (
            <div key={text} className="flex items-center gap-3 mb-3.5">
              <div className="w-[34px] h-[34px] rounded-[10px] bg-white/[0.16] flex items-center justify-center text-base">{icon}</div>
              <span className="text-white/80 text-sm">{text}</span>
            </div>
          ))}
        </div>

        <div className="relative z-10 text-white/35 text-xs">
          © 2025 ActiveFit · Privacy · Terms
        </div>
      </div>

      {/* ── Right form panel ──────────────────────────────────────────────────── */}
      <div className="flex-1 flex items-center justify-center px-6 py-10 bg-secondary/30 relative">
        <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(ellipse_60%_50%_at_70%_10%,rgba(249,115,22,0.06)_0%,transparent_60%)]" />

        <div className="w-full max-w-[440px] relative z-10">

          {/* Mobile logo */}
          <div className="flex items-center gap-3 mb-8 lg:hidden">
            <div className="w-10 h-10 rounded-xl gradient-brand flex items-center justify-center">
              <Zap className="w-5 h-5 text-white" />
            </div>
            <span className="font-extrabold text-xl">ActiveFit</span>
          </div>

          {/* ── Step: PHONE ── */}
          {step === 'phone' && (
            <>
              <div className="mb-8">
                <div className="flex items-center gap-2.5 mb-3">
                  <div className="w-10 h-10 rounded-xl gradient-brand flex items-center justify-center">
                    <Phone className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h2 className="font-extrabold text-[28px] tracking-tight">Phone sign-in</h2>
                    <p className="text-muted-foreground text-sm">We&apos;ll send you a one-time password</p>
                  </div>
                </div>
              </div>

              <div className="flex gap-1.5 mb-7">
                {[1, 2].map((n) => (
                  <div key={n} className={cn('flex-1 h-1 rounded-full', n === 1 ? 'bg-primary' : 'bg-border')} />
                ))}
              </div>
              <p className="text-muted-foreground text-xs mb-6">Step 1 of 2 — Enter phone number</p>

              <div className="mb-6">
                <label className="block font-semibold text-sm mb-2">Phone number</label>
                <div className="flex gap-2">
                  <select
                    value={countryCode}
                    onChange={(e) => setCountryCode(e.target.value)}
                    className="h-[50px] rounded-xl border-2 border-border bg-card px-2.5 text-sm font-semibold outline-none cursor-pointer min-w-[90px] focus:border-primary transition-colors"
                  >
                    {COUNTRY_CODES.map(({ code, label }) => (
                      <option key={code} value={code}>{label}</option>
                    ))}
                  </select>
                  <input
                    type="tel"
                    placeholder="98765 43210"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value.replace(/[^\d\s\-]/g, ''))}
                    onFocus={() => setPhoneFocused(true)}
                    onBlur={() => setPhoneFocused(false)}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleSendOtp(); }}
                    className={cn(inputCls, 'flex-1')}
                    autoFocus
                  />
                </div>
                {error && (
                  <p className="text-destructive text-xs mt-1.5 flex items-center gap-1">⚠ {error}</p>
                )}
                <p className="text-muted-foreground text-xs mt-1.5">
                  Format: {countryCode} followed by your number (no leading 0)
                </p>
              </div>

              <button onClick={handleSendOtp} disabled={loading} className={btnCls(loading)}>
                {loading
                  ? <><div className="w-[18px] h-[18px] rounded-full border-[2.5px] border-white/40 border-t-white animate-spin" />Sending OTP…</>
                  : <>Send OTP <ArrowRight className="w-[18px] h-[18px]" /></>}
              </button>

              <div className="text-center mt-6">
                <Link href="/login" className="text-muted-foreground text-[13px] inline-flex items-center gap-1.5 hover:text-foreground transition-colors no-underline">
                  <ArrowLeft className="w-3.5 h-3.5" /> Back to email login
                </Link>
              </div>
            </>
          )}

          {/* ── Step: OTP ── */}
          {step === 'otp' && !verified && (
            <>
              <div className="mb-8">
                <div className="flex items-center gap-2.5 mb-3">
                  <div className="w-10 h-10 rounded-xl gradient-brand flex items-center justify-center">
                    <Shield className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h2 className="font-extrabold text-[28px] tracking-tight">Enter OTP</h2>
                    <p className="text-muted-foreground text-sm">Sent to {countryCode} {phone}</p>
                  </div>
                </div>
              </div>

              <div className="flex gap-1.5 mb-7">
                {[1, 2].map((n) => (
                  <div key={n} className="flex-1 h-1 rounded-full bg-primary" />
                ))}
              </div>
              <p className="text-muted-foreground text-xs mb-6">Step 2 of 2 — Verify OTP</p>

              <div className="flex items-start gap-2.5 bg-primary/5 border border-primary/20 rounded-xl px-4 py-3 mb-6">
                <span className="text-xl">📱</span>
                <p className="text-amber-800 dark:text-amber-400 text-[13px] leading-relaxed">
                  A 6-digit OTP was sent to <strong>{countryCode}{phone.replace(/\D/g,'')}</strong>.<br />
                  It expires in 2 minutes.
                </p>
              </div>

              <div className={cn('mb-6', hasError && 'mb-2')}>
                <OtpBoxes otp={otp} refs={otpRefs} onChange={handleOtpChange} onKeyDown={handleOtpKeyDown} onPaste={handleOtpPaste} hasError={hasError} />
              </div>

              {error && (
                <p className="text-destructive text-xs mb-4 text-center flex items-center justify-center gap-1">⚠ {error}</p>
              )}

              <button onClick={handleVerify} disabled={loading || otp.join('').length !== 6} className={btnCls(loading || otp.join('').length !== 6)}>
                {loading
                  ? <><div className="w-[18px] h-[18px] rounded-full border-[2.5px] border-white/40 border-t-white animate-spin" />Verifying…</>
                  : <>Verify OTP <ArrowRight className="w-[18px] h-[18px]" /></>}
              </button>

              <div className="flex justify-between items-center mt-5">
                <button onClick={() => { reset(); initRecaptcha(RECAPTCHA_ID); }}
                  className="bg-transparent border-0 cursor-pointer text-muted-foreground text-[13px] flex items-center gap-1 hover:text-foreground transition-colors">
                  <ArrowLeft className="w-3.5 h-3.5" /> Change number
                </button>
                <button onClick={handleResend} disabled={countdown > 0 || loading}
                  className={cn(
                    'bg-transparent border-0 font-semibold text-sm flex items-center gap-1.5 py-2 transition-colors',
                    countdown > 0 || loading ? 'opacity-50 cursor-not-allowed text-muted-foreground' : 'cursor-pointer text-primary hover:text-primary/80',
                  )}>
                  <RefreshCw className="w-3.5 h-3.5" />
                  {countdown > 0 ? `Resend in ${countdown}s` : 'Resend OTP'}
                </button>
              </div>
            </>
          )}

          {/* ── Step: SUCCESS ── */}
          {verified && (
            <div className="text-center py-6">
              <div className="w-[72px] h-[72px] rounded-full gradient-green flex items-center justify-center mx-auto mb-5">
                <CheckCircle className="w-[38px] h-[38px] text-white" />
              </div>
              <h2 className="font-extrabold text-[28px] mb-2">Verified!</h2>
              <p className="text-muted-foreground text-[15px]">Redirecting you to the dashboard…</p>
              <div className="w-12 h-1 rounded-full bg-primary mx-auto mt-5 animate-pulse" />
            </div>
          )}

          <div id={RECAPTCHA_ID} />
        </div>
      </div>
    </div>
  );
}
