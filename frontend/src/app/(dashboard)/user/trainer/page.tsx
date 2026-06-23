'use client';

import { useEffect, useState } from 'react';
import { Dumbbell, Star, Phone, Mail, Award, Calendar, X, Clock, CheckCircle, CreditCard } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ptSessionsApi, paymentsApi } from '@/lib/api';
import { formatDateTime, getInitials } from '@/lib/utils';
import { cn } from '@/lib/utils';
import toast from 'react-hot-toast';

const DURATIONS = [
  { label: '30 min', value: 30 },
  { label: '45 min', value: 45 },
  { label: '60 min', value: 60 },
  { label: '90 min', value: 90 },
];

function BookingModal({ trainer, onClose, onSuccess }: any) {
  const user = trainer.user;
  const [form, setForm] = useState({ scheduledAt: '', duration: 60, title: '', notes: '' });
  const [booking, setBooking] = useState(false);

  const price = trainer.hourlyRate ? Math.round(trainer.hourlyRate * (form.duration / 60)) : 0;

  const book = async () => {
    if (!form.scheduledAt) { toast.error('Please select date & time'); return; }
    setBooking(true);
    try {
      const res: any = await ptSessionsApi.book({
        trainerId: trainer.id,
        scheduledAt: new Date(form.scheduledAt).toISOString(),
        duration: form.duration,
        title: form.title || null,
        notes: form.notes || null,
      });

      if (res.payment && price > 0) {
        if (typeof window !== 'undefined' && (window as any).Razorpay) {
          const rzp = new (window as any).Razorpay({
            key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
            amount: res.payment.amount * 100,
            currency: 'INR',
            name: 'ActiveFit',
            description: `PT Session with ${user.firstName} — ${form.duration} min`,
            order_id: res.payment.orderId,
            handler: async (response: any) => {
              await paymentsApi.verify({
                paymentId: res.payment.paymentId,
                razorpayPaymentId: response.razorpay_payment_id,
                signature: response.razorpay_signature,
              });
              toast.success('Session booked & payment confirmed!');
              onSuccess();
              onClose();
            },
            theme: { color: '#f97316' },
          });
          rzp.open();
        } else {
          toast.error('Razorpay not loaded');
        }
      } else {
        toast.success('Session booked!');
        onSuccess();
        onClose();
      }
    } catch (e: any) { toast.error(e.response?.data?.message ?? 'Booking failed'); }
    setBooking(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-card border border-border rounded-3xl shadow-2xl w-full max-w-md animate-pop overflow-hidden">
        <div className="gradient-brand p-5 relative overflow-hidden">
          <div className="absolute -top-8 -right-8 w-28 h-28 rounded-full bg-white/10 pointer-events-none"/>
          <div className="relative flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center text-white font-extrabold text-lg">{getInitials(user.firstName, user.lastName)}</div>
              <div><h2 className="font-extrabold text-xl text-white">Book Session</h2><p className="text-sm text-white/70">with {user.firstName} {user.lastName}</p></div>
            </div>
            <button onClick={onClose} className="w-8 h-8 rounded-xl bg-white/20 hover:bg-white/30 flex items-center justify-center text-white"><X className="w-4 h-4"/></button>
          </div>
        </div>
        <div className="p-6 space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-muted-foreground uppercase tracking-wide">Date & Time *</label>
            <input type="datetime-local" value={form.scheduledAt} onChange={e=>setForm(f=>({...f,scheduledAt:e.target.value}))} min={new Date().toISOString().slice(0,16)} className="w-full h-10 px-3 text-sm bg-muted/50 border border-border/60 rounded-xl outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/10 transition-all"/>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-muted-foreground uppercase tracking-wide">Duration</label>
            <div className="grid grid-cols-4 gap-2">
              {DURATIONS.map(d=>(
                <button key={d.value} onClick={()=>setForm(f=>({...f,duration:d.value}))} className={cn('py-2 rounded-xl text-xs font-bold border transition-all',form.duration===d.value?'gradient-brand text-white border-transparent':'border-border bg-card hover:bg-muted')}>
                  {d.label}
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-muted-foreground uppercase tracking-wide">Session Title (optional)</label>
            <input value={form.title} onChange={e=>setForm(f=>({...f,title:e.target.value}))} placeholder="e.g. Upper Body Strength" className="w-full h-10 px-3 text-sm bg-muted/50 border border-border/60 rounded-xl outline-none focus:border-primary/40 transition-all"/>
          </div>
          {price > 0 && (
            <div className="p-3.5 bg-orange-50 dark:bg-orange-950/20 border border-orange-200 dark:border-orange-800/50 rounded-xl flex items-center justify-between">
              <div className="flex items-center gap-2"><CreditCard className="w-4 h-4 text-orange-600"/><div><p className="text-xs font-bold text-orange-700">Session Cost</p><p className="text-xs text-orange-600/80">₹{trainer.hourlyRate}/hr × {form.duration} min</p></div></div>
              <p className="text-lg font-extrabold text-orange-700">₹{price.toLocaleString()}</p>
            </div>
          )}
        </div>
        <div className="flex gap-3 p-5 border-t border-border">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-border hover:bg-muted text-sm font-medium">Cancel</button>
          <button onClick={book} disabled={booking || !form.scheduledAt} className="flex-[2] py-2.5 rounded-xl gradient-brand text-white font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-60">
            {booking ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"/> : <CheckCircle className="w-4 h-4"/>}
            {price > 0 ? `Book & Pay ₹${price.toLocaleString()}` : 'Book Session'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function MyTrainerPage() {
  const [sessions, setSessions] = useState<any[]>([]);
  const [availableTrainers, setAvailableTrainers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [bookingTrainer, setBookingTrainer] = useState<any>(null);

  const fetchSessions = () => {
    ptSessionsApi.getAll({ limit: 10 })
      .then((res: any) => setSessions(res.data ?? []))
      .catch(() => {});
  };

  useEffect(() => {
    Promise.all([
      ptSessionsApi.getAll({ limit: 10 }).catch(() => ({ data: [] })),
      ptSessionsApi.getAvailableTrainers().catch(() => []),
    ]).then(([sessRes, trainers]: any[]) => {
      setSessions(sessRes.data ?? []);
      setAvailableTrainers(Array.isArray(trainers) ? trainers : trainers.data ?? []);
    }).finally(() => setLoading(false));
  }, []);

  const assignedTrainer = sessions[0]?.trainer;

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-48 bg-muted/50 rounded-2xl animate-pulse" />
        <div className="h-32 bg-muted/50 rounded-2xl animate-pulse" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-2xl">
      {bookingTrainer && <BookingModal trainer={bookingTrainer} onClose={()=>setBookingTrainer(null)} onSuccess={()=>{fetchSessions();setBookingTrainer(null);}}/>}

      <div>
        <h1 className="text-2xl font-bold">Trainer Sessions</h1>
        <p className="text-muted-foreground">Book personal training sessions and track your progress</p>
      </div>

      {/* Assigned trainer profile */}
      {assignedTrainer && (
        <Card className="overflow-hidden">
          <div className="gradient-brand h-20 relative">
            <div className="absolute -bottom-8 left-6">
              <div className="w-16 h-16 gradient-brand rounded-2xl border-4 border-card flex items-center justify-center text-white text-xl font-extrabold shadow-xl">
                {getInitials(assignedTrainer.user.firstName, assignedTrainer.user.lastName)}
              </div>
            </div>
          </div>
          <CardContent className="pt-12 pb-5">
            <div className="flex items-start justify-between flex-wrap gap-2">
              <div>
                <h2 className="text-xl font-bold">{assignedTrainer.user.firstName} {assignedTrainer.user.lastName}</h2>
                <p className="text-xs text-muted-foreground mt-0.5">Your assigned trainer</p>
              </div>
              <Badge variant={assignedTrainer.isAvailable ? 'success' : 'secondary'}>
                {assignedTrainer.isAvailable ? 'Available' : 'Busy'}
              </Badge>
            </div>
            <div className="flex gap-3 mt-4">
              <div className="bg-muted/50 rounded-xl px-4 py-2.5 text-center flex-1">
                <p className="font-extrabold">{assignedTrainer.experience ?? 0}+</p>
                <p className="text-xs text-muted-foreground">Yrs Exp</p>
              </div>
              {assignedTrainer.hourlyRate && (
                <div className="bg-muted/50 rounded-xl px-4 py-2.5 text-center flex-1">
                  <p className="font-extrabold">₹{assignedTrainer.hourlyRate}</p>
                  <p className="text-xs text-muted-foreground">Per Hour</p>
                </div>
              )}
            </div>
            {assignedTrainer.isAvailable && (
              <button onClick={()=>setBookingTrainer(assignedTrainer)} className="mt-4 w-full py-2.5 rounded-xl gradient-brand text-white font-bold text-sm hover:opacity-90 transition-all">
                Book a Session
              </button>
            )}
          </CardContent>
        </Card>
      )}

      {/* Available trainers */}
      {availableTrainers.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-lg font-bold">Available Trainers</h2>
          <div className="space-y-3">
            {availableTrainers.map((t: any) => (
              <div key={t.id} className="bg-card border border-border/60 rounded-2xl p-4 hover:shadow-sm transition-all">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 gradient-purple rounded-2xl overflow-hidden flex items-center justify-center text-white font-extrabold text-base shrink-0">
                    {t.user.avatar ? <img src={t.user.avatar} alt="" className="w-full h-full object-cover"/> : getInitials(t.user.firstName, t.user.lastName)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold truncate">{t.user.firstName} {t.user.lastName}</p>
                    <div className="flex items-center gap-1">
                      {Array.from({length:5}).map((_,i)=><Star key={i} className={`w-3 h-3 ${i<Math.round(t.rating??0)?'fill-amber-400 text-amber-400':'text-muted-foreground/20'}`}/>)}
                      <span className="text-xs text-muted-foreground ml-1">{t.experience ?? 0} yrs exp</span>
                    </div>
                    {t.specializations?.length > 0 && <p className="text-xs text-muted-foreground mt-0.5 truncate">{t.specializations.slice(0,3).join(' · ')}</p>}
                  </div>
                  <div className="text-right shrink-0">
                    {t.hourlyRate && <p className="text-sm font-extrabold text-primary">₹{t.hourlyRate}/hr</p>}
                    <button onClick={()=>setBookingTrainer(t)} className="mt-1.5 px-4 py-1.5 text-xs font-bold rounded-xl gradient-brand text-white hover:opacity-90 transition-all">
                      Book
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Sessions list */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Calendar className="w-4 h-4 text-primary"/>
            My PT Sessions
          </CardTitle>
        </CardHeader>
        <CardContent>
          {sessions.length === 0 ? (
            <div className="text-center py-6 text-muted-foreground">
              <Dumbbell className="w-10 h-10 mx-auto mb-2 opacity-30"/>
              <p className="text-sm">No sessions booked yet</p>
              {availableTrainers.length > 0 && <p className="text-xs mt-1">Browse available trainers above to book your first session</p>}
            </div>
          ) : (
            <div className="space-y-3">
              {sessions.map((s: any) => (
                <div key={s.id} className="flex items-center gap-3 p-3 rounded-xl border border-border/60">
                  <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center shrink-0', s.status === 'COMPLETED' ? 'bg-emerald-100 dark:bg-emerald-900/20' : s.status === 'CANCELLED' ? 'bg-rose-100 dark:bg-rose-900/20' : 'bg-orange-100 dark:bg-orange-900/20')}>
                    {s.status === 'COMPLETED' ? <CheckCircle className="w-5 h-5 text-emerald-600"/> : s.status === 'CANCELLED' ? <X className="w-5 h-5 text-rose-500"/> : <Clock className="w-5 h-5 text-orange-600"/>}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate">{s.title || 'PT Session'}</p>
                    <p className="text-xs text-muted-foreground">{formatDateTime(s.scheduledAt)} · {s.duration} min</p>
                    {s.trainer && <p className="text-xs text-muted-foreground">with {s.trainer.user?.firstName} {s.trainer.user?.lastName}</p>}
                  </div>
                  <div className="text-right shrink-0">
                    <span className={cn('text-xs font-bold px-2.5 py-1 rounded-full', s.status === 'COMPLETED' ? 'bg-emerald-100 text-emerald-700' : s.status === 'CANCELLED' ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-700')}>
                      {s.status}
                    </span>
                    {s.price && <p className="text-xs text-muted-foreground mt-0.5">₹{s.price}</p>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
