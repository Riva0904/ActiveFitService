'use client';

import { useEffect, useState } from 'react';
import { Star, Calendar, CreditCard, RefreshCw, CheckCircle, AlertTriangle, Clock, Tag, Loader2, Gift, X } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { membershipsApi, paymentsApi, promoCodesApi, referralsApi, membershipPlansApi } from '@/lib/api';
import { formatDate, formatCurrency, daysUntil, getMembershipBadgeColor } from '@/lib/utils';
import { useAuthStore } from '@/store/authStore';
import { cn } from '@/lib/utils';
import toast from 'react-hot-toast';

const FALLBACK_PRICES: Record<string, number> = {
  MONTHLY: 2000, QUARTERLY: 5400, HALF_YEARLY: 10000, YEARLY: 18000,
};
const FALLBACK_LABELS: Record<string, string> = {
  MONTHLY: '1 Month', QUARTERLY: '3 Months', HALF_YEARLY: '6 Months', YEARLY: '1 Year',
};

export default function UserMembershipPage() {
  const { user } = useAuthStore();
  const [memberships, setMemberships] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [renewing, setRenewing] = useState<string | null>(null);
  const [purchasing, setPurchasing] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);
  const [promoCode, setPromoCode] = useState('');
  const [promoApplied, setPromoApplied] = useState<any>(null);
  const [promoLoading, setPromoLoading] = useState(false);
  const [referralInfo, setReferralInfo] = useState<any>(null);
  const [useReferralCredit, setUseReferralCredit] = useState(false);
  const [gymPlans, setGymPlans] = useState<any[]>([]);

  useEffect(() => {
    membershipsApi.getAll({ limit: 10 })
      .then((res: any) => setMemberships(res.data ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
    referralsApi.getMyInfo().then((data: any) => setReferralInfo(data)).catch(() => {});
    membershipPlansApi.getAll().then((r: any) => setGymPlans((r.data ?? r ?? []).filter((p:any)=>p.isActive))).catch(() => {});
  }, []);

  const getPrice = (type: string) => gymPlans.find(p=>p.type===type)?.price ?? FALLBACK_PRICES[type] ?? 0;
  const getPlanId = (type: string) => gymPlans.find(p=>p.type===type)?.id;
  const getLabel = (type: string, durationMonths?: number) => {
    if (durationMonths) return `${durationMonths} Month${durationMonths !== 1 ? 's' : ''}`;
    return FALLBACK_LABELS[type] ?? type;
  };
  const displayPlans = gymPlans.length > 0 ? gymPlans : Object.keys(FALLBACK_PRICES).map(type => ({ type, price: FALLBACK_PRICES[type], name: FALLBACK_LABELS[type] }));

  const applyPromo = async () => {
    if (!promoCode.trim() || !selectedPlan) return;
    setPromoLoading(true);
    try {
      const res: any = await promoCodesApi.validate(promoCode.trim(), getPrice(selectedPlan));
      if (res.valid) {
        setPromoApplied(res);
        toast.success(`Promo applied! You save ₹${res.discountAmount.toFixed(0)}`);
      } else {
        toast.error(res.reason ?? 'Invalid promo code');
        setPromoApplied(null);
      }
    } catch { setPromoApplied(null); }
    finally { setPromoLoading(false); }
  };

  const clearPromo = () => { setPromoCode(''); setPromoApplied(null); };

  const activeMembership = memberships.find(m => m.status === 'ACTIVE');
  const daysLeft = activeMembership ? daysUntil(activeMembership.endDate) : null;

  const handleRenew = async (id: string) => {
    setRenewing(id);
    try {
      await membershipsApi.renew(id);
      toast.success('Membership renewed successfully!');
      const res: any = await membershipsApi.getAll({ limit: 10 });
      setMemberships(res.data ?? []);
    } catch { }
    setRenewing(null);
  };

  const handlePurchase = async () => {
    if (!selectedPlan || !user?.gymId) return;
    setPurchasing(true);
    try {
      const price = getPrice(selectedPlan);
      const planId = getPlanId(selectedPlan);
      const referralCreditToApply = useReferralCredit ? Math.min(referralInfo?.referralCredit ?? 0, price) : undefined;
      const orderRes: any = await paymentsApi.createOrder({
        amount: price,
        type: 'MEMBERSHIP',
        membershipPlanId: planId,
        promoCode: promoApplied ? promoCode.trim() : undefined,
        referralCreditToApply,
      });

      // Open Razorpay
      if (typeof window !== 'undefined' && (window as any).Razorpay) {
        const rzp = new (window as any).Razorpay({
          key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
          amount: orderRes.amount * 100,
          currency: 'INR',
          name: 'ActiveFit',
          description: `${getLabel(selectedPlan)} Membership`,
          order_id: orderRes.orderId,
          handler: async (response: any) => {
            await paymentsApi.verify({
              paymentId: orderRes.paymentId,
              razorpayPaymentId: response.razorpay_payment_id,
              signature: response.razorpay_signature,
            });
            toast.success('Payment successful! Membership activated.');
            setSelectedPlan(null);
            const res: any = await membershipsApi.getAll({ limit: 10 });
            setMemberships(res.data ?? []);
          },
          theme: { color: '#f97316' },
        });
        rzp.open();
      } else {
        toast.error('Razorpay not loaded. Please refresh.');
      }
    } catch { }
    setPurchasing(false);
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold">My Membership</h1>
        <p className="text-muted-foreground">Manage your gym membership</p>
      </div>

      {/* Active membership card */}
      {loading ? (
        <div className="h-48 bg-muted/50 rounded-xl animate-pulse" />
      ) : activeMembership ? (
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-orange-500 to-orange-700 p-6 text-white shadow-xl shadow-orange-500/30">
          <div className="absolute top-0 right-0 w-40 h-40 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2" />
          <div className="relative z-10">
            <div className="flex items-center gap-2 mb-1">
              <Star className="w-4 h-4" />
              <span className="text-sm font-medium opacity-90">Active Membership</span>
            </div>
            <h2 className="text-3xl font-extrabold">{activeMembership.type} Plan</h2>
            <p className="text-orange-100 mt-1">{formatCurrency(activeMembership.price)}</p>

            <div className="grid grid-cols-2 gap-4 mt-6">
              <div>
                <p className="text-orange-200 text-xs">Start Date</p>
                <p className="font-semibold">{formatDate(activeMembership.startDate, user?.timezone)}</p>
              </div>
              <div>
                <p className="text-orange-200 text-xs">Expiry Date</p>
                <p className="font-semibold">{formatDate(activeMembership.endDate, user?.timezone)}</p>
              </div>
            </div>

            {daysLeft !== null && (
              <div className={`mt-4 flex items-center gap-2 px-4 py-2.5 rounded-xl ${
                daysLeft <= 7 ? 'bg-red-900/40' : 'bg-black/20'
              }`}>
                {daysLeft <= 7 ? <AlertTriangle className="w-4 h-4" /> : <Clock className="w-4 h-4" />}
                <span className="text-sm font-medium">
                  {daysLeft <= 0 ? 'Membership expired' : `${daysLeft} day${daysLeft === 1 ? '' : 's'} remaining`}
                </span>
              </div>
            )}

            <Button
              className="mt-4 bg-white text-orange-600 hover:bg-orange-50 font-bold gap-2"
              onClick={() => handleRenew(activeMembership.id)}
              loading={renewing === activeMembership.id}
            >
              <RefreshCw className="w-4 h-4" />
              Renew Membership
            </Button>
          </div>
        </div>
      ) : (
        <Card className="border-2 border-dashed border-orange-200 dark:border-orange-800 bg-orange-50/50 dark:bg-orange-950/10">
          <CardContent className="pt-8 pb-8 text-center">
            <Star className="w-14 h-14 mx-auto mb-3 text-orange-300" />
            <h3 className="text-lg font-bold mb-1">No Active Membership</h3>
            <p className="text-muted-foreground text-sm mb-6">Choose a plan below to get started</p>
          </CardContent>
        </Card>
      )}

      {/* Plan selector */}
      <div>
        <h2 className="text-lg font-bold mb-4">
          {activeMembership ? 'Upgrade or Renew' : 'Choose a Plan'}
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {displayPlans.map((p: any) => {
            const isSelected = selectedPlan === p.type;
            const isCurrent = activeMembership?.type === p.type;
            const months = p.durationMonths ?? (p.type === 'MONTHLY' ? 1 : p.type === 'QUARTERLY' ? 3 : p.type === 'HALF_YEARLY' ? 6 : 12);
            return (
              <button
                key={p.type}
                onClick={() => setSelectedPlan(isSelected ? null : p.type)}
                className={[
                  'p-5 rounded-xl border-2 text-left transition-all w-full',
                  isSelected ? 'border-primary bg-primary/5 shadow-sm' : 'border-border bg-card hover:border-primary/50',
                ].join(' ')}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="font-bold text-base">{p.name ?? getLabel(p.type, months)}</span>
                  {isCurrent && <Badge variant="success" className="text-xs">Current</Badge>}
                  {isSelected && !isCurrent && <CheckCircle className="w-5 h-5 text-primary" />}
                </div>
                <p className="text-2xl font-extrabold">{formatCurrency(p.price)}</p>
                {p.discount > 0 && <p className="text-xs text-green-600 font-semibold">{p.discount}% off</p>}
                <p className="text-xs text-muted-foreground mt-1">
                  {formatCurrency(Math.round(p.price / months))} / month
                </p>
              </button>
            );
          })}
        </div>

        {selectedPlan && (
          <div className="mt-4 space-y-3">
            {/* Promo Code */}
            <div className="p-4 bg-card border border-border rounded-xl space-y-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5"><Tag className="w-3.5 h-3.5" /> Have a Promo Code?</p>
              {promoApplied ? (
                <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
                  <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0" />
                  <span className="text-sm font-medium text-green-700 flex-1">{promoCode.toUpperCase()} — ₹{promoApplied.discountAmount?.toFixed(0)} off</span>
                  <button onClick={clearPromo} className="text-green-600 hover:text-green-800"><X className="w-3.5 h-3.5" /></button>
                </div>
              ) : (
                <div className="flex gap-2">
                  <input
                    value={promoCode}
                    onChange={e => setPromoCode(e.target.value.toUpperCase())}
                    placeholder="Enter code (e.g. SAVE20)"
                    className="flex-1 border border-border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-brand/30 uppercase"
                    onKeyDown={e => e.key === 'Enter' && applyPromo()}
                  />
                  <button
                    onClick={applyPromo}
                    disabled={!promoCode.trim() || promoLoading}
                    className="px-4 py-2 text-sm font-bold bg-brand text-white rounded-lg hover:opacity-90 disabled:opacity-50 flex items-center gap-1.5"
                  >
                    {promoLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                    Apply
                  </button>
                </div>
              )}
            </div>

            {/* Referral Credit */}
            {(referralInfo?.referralCredit ?? 0) > 0 && (
              <div className="p-4 bg-card border border-border rounded-xl">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Gift className="w-4 h-4 text-brand" />
                    <div>
                      <p className="text-sm font-semibold">Use Referral Credit</p>
                      <p className="text-xs text-muted-foreground">₹{referralInfo.referralCredit.toFixed(0)} available</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setUseReferralCredit(!useReferralCredit)}
                    className={cn(
                      'relative inline-flex h-5 w-9 items-center rounded-full transition-colors',
                      useReferralCredit ? 'bg-brand' : 'bg-muted'
                    )}
                  >
                    <span className={cn('inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform', useReferralCredit ? 'translate-x-4' : 'translate-x-0.5')} />
                  </button>
                </div>
              </div>
            )}

            {/* Summary & Pay */}
            <div className="p-4 bg-primary/5 border border-primary/20 rounded-xl">
              <div className="space-y-1.5 mb-3">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">{getLabel(selectedPlan)} Membership</span>
                  <span>{formatCurrency(getPrice(selectedPlan))}</span>
                </div>
                {promoApplied && (
                  <div className="flex justify-between text-sm text-green-700">
                    <span>Promo ({promoCode.toUpperCase()})</span>
                    <span>-₹{promoApplied.discountAmount?.toFixed(0)}</span>
                  </div>
                )}
                {useReferralCredit && (referralInfo?.referralCredit ?? 0) > 0 && (
                  <div className="flex justify-between text-sm text-green-700">
                    <span>Referral Credit</span>
                    <span>-₹{Math.min(referralInfo.referralCredit, getPrice(selectedPlan)).toFixed(0)}</span>
                  </div>
                )}
                <div className="flex justify-between font-bold border-t border-primary/20 pt-1.5 mt-1.5">
                  <span>Total</span>
                  <span>
                    {formatCurrency(Math.max(
                      getPrice(selectedPlan)
                        - (promoApplied?.discountAmount ?? 0)
                        - (useReferralCredit ? Math.min(referralInfo?.referralCredit ?? 0, getPrice(selectedPlan)) : 0),
                      1
                    ))}
                  </span>
                </div>
              </div>
              <Button variant="brand" className="w-full" onClick={handlePurchase} loading={purchasing}>
                <CreditCard className="w-4 h-4 mr-2" /> Pay Now
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Membership history */}
      {memberships.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-base">Membership History</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-2">
              {memberships.map((m: any) => (
                <div key={m.id} className="flex items-center gap-3 p-3 rounded-lg bg-muted/40">
                  <Calendar className="w-4 h-4 text-muted-foreground shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{m.type}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatDate(m.startDate, user?.timezone)} — {formatDate(m.endDate, user?.timezone)}
                    </p>
                  </div>
                  <div className="text-right">
                    <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${getMembershipBadgeColor(m.status)}`}>
                      {m.status}
                    </span>
                    <p className="text-xs text-muted-foreground mt-1">{formatCurrency(m.price)}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
