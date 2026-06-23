'use client';

import { useEffect, useState } from 'react';
import { Dumbbell, Zap, ChevronRight, Target, Clock, BarChart2, ShoppingBag, CreditCard, CheckCircle } from 'lucide-react';
import { workoutPlansApi, paymentsApi } from '@/lib/api';
import toast from 'react-hot-toast';
import { cn } from '@/lib/utils';

const levelColors: Record<string, string> = {
  BEGINNER: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  INTERMEDIATE: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  ADVANCED: 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400',
};

const goalIcons: Record<string, string> = {
  'Weight Loss': '🔥', 'Muscle Gain': '💪', 'Endurance': '🏃', 'Body Recomposition': '⚖️',
  'Strength Gain': '🏋️', 'General Fitness': '⚡', 'Flexibility': '🧘',
};

export default function WorkoutsPage() {
  const [assignments, setAssignments] = useState<any[]>([]);
  const [packages, setPackages] = useState<any[]>([]);
  const [generating, setGenerating] = useState(false);
  const [goal, setGoal] = useState('Weight Loss');
  const [level, setLevel] = useState('BEGINNER');
  const [expanded, setExpanded] = useState<string | null>(null);
  const [buyingId, setBuyingId] = useState<string | null>(null);

  const fetchMyPlans = () => {
    workoutPlansApi.getMyPlans()
      .then((res: any) => setAssignments(Array.isArray(res) ? res : []))
      .catch(() => {});
  };

  useEffect(() => {
    fetchMyPlans();
    workoutPlansApi.getPackages()
      .then((r: any) => setPackages(Array.isArray(r) ? r : r.data ?? []))
      .catch(() => {});
  }, []);

  const generateAi = async () => {
    setGenerating(true);
    try {
      await workoutPlansApi.generateAi({ goal, level });
      fetchMyPlans();
      toast.success('AI workout plan generated! 🔥');
    } catch { }
    setGenerating(false);
  };

  const buyPackage = async (pkg: any) => {
    setBuyingId(pkg.id);
    try {
      const orderRes: any = await workoutPlansApi.buyPackage(pkg.id);
      if (typeof window !== 'undefined' && (window as any).Razorpay) {
        const rzp = new (window as any).Razorpay({
          key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
          amount: orderRes.amount * 100,
          currency: 'INR',
          name: 'ActiveFit',
          description: `${pkg.name} — ${pkg.durationDays ?? 30} days`,
          order_id: orderRes.orderId,
          handler: async (response: any) => {
            await paymentsApi.verify({
              paymentId: orderRes.paymentId,
              razorpayPaymentId: response.razorpay_payment_id,
              signature: response.razorpay_signature,
            });
            toast.success(`${pkg.name} activated! 💪`);
            fetchMyPlans();
          },
          theme: { color: '#8b5cf6' },
        });
        rzp.open();
      } else {
        toast.error('Razorpay not loaded');
      }
    } catch (e: any) {
      toast.error(e.response?.data?.message ?? 'Purchase failed');
    }
    setBuyingId(null);
  };

  const purchasedPlanIds = new Set(assignments.map((a: any) => a.workoutPlanId ?? a.workoutPlan?.id));

  return (
    <div className="space-y-6 animate-slide-up">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight">Workout Plans</h1>
        <p className="text-muted-foreground mt-0.5">Your personalized fitness programs</p>
      </div>

      {/* AI Generator */}
      <div className="relative overflow-hidden rounded-2xl border border-orange-200/60 dark:border-orange-800/40 bg-gradient-to-br from-orange-50 to-amber-50/50 dark:from-orange-950/30 dark:to-amber-950/20">
        <div className="absolute top-0 right-0 w-48 h-48 rounded-full bg-orange-400/10 blur-3xl" />
        <div className="absolute bottom-0 left-0 w-32 h-32 rounded-full bg-amber-400/10 blur-2xl" />
        <div className="relative z-10 p-6">
          <div className="flex items-start gap-4 flex-wrap">
            <div className="w-14 h-14 gradient-brand rounded-2xl flex items-center justify-center shadow-brand shrink-0">
              <Zap className="w-7 h-7 text-white" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <h3 className="font-extrabold text-xl">AI Workout Generator</h3>
                <span className="text-xs font-bold bg-orange-200 text-orange-800 dark:bg-orange-900/50 dark:text-orange-300 px-2 py-0.5 rounded-full">FREE</span>
              </div>
              <p className="text-sm text-muted-foreground mb-5">Get a personalized workout plan powered by AI in seconds</p>
              <div className="flex flex-wrap gap-3 items-end">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-muted-foreground uppercase tracking-wide">Goal</label>
                  <select value={goal} onChange={e => setGoal(e.target.value)}
                    className="h-10 px-3 rounded-xl border border-border bg-card text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all">
                    {['Weight Loss', 'Muscle Gain', 'Body Recomposition', 'Strength Gain', 'Endurance', 'General Fitness'].map(g => <option key={g}>{g}</option>)}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-muted-foreground uppercase tracking-wide">Level</label>
                  <select value={level} onChange={e => setLevel(e.target.value)}
                    className="h-10 px-3 rounded-xl border border-border bg-card text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all">
                    {['BEGINNER', 'INTERMEDIATE', 'ADVANCED'].map(l => <option key={l} value={l}>{l}</option>)}
                  </select>
                </div>
                <button onClick={generateAi} disabled={generating}
                  className="h-10 px-6 rounded-xl gradient-brand text-white font-bold text-sm shadow-brand hover:opacity-90 transition-all disabled:opacity-70 flex items-center gap-2">
                  {generating ? (
                    <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />Generating…</>
                  ) : (
                    <><Zap className="w-4 h-4" />Generate Plan</>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Premium Packages */}
      {packages.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-4">
            <ShoppingBag className="w-5 h-5 text-purple-500" />
            <h2 className="font-extrabold text-lg">Premium Workout Packages</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
            {packages.map((pkg: any) => {
              const purchased = purchasedPlanIds.has(pkg.id);
              return (
                <div key={pkg.id} className="bg-card border border-border/60 rounded-2xl overflow-hidden hover:shadow-lifted hover:-translate-y-1 transition-all duration-300">
                  <div className="gradient-purple p-5 relative overflow-hidden">
                    <div className="absolute -top-6 -right-6 w-20 h-20 rounded-full bg-white/10 pointer-events-none"/>
                    <div className="relative">
                      <p className="text-white font-extrabold text-base">{pkg.name}</p>
                      <p className="text-white/70 text-xs mt-0.5">{pkg.goal} · {pkg.difficulty} · {pkg.durationDays ?? 30} days access</p>
                      <p className="text-2xl font-extrabold text-white mt-2">₹{pkg.price?.toLocaleString()}</p>
                    </div>
                  </div>
                  <div className="p-4 space-y-3">
                    {pkg.description && <p className="text-sm text-muted-foreground line-clamp-2">{pkg.description}</p>}
                    <div className="flex flex-wrap gap-2">
                      <span className="text-xs px-2 py-1 bg-muted rounded-lg">{pkg.durationWeeks ?? 4} weeks program</span>
                      <span className="text-xs px-2 py-1 bg-muted rounded-lg">{goalIcons[pkg.goal] ?? '💪'} {pkg.goal}</span>
                    </div>
                    {purchased ? (
                      <div className="flex items-center gap-2 py-2.5 px-4 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 rounded-xl text-sm font-bold">
                        <CheckCircle className="w-4 h-4" />Active
                      </div>
                    ) : (
                      <button
                        onClick={() => buyPackage(pkg)}
                        disabled={buyingId === pkg.id}
                        className="w-full py-2.5 rounded-xl gradient-purple text-white font-bold text-sm flex items-center justify-center gap-2 hover:opacity-90 disabled:opacity-60 transition-all">
                        {buyingId === pkg.id
                          ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"/>Processing…</>
                          : <><CreditCard className="w-4 h-4"/>Buy Now</>}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* My Plans */}
      <div>
        {assignments.length > 0 && <h2 className="font-extrabold text-lg mb-4">My Active Plans</h2>}
        {assignments.length === 0 ? (
          <div className="bg-card border border-dashed border-border rounded-2xl p-16 text-center text-muted-foreground">
            <Dumbbell className="w-16 h-16 mx-auto mb-4 opacity-20" />
            <p className="font-bold text-lg">No workout plans yet</p>
            <p className="text-sm mt-1">Use the AI generator above or purchase a premium package</p>
          </div>
        ) : (
          <div className="space-y-4">
            {assignments.map((assignment: any) => {
              const plan = assignment.workoutPlan ?? assignment;
              const isExpanded = expanded === assignment.id;
              const exercises = Array.isArray(plan.exercises) ? plan.exercises : [];
              return (
                <div key={assignment.id} className={cn('bg-card border border-border/60 rounded-2xl overflow-hidden transition-all duration-300', isExpanded ? 'shadow-lifted' : 'hover:shadow-card')}>
                  <button onClick={() => setExpanded(isExpanded ? null : assignment.id)} className="w-full text-left">
                    <div className="p-5 flex items-center gap-4">
                      <div className="w-14 h-14 gradient-brand rounded-2xl flex items-center justify-center text-2xl shadow-brand shrink-0">
                        {goalIcons[plan.goal] ?? '💪'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <h3 className="font-bold text-base">{plan.name}</h3>
                          {plan.isAiGenerated && (
                            <span className="text-xs font-bold bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400 px-2 py-0.5 rounded-full flex items-center gap-1">
                              <Zap className="w-2.5 h-2.5" /> AI
                            </span>
                          )}
                          {plan.isPremium && (
                            <span className="text-xs font-bold bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400 px-2 py-0.5 rounded-full">
                              Premium
                            </span>
                          )}
                          <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${levelColors[plan.difficulty] ?? 'bg-muted text-muted-foreground'}`}>
                            {plan.difficulty}
                          </span>
                        </div>
                        <div className="flex items-center gap-4 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1"><Target className="w-3 h-3" /> {plan.goal}</span>
                          <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {plan.durationWeeks ?? 4} weeks</span>
                          <span className="flex items-center gap-1"><BarChart2 className="w-3 h-3" /> {exercises.length} exercises</span>
                        </div>
                      </div>
                      <div className={cn('w-8 h-8 rounded-xl border border-border flex items-center justify-center transition-transform', isExpanded && 'rotate-90')}>
                        <ChevronRight className="w-4 h-4 text-muted-foreground" />
                      </div>
                    </div>
                  </button>

                  {isExpanded && exercises.length > 0 && (
                    <div className="px-5 pb-5 border-t border-border/50 pt-4">
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                        {exercises.map((ex: any, i: number) => (
                          <div key={i} className="relative bg-muted/50 rounded-xl p-4 hover:bg-muted transition-colors overflow-hidden">
                            <div className="absolute top-0 left-0 w-1 h-full gradient-brand" />
                            <p className="text-xs font-bold text-primary uppercase tracking-wide mb-1">{ex.day}</p>
                            <p className="font-bold text-sm">{ex.name}</p>
                            <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                              <span className="font-semibold text-foreground">{ex.sets} sets</span>
                              <span>×</span>
                              <span className="font-semibold text-foreground">{ex.reps} reps</span>
                              {ex.rest && <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{ex.rest}s rest</span>}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
