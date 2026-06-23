'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Zap, Building2, User, ArrowRight, ArrowLeft, Eye, EyeOff, CheckCircle, Loader2 } from 'lucide-react';
import { authApi } from '@/lib/api';
import toast from 'react-hot-toast';
import { cn } from '@/lib/utils';

const INDIA_STATES = [
  'Andhra Pradesh','Arunachal Pradesh','Assam','Bihar','Chhattisgarh','Goa','Gujarat',
  'Haryana','Himachal Pradesh','Jharkhand','Karnataka','Kerala','Madhya Pradesh',
  'Maharashtra','Manipur','Meghalaya','Mizoram','Nagaland','Odisha','Punjab','Rajasthan',
  'Sikkim','Tamil Nadu','Telangana','Tripura','Uttar Pradesh','Uttarakhand','West Bengal',
  'Delhi','Jammu and Kashmir','Ladakh',
];

export default function RegisterPage() {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2>(1);
  const [showPass, setShowPass] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const [form, setForm] = useState({
    firstName: '', lastName: '', email: '', phone: '', password: '',
    gymName: '', gymAddress: '', gymCity: '', gymState: '', gymPincode: '',
  });

  const set = (k: string, v: string) => {
    setForm(f => ({ ...f, [k]: v }));
    setErrors(e => { const n = { ...e }; delete n[k]; return n; });
  };

  const validateStep1 = () => {
    const e: Record<string, string> = {};
    if (!form.firstName.trim()) e.firstName = 'Required';
    if (!form.lastName.trim()) e.lastName = 'Required';
    if (!form.email.trim() || !/\S+@\S+\.\S+/.test(form.email)) e.email = 'Valid email required';
    if (form.password.length < 8) e.password = 'Min 8 characters';
    if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(form.password)) e.password = 'Need uppercase, lowercase & number';
    return e;
  };

  const validateStep2 = () => {
    const e: Record<string, string> = {};
    if (!form.gymName.trim()) e.gymName = 'Required';
    if (!form.gymAddress.trim()) e.gymAddress = 'Required';
    if (!form.gymCity.trim()) e.gymCity = 'Required';
    if (!form.gymState) e.gymState = 'Required';
    if (!/^\d{6}$/.test(form.gymPincode)) e.gymPincode = '6-digit pincode required';
    return e;
  };

  const handleNext = () => {
    const e = validateStep1();
    if (Object.keys(e).length) { setErrors(e); return; }
    setStep(2);
  };

  const handleSubmit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    const e = validateStep2();
    if (Object.keys(e).length) { setErrors(e); return; }
    setSaving(true);
    try {
      await (authApi as any).registerGym(form);
      toast.success('Account created! Check your email for OTP.');
      router.push(`/verify-email?email=${encodeURIComponent(form.email)}`);
    } catch {
    } finally {
      setSaving(false);
    }
  };

  const inputCls = (hasError?: boolean) => cn(
    'w-full h-11 rounded-xl px-3.5 border-[1.5px] text-sm outline-none bg-background text-foreground',
    'transition-colors focus:border-primary focus:ring-4 focus:ring-primary/10 placeholder:text-muted-foreground/60',
    hasError ? 'border-destructive' : 'border-border',
  );

  const labelCls = 'block text-[12px] font-bold text-muted-foreground uppercase tracking-wide mb-1.5';
  const errorCls = 'text-destructive text-[11px] mt-1';

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-8 bg-background">
      {/* Background glow */}
      <div className="fixed inset-0 pointer-events-none bg-[radial-gradient(ellipse_60%_50%_at_20%_0%,rgba(249,115,22,0.07)_0%,transparent_60%),radial-gradient(ellipse_50%_40%_at_80%_100%,rgba(139,92,246,0.06)_0%,transparent_60%)]" />

      <div className="w-full max-w-[500px] relative z-10">

        {/* Logo */}
        <div className="flex items-center justify-center gap-2.5 mb-7">
          <div className="w-10 h-10 rounded-xl gradient-brand flex items-center justify-center">
            <Zap className="w-5 h-5 text-white" />
          </div>
          <span className="font-extrabold text-xl">ActiveFit</span>
        </div>

        {/* Step progress */}
        <div className="flex items-center gap-0 mb-6">
          {[{ n: 1, label: 'Your Info', icon: User }, { n: 2, label: 'Your Gym', icon: Building2 }].map(({ n, label: lbl, icon: Icon }, i) => (
            <div key={n} className="flex items-center flex-1">
              <div className="flex flex-col items-center flex-1 gap-1.5">
                <div className={cn(
                  'w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm transition-all',
                  step > n ? 'gradient-green text-white' :
                  step === n ? 'gradient-brand text-white' :
                  'bg-muted text-muted-foreground',
                )}>
                  {step > n ? <CheckCircle className="w-[18px] h-[18px]" /> : <Icon className="w-4 h-4" />}
                </div>
                <span className={cn('text-[11px] font-semibold', step >= n ? 'text-foreground' : 'text-muted-foreground')}>{lbl}</span>
              </div>
              {i < 1 && (
                <div className={cn('flex-1 h-0.5 mb-5 transition-colors', step > 1 ? 'bg-emerald-500' : 'bg-border')} />
              )}
            </div>
          ))}
        </div>

        {/* Card */}
        <div className="bg-card rounded-2xl border border-border p-8 shadow-lifted">

          {step === 1 ? (
            <>
              <h2 className="font-extrabold text-[22px] mb-1">Create your account</h2>
              <p className="text-muted-foreground text-sm mb-6">Step 1 of 2 — your personal details</p>

              <div className="flex flex-col gap-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelCls}>First Name *</label>
                    <input className={inputCls(!!errors.firstName)} value={form.firstName} onChange={e => set('firstName', e.target.value)} placeholder="John" />
                    {errors.firstName && <p className={errorCls}>{errors.firstName}</p>}
                  </div>
                  <div>
                    <label className={labelCls}>Last Name *</label>
                    <input className={inputCls(!!errors.lastName)} value={form.lastName} onChange={e => set('lastName', e.target.value)} placeholder="Doe" />
                    {errors.lastName && <p className={errorCls}>{errors.lastName}</p>}
                  </div>
                </div>

                <div>
                  <label className={labelCls}>Email *</label>
                  <input className={inputCls(!!errors.email)} type="email" value={form.email} onChange={e => set('email', e.target.value)} placeholder="you@yourgym.com" />
                  {errors.email && <p className={errorCls}>{errors.email}</p>}
                </div>

                <div>
                  <label className={labelCls}>Phone</label>
                  <input className={inputCls()} value={form.phone} onChange={e => set('phone', e.target.value)} placeholder="+91 9876543210" />
                </div>

                <div>
                  <label className={labelCls}>Password *</label>
                  <div className="relative">
                    <input className={cn(inputCls(!!errors.password), 'pr-10')} type={showPass ? 'text' : 'password'} value={form.password} onChange={e => set('password', e.target.value)} placeholder="Min. 8 chars — uppercase, lowercase, number" />
                    <button type="button" onClick={() => setShowPass(!showPass)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors">
                      {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  {errors.password && <p className={errorCls}>{errors.password}</p>}
                </div>

                <button type="button" onClick={handleNext}
                  className="w-full h-[46px] rounded-xl gradient-brand shadow-brand text-white font-bold text-[15px] flex items-center justify-center gap-2 hover:opacity-90 transition-all">
                  Next: Gym Details <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </>
          ) : (
            <form onSubmit={handleSubmit}>
              <div className="flex items-center gap-2.5 mb-1">
                <button type="button" onClick={() => setStep(1)}
                  className="bg-muted border-0 rounded-lg px-2 py-1 cursor-pointer flex items-center text-muted-foreground hover:bg-muted/80 transition-colors">
                  <ArrowLeft className="w-3.5 h-3.5" />
                </button>
                <h2 className="font-extrabold text-[22px]">Your Gym</h2>
              </div>
              <p className="text-muted-foreground text-sm mb-6">Step 2 of 2 — gym details</p>

              <div className="flex flex-col gap-4">
                <div>
                  <label className={labelCls}>Gym Name *</label>
                  <input className={inputCls(!!errors.gymName)} value={form.gymName} onChange={e => set('gymName', e.target.value)} placeholder="e.g. FitnessHub Premium" />
                  {errors.gymName && <p className={errorCls}>{errors.gymName}</p>}
                </div>

                <div>
                  <label className={labelCls}>Street Address *</label>
                  <input className={inputCls(!!errors.gymAddress)} value={form.gymAddress} onChange={e => set('gymAddress', e.target.value)} placeholder="123 MG Road, Near City Mall" />
                  {errors.gymAddress && <p className={errorCls}>{errors.gymAddress}</p>}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelCls}>City *</label>
                    <input className={inputCls(!!errors.gymCity)} value={form.gymCity} onChange={e => set('gymCity', e.target.value)} placeholder="Bangalore" />
                    {errors.gymCity && <p className={errorCls}>{errors.gymCity}</p>}
                  </div>
                  <div>
                    <label className={labelCls}>Pincode *</label>
                    <input className={inputCls(!!errors.gymPincode)} value={form.gymPincode} onChange={e => set('gymPincode', e.target.value)} maxLength={6} placeholder="560001" />
                    {errors.gymPincode && <p className={errorCls}>{errors.gymPincode}</p>}
                  </div>
                </div>

                <div>
                  <label className={labelCls}>State *</label>
                  <select className={cn(inputCls(!!errors.gymState), 'bg-background cursor-pointer')} value={form.gymState} onChange={e => set('gymState', e.target.value)}>
                    <option value="">Select state…</option>
                    {INDIA_STATES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                  {errors.gymState && <p className={errorCls}>{errors.gymState}</p>}
                </div>

                <div className="flex items-start gap-2.5 bg-primary/5 border border-primary/20 rounded-xl p-4">
                  <CheckCircle className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Your gym starts on the <strong>Free plan</strong>. Upgrade to Pro or Enterprise after email verification for full access.
                  </p>
                </div>

                <button type="submit" disabled={saving}
                  className="w-full h-[46px] rounded-xl gradient-brand shadow-brand text-white font-bold text-[15px] flex items-center justify-center gap-2 hover:opacity-90 transition-all disabled:opacity-60 disabled:cursor-not-allowed">
                  {saving
                    ? <><Loader2 className="w-4 h-4 animate-spin" /> Creating account…</>
                    : <>Create Gym Account <ArrowRight className="w-4 h-4" /></>}
                </button>
              </div>
            </form>
          )}
        </div>

        <p className="text-center mt-5 text-sm text-muted-foreground">
          Already have an account?{' '}
          <Link href="/login" className="text-primary font-bold hover:underline">Sign in</Link>
        </p>
      </div>
    </div>
  );
}
