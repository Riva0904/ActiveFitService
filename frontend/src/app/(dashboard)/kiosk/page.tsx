'use client';

import { useEffect, useRef, useState } from 'react';
import { QrCode, CheckCircle, LogOut, Hash, ArrowRight, RotateCcw } from 'lucide-react';
import { attendanceApi } from '@/lib/api';
import { cn } from '@/lib/utils';

type Phase = 'scan' | 'id-entry' | 'success' | 'error';

export default function KioskPage() {
  const [phase, setPhase]         = useState<Phase>('scan');
  const [qrInput, setQrInput]     = useState('');
  const [idInput, setIdInput]     = useState('');
  const [loading, setLoading]     = useState(false);
  const [result, setResult]       = useState<{ name: string; action: 'CHECKIN' | 'CHECKOUT'; memberCode?: string } | null>(null);
  const [errMsg, setErrMsg]       = useState('');
  const qrRef  = useRef<HTMLInputElement>(null);
  const idRef  = useRef<HTMLInputElement>(null);

  const RESET_DELAY = 4000;

  const resetToScan = () => {
    setPhase('scan');
    setQrInput('');
    setIdInput('');
    setResult(null);
    setErrMsg('');
  };

  useEffect(() => {
    if (phase === 'scan') {
      setTimeout(() => qrRef.current?.focus(), 100);
    }
    if (phase === 'id-entry') {
      setTimeout(() => idRef.current?.focus(), 100);
    }
    if (phase === 'success' || phase === 'error') {
      const t = setTimeout(resetToScan, RESET_DELAY);
      return () => clearTimeout(t);
    }
  }, [phase]);

  const doCheckIn = async (code: string) => {
    if (!code.trim()) return;
    setLoading(true);
    try {
      const res: any = await attendanceApi.qrCheckIn(code.trim());
      const firstName = res.member?.user?.firstName ?? '';
      const lastName  = res.member?.user?.lastName  ?? '';
      setResult({
        name:       `${firstName} ${lastName}`.trim() || 'Member',
        action:     res.action ?? 'CHECKIN',
        memberCode: res.member?.memberCode,
      });
      setPhase('success');
    } catch (err: any) {
      const msg: string = err.response?.data?.message ?? 'Not found';
      if (phase === 'scan') {
        // QR not recognised → ask for member ID
        setErrMsg(msg);
        setPhase('id-entry');
      } else {
        setErrMsg(msg);
        setPhase('error');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleQrSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    doCheckIn(qrInput);
  };

  const handleIdSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    doCheckIn(idInput);
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background px-4 py-8 select-none">

      {/* Header */}
      <div className="mb-8 text-center">
        <div className="inline-flex items-center gap-3 mb-3">
          <div className="w-12 h-12 gradient-brand rounded-2xl flex items-center justify-center shadow-brand">
            <QrCode className="w-6 h-6 text-white" />
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight">ActiveFit</h1>
        </div>
        <p className="text-muted-foreground font-medium">Gym Check-in / Check-out</p>
      </div>

      {/* Card */}
      <div className="w-full max-w-md">

        {/* ── SCAN phase ─────────────────────────────────────────── */}
        {phase === 'scan' && (
          <div className="bg-card border border-border/60 rounded-3xl shadow-2xl overflow-hidden animate-fade-in">
            <div className="gradient-brand p-6 text-center relative overflow-hidden">
              <div className="absolute -top-8 -right-8 w-32 h-32 rounded-full bg-white/10" />
              <div className="absolute -bottom-8 -left-8 w-32 h-32 rounded-full bg-white/5" />
              <div className="relative">
                {/* QR frame */}
                <div className="w-36 h-36 border-4 border-white/70 rounded-2xl mx-auto flex items-center justify-center bg-white/10 backdrop-blur-sm relative mb-4">
                  <QrCode className="w-16 h-16 text-white/60" />
                  <div className="absolute top-1.5 left-1.5 w-5 h-5 border-t-4 border-l-4 border-white rounded-tl-lg" />
                  <div className="absolute top-1.5 right-1.5 w-5 h-5 border-t-4 border-r-4 border-white rounded-tr-lg" />
                  <div className="absolute bottom-1.5 left-1.5 w-5 h-5 border-b-4 border-l-4 border-white rounded-bl-lg" />
                  <div className="absolute bottom-1.5 right-1.5 w-5 h-5 border-b-4 border-r-4 border-white rounded-br-lg" />
                </div>
                <p className="text-white font-extrabold text-lg">Scan Your QR Code</p>
                <p className="text-white/70 text-sm mt-1">Point your badge at the scanner</p>
              </div>
            </div>

            <div className="p-6 space-y-4">
              <form onSubmit={handleQrSubmit} className="space-y-3">
                <input
                  ref={qrRef}
                  value={qrInput}
                  onChange={e => setQrInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); doCheckIn(qrInput); } }}
                  placeholder="QR scan auto-submits here…"
                  className="w-full h-12 px-4 text-center font-mono bg-muted/50 border-2 border-border rounded-2xl outline-none focus:border-primary/40 text-sm"
                  autoComplete="off"
                  autoFocus
                />
                <button type="submit" disabled={loading || !qrInput.trim()}
                  className="w-full h-12 rounded-2xl gradient-brand text-white font-extrabold flex items-center justify-center gap-2 hover:opacity-90 transition-all disabled:opacity-50 shadow-brand">
                  {loading
                    ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    : <><CheckCircle className="w-5 h-5" /> Check In / Out</>}
                </button>
              </form>

              <div className="flex items-center gap-3">
                <div className="flex-1 h-px bg-border" />
                <span className="text-xs text-muted-foreground font-medium">or</span>
                <div className="flex-1 h-px bg-border" />
              </div>

              <button onClick={() => setPhase('id-entry')}
                className="w-full h-11 rounded-2xl border-2 border-border bg-card hover:bg-muted text-sm font-bold transition-all flex items-center justify-center gap-2">
                <Hash className="w-4 h-4" /> Enter Member ID
              </button>
            </div>
          </div>
        )}

        {/* ── ID ENTRY phase ──────────────────────────────────────── */}
        {phase === 'id-entry' && (
          <div className="bg-card border border-border/60 rounded-3xl shadow-2xl overflow-hidden animate-fade-in">
            <div className="gradient-blue p-6 text-center relative overflow-hidden">
              <div className="absolute -top-8 -right-8 w-32 h-32 rounded-full bg-white/10" />
              <div className="relative">
                <div className="w-16 h-16 bg-white/20 rounded-2xl mx-auto flex items-center justify-center mb-3">
                  <Hash className="w-8 h-8 text-white" />
                </div>
                <p className="text-white font-extrabold text-lg">Enter Member ID</p>
                <p className="text-white/70 text-sm mt-1">
                  {errMsg ? 'QR not recognised — enter your ID below' : 'Type your member code (e.g. FH001)'}
                </p>
              </div>
            </div>

            <div className="p-6 space-y-4">
              <form onSubmit={handleIdSubmit} className="space-y-3">
                <input
                  ref={idRef}
                  value={idInput}
                  onChange={e => setIdInput(e.target.value.toUpperCase())}
                  placeholder="e.g. FH001"
                  className="w-full h-14 px-4 text-center text-2xl font-extrabold font-mono bg-muted/50 border-2 border-border rounded-2xl outline-none focus:border-primary/40 tracking-widest"
                  autoComplete="off"
                  autoFocus
                />
                <button type="submit" disabled={loading || !idInput.trim()}
                  className="w-full h-12 rounded-2xl gradient-blue text-white font-extrabold flex items-center justify-center gap-2 hover:opacity-90 transition-all disabled:opacity-50">
                  {loading
                    ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    : <><ArrowRight className="w-5 h-5" /> Submit</>}
                </button>
              </form>

              <button onClick={resetToScan}
                className="w-full h-11 rounded-2xl border-2 border-border bg-card hover:bg-muted text-sm font-bold transition-all flex items-center justify-center gap-2 text-muted-foreground">
                <RotateCcw className="w-4 h-4" /> Back to Scanner
              </button>
            </div>
          </div>
        )}

        {/* ── SUCCESS phase ───────────────────────────────────────── */}
        {phase === 'success' && result && (
          <div className={cn(
            'rounded-3xl shadow-2xl overflow-hidden animate-pop',
            result.action === 'CHECKIN' ? 'bg-emerald-500' : 'bg-blue-500'
          )}>
            <div className="p-10 text-center text-white space-y-4">
              <div className="w-24 h-24 bg-white/20 rounded-full mx-auto flex items-center justify-center">
                {result.action === 'CHECKIN'
                  ? <CheckCircle className="w-12 h-12 text-white" />
                  : <LogOut className="w-12 h-12 text-white" />}
              </div>
              <div>
                <p className="text-4xl font-extrabold">{result.action === 'CHECKIN' ? 'Welcome!' : 'Goodbye!'}</p>
                <p className="text-xl font-bold mt-2 opacity-90">{result.name}</p>
                {result.memberCode && (
                  <p className="text-sm font-mono opacity-70 mt-1">#{result.memberCode}</p>
                )}
              </div>
              <div className="inline-flex items-center gap-2 bg-white/20 rounded-full px-5 py-2 text-sm font-bold">
                {result.action === 'CHECKIN' ? 'Checked In ✓' : 'Checked Out ✓'}
              </div>
              <p className="text-xs opacity-60 mt-2">Resetting in {RESET_DELAY / 1000}s…</p>
            </div>
          </div>
        )}

        {/* ── ERROR phase ────────────────────────────────────────── */}
        {phase === 'error' && (
          <div className="bg-card border-2 border-rose-200 dark:border-rose-800/50 rounded-3xl shadow-2xl overflow-hidden animate-pop">
            <div className="bg-rose-500 p-8 text-center text-white space-y-3">
              <div className="w-20 h-20 bg-white/20 rounded-full mx-auto flex items-center justify-center">
                <span className="text-4xl font-black">✕</span>
              </div>
              <p className="text-2xl font-extrabold">Not Found</p>
              <p className="text-sm opacity-80">{errMsg || 'Member not found. Please contact the front desk.'}</p>
            </div>
            <div className="p-5">
              <button onClick={resetToScan}
                className="w-full h-12 rounded-2xl gradient-brand text-white font-extrabold flex items-center justify-center gap-2 hover:opacity-90 transition-all">
                <RotateCcw className="w-5 h-5" /> Try Again
              </button>
              <p className="text-center text-xs text-muted-foreground mt-3">Auto-reset in {RESET_DELAY / 1000}s</p>
            </div>
          </div>
        )}

      </div>

      {/* Footer */}
      <p className="mt-8 text-xs text-muted-foreground text-center">
        First scan = Check-in · Second scan = Check-out
      </p>
    </div>
  );
}
