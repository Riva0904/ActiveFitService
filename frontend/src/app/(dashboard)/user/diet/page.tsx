'use client';

import { useEffect, useState } from 'react';
import { Utensils, Zap, Plus, Flame, Apple, Clock, ShoppingBag, CreditCard, CheckCircle } from 'lucide-react';
import { dietPlansApi, paymentsApi } from '@/lib/api';
import toast from 'react-hot-toast';
import { cn } from '@/lib/utils';

const mealConfig = [
  { meal: 'Breakfast', emoji: '🌅', color: 'gradient-blue', time: '7:00 AM', bg: 'bg-blue-50 dark:bg-blue-900/10' },
  { meal: 'Lunch', emoji: '☀️', color: 'gradient-green', time: '1:00 PM', bg: 'bg-green-50 dark:bg-green-900/10' },
  { meal: 'Snack', emoji: '🍎', color: 'gradient-brand', time: '4:00 PM', bg: 'bg-orange-50 dark:bg-orange-900/10' },
  { meal: 'Dinner', emoji: '🌙', color: 'gradient-purple', time: '8:00 PM', bg: 'bg-purple-50 dark:bg-purple-900/10' },
];

export default function DietPage() {
  const [plans, setPlans] = useState<any[]>([]);
  const [generating, setGenerating] = useState(false);
  const [goal, setGoal] = useState('Weight Loss');
  const [calories, setCalories] = useState(2000);
  const [activePlan, setActivePlan] = useState<any | null>(null);
  const [packages, setPackages] = useState<any[]>([]);
  const [buyingId, setBuyingId] = useState<string | null>(null);

  useEffect(() => {
    dietPlansApi.getMyPlans()
      .then((res: any) => {
        const p = Array.isArray(res) ? res.map((a: any) => a.dietPlan ?? a) : [];
        setPlans(p);
        if (p.length > 0) setActivePlan(p[0]);
      }).catch(() => {});
    dietPlansApi.getPackages().then((r: any) => setPackages(Array.isArray(r) ? r : r.data ?? [])).catch(() => {});
  }, []);

  const buyPackage = async (pkg: any) => {
    setBuyingId(pkg.id);
    try {
      const orderRes: any = await dietPlansApi.buyPackage(pkg.id);
      if (typeof window !== 'undefined' && (window as any).Razorpay) {
        const rzp = new (window as any).Razorpay({
          key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
          amount: orderRes.amount * 100,
          currency: 'INR',
          name: 'ActiveFit',
          description: `${pkg.name} — ${pkg.durationDays ?? 30} days`,
          order_id: orderRes.orderId,
          handler: async (response: any) => {
            await paymentsApi.verify({ paymentId: orderRes.paymentId, razorpayPaymentId: response.razorpay_payment_id, signature: response.razorpay_signature });
            toast.success(`${pkg.name} activated!`);
            dietPlansApi.getMyPlans().then((res: any) => { const p = Array.isArray(res) ? res.map((a: any) => a.dietPlan ?? a) : []; setPlans(p); if (p.length) setActivePlan(p[0]); }).catch(() => {});
          },
          theme: { color: '#f97316' },
        });
        rzp.open();
      } else { toast.error('Razorpay not loaded'); }
    } catch (e: any) { toast.error(e.response?.data?.message ?? 'Purchase failed'); }
    setBuyingId(null);
  };

  const generateAi = async () => {
    setGenerating(true);
    try {
      const plan: any = await dietPlansApi.generateAi({ goal, calories });
      setPlans(prev => [plan, ...prev]);
      setActivePlan(plan);
      toast.success('AI diet plan created! 🥗');
    } catch { }
    setGenerating(false);
  };

  const totalCalories = activePlan?.meals?.reduce((a: number, m: any) => a + (m.calories ?? 0), 0) ?? 0;

  return (
    <div className="space-y-6 animate-slide-up">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">Diet Plans</h1>
          <p className="text-muted-foreground mt-0.5">Nutrition plans tailored to your goals</p>
        </div>
        <button className="flex items-center gap-2 px-5 py-2.5 rounded-xl gradient-green shadow-green text-white font-bold text-sm hover:opacity-90 transition-all">
          <Plus className="w-4 h-4" /> Custom Plan
        </button>
      </div>

      {/* AI Generator */}
      <div className="relative overflow-hidden rounded-2xl border border-emerald-200/60 dark:border-emerald-800/40 bg-gradient-to-br from-emerald-50 to-teal-50/50 dark:from-emerald-950/30 dark:to-teal-950/20">
        <div className="absolute -top-10 right-10 w-40 h-40 rounded-full bg-emerald-400/10 blur-3xl" />
        <div className="relative z-10 p-6">
          <div className="flex items-start gap-4 flex-wrap">
            <div className="w-14 h-14 gradient-green rounded-2xl flex items-center justify-center shrink-0 shadow-green">
              <Zap className="w-7 h-7 text-white" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <h3 className="font-extrabold text-xl">AI Nutrition Generator</h3>
                <span className="text-xs font-bold bg-emerald-200 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300 px-2 py-0.5 rounded-full">SMART</span>
              </div>
              <p className="text-sm text-muted-foreground mb-5">Get a balanced meal plan based on your calorie goals and fitness target</p>
              <div className="flex flex-wrap gap-3 items-end">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-muted-foreground uppercase tracking-wide">Goal</label>
                  <select value={goal} onChange={e => setGoal(e.target.value)}
                    className="h-10 px-3 rounded-xl border border-border bg-card text-sm font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500/20 transition-all">
                    {['Weight Loss', 'Muscle Gain', 'Maintenance', 'Endurance'].map(g => <option key={g}>{g}</option>)}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-muted-foreground uppercase tracking-wide">Daily Calories</label>
                  <div className="flex items-center gap-2">
                    <input type="number" value={calories} onChange={e => setCalories(+e.target.value)}
                      className="w-24 h-10 px-3 rounded-xl border border-border bg-card text-sm font-bold text-center focus:outline-none focus:ring-2 focus:ring-emerald-500/20 transition-all" />
                    <span className="text-sm text-muted-foreground font-medium">kcal</span>
                  </div>
                </div>
                <button onClick={generateAi} disabled={generating}
                  className="h-10 px-6 rounded-xl gradient-green shadow-green text-white font-bold text-sm hover:opacity-90 transition-all disabled:opacity-70 flex items-center gap-2">
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

      {plans.length === 0 ? (
        <div className="bg-card border border-dashed border-border rounded-2xl p-16 text-center text-muted-foreground">
          <Utensils className="w-16 h-16 mx-auto mb-4 opacity-20" />
          <p className="font-bold text-lg">No diet plans yet</p>
          <p className="text-sm mt-1">Generate your first AI plan above</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
          {/* Plan selector */}
          <div className="space-y-3">
            <h3 className="font-bold text-sm text-muted-foreground uppercase tracking-wide">My Plans</h3>
            {plans.map((plan: any) => (
              <button key={plan.id} onClick={() => setActivePlan(plan)}
                className={cn('w-full text-left p-4 rounded-2xl border transition-all', activePlan?.id === plan.id ? 'border-primary/40 bg-primary/5 shadow-brand' : 'border-border bg-card hover:bg-muted/50')}>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 gradient-green rounded-xl flex items-center justify-center text-white text-lg shrink-0">🥗</div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold truncate text-sm">{plan.title}</p>
                    <p className="text-xs text-muted-foreground">{plan.goal} · {plan.calories} kcal</p>
                  </div>
                  {plan.isAiGenerated && <Zap className="w-3.5 h-3.5 text-primary shrink-0" />}
                </div>
              </button>
            ))}
          </div>

          {/* Active plan meals */}
          {activePlan && (
            <div className="xl:col-span-2 space-y-3">
              {/* Calorie summary */}
              <div className="grid grid-cols-3 gap-3 mb-4">
                {[
                  { label: 'Target', value: `${activePlan.calories} kcal`, icon: Target, color: 'gradient-green' },
                  { label: 'Meals', value: activePlan.meals?.length ?? 0, icon: Utensils, color: 'gradient-blue' },
                  { label: 'Planned', value: `${totalCalories} kcal`, icon: Flame, color: 'gradient-brand' },
                ].map(({ label, value, icon: Icon, color }) => (
                  <div key={label} className="bg-card border border-border/60 rounded-2xl p-4 text-center">
                    <div className={`w-8 h-8 ${color} rounded-xl flex items-center justify-center text-white mx-auto mb-2`}>
                      <Icon className="w-4 h-4" />
                    </div>
                    <p className="font-extrabold text-lg">{value}</p>
                    <p className="text-xs text-muted-foreground">{label}</p>
                  </div>
                ))}
              </div>

              {/* Meals */}
              {Array.isArray(activePlan.meals) && activePlan.meals.map((meal: any, i: number) => {
                const config = mealConfig.find(m => m.meal === meal.meal) ?? mealConfig[i % mealConfig.length];
                return (
                  <div key={i} className={`${config.bg} border border-border/40 rounded-2xl p-5 hover:shadow-card transition-all`}>
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div className={`w-11 h-11 ${config.color} rounded-2xl flex items-center justify-center text-xl shadow-sm`}>
                          {config.emoji}
                        </div>
                        <div>
                          <p className="font-bold">{meal.meal}</p>
                          <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Clock className="w-3 h-3" /> {config.time}
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-extrabold text-xl text-primary">{meal.calories}</p>
                        <p className="text-xs text-muted-foreground">kcal</p>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {meal.items?.map((item: string, j: number) => (
                        <span key={j} className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 bg-card border border-border/60 rounded-xl">
                          <Apple className="w-3 h-3 text-muted-foreground" /> {item}
                        </span>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Premium Diet Packages */}
      {packages.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <ShoppingBag className="w-5 h-5 text-primary"/>
            <h2 className="text-lg font-extrabold">Premium Diet Plans</h2>
            <span className="text-xs font-bold bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300 px-2 py-0.5 rounded-full">PREMIUM</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
            {packages.map((pkg: any) => (
              <div key={pkg.id} className="bg-card border border-border/60 rounded-2xl overflow-hidden hover:shadow-lifted hover:-translate-y-1 transition-all duration-300">
                <div className="gradient-purple p-5 relative overflow-hidden">
                  <div className="absolute -top-6 -right-6 w-20 h-20 rounded-full bg-white/10 pointer-events-none"/>
                  <div className="relative">
                    <p className="text-white font-extrabold text-lg">{pkg.name}</p>
                    <p className="text-white/70 text-xs mt-0.5">{pkg.goal} · {pkg.durationDays ?? 30} days</p>
                    <p className="text-white font-extrabold text-2xl mt-2">₹{pkg.price?.toLocaleString()}</p>
                  </div>
                </div>
                <div className="p-4 space-y-3">
                  {pkg.description && <p className="text-sm text-muted-foreground">{pkg.description}</p>}
                  {pkg.totalCalories && (
                    <div className="flex items-center gap-2 text-sm">
                      <Flame className="w-4 h-4 text-orange-500"/>
                      <span className="font-medium">{pkg.totalCalories} kcal / day</span>
                    </div>
                  )}
                  <button
                    onClick={() => buyPackage(pkg)}
                    disabled={buyingId === pkg.id}
                    className="w-full py-2.5 rounded-xl gradient-purple text-white font-bold text-sm flex items-center justify-center gap-2 hover:opacity-90 disabled:opacity-60 transition-all"
                  >
                    {buyingId === pkg.id ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"/> : <CreditCard className="w-4 h-4"/>}
                    {buyingId === pkg.id ? 'Processing…' : `Buy for ₹${pkg.price?.toLocaleString()}`}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function Target({ className }: { className?: string }) {
  return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>;
}
