'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Zap, Mail, ArrowLeft } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import toast from 'react-hot-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

const schema = z.object({ email: z.string().email('Invalid email address') });
type FormData = z.infer<typeof schema>;

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [sent, setSent] = useState(false);
  const [sentEmail, setSentEmail] = useState('');

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  const onSubmit = async ({ email }: FormData) => {
    try {
      await fetch(`${process.env.NEXT_PUBLIC_API_URL}/auth/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      setSentEmail(email);
      setSent(true);
    } catch {
      toast.error('Something went wrong. Please try again.');
    }
  };

  if (sent) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-gradient-to-br from-orange-50 via-background to-background dark:from-orange-950/20">
        <div className="w-full max-w-md text-center">
          <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Mail className="w-8 h-8 text-green-500" />
          </div>
          <h2 className="text-2xl font-bold mb-2">Check your inbox</h2>
          <p className="text-muted-foreground mb-6">
            If <span className="font-semibold text-foreground">{sentEmail}</span> is registered, you&apos;ll receive a password reset OTP shortly.
          </p>
          <Button variant="brand" className="w-full" onClick={() => router.push(`/reset-password?email=${encodeURIComponent(sentEmail)}`)}>
            Enter Reset OTP →
          </Button>
          <p className="text-sm text-muted-foreground mt-4">
            <Link href="/login" className="text-primary hover:underline">← Back to login</Link>
          </p>
        </div>
      </div>
    );
  }

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
          <Link href="/login" className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-6 w-fit">
            <ArrowLeft className="w-3.5 h-3.5" /> Back to login
          </Link>

          <div className="w-14 h-14 bg-orange-100 dark:bg-orange-900/30 rounded-2xl flex items-center justify-center mb-4">
            <Mail className="w-7 h-7 text-orange-500" />
          </div>

          <h2 className="text-2xl font-bold">Forgot password?</h2>
          <p className="text-muted-foreground text-sm mt-1 mb-6">
            No worries. We&apos;ll send a reset OTP to your email.
          </p>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Email address</label>
              <Input {...register('email')} type="email" placeholder="you@example.com" className="h-11" />
              {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
            </div>
            <Button type="submit" variant="brand" className="w-full h-11" loading={isSubmitting}>
              Send Reset OTP
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
