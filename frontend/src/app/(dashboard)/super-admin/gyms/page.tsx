'use client';

import { useEffect, useState } from 'react';
import {
  Building2, Plus, Search, CheckCircle, XCircle, Clock, Users,
  MapPin, MoreVertical, X, Loader2, Trash2, Edit, Mail, Phone,
} from 'lucide-react';
import { gymsApi } from '@/lib/api';
import { StatsCard } from '@/components/shared/StatsCard';
import toast from 'react-hot-toast';
import { cn } from '@/lib/utils';

// ─── Config ──────────────────────────────────────────────────────────────────
const statusConfig: Record<string, { color: string; icon: React.ElementType; label: string }> = {
  ACTIVE:    { color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400', icon: CheckCircle, label: 'Active' },
  PENDING:   { color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400', icon: Clock, label: 'Pending' },
  SUSPENDED: { color: 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400', icon: XCircle, label: 'Suspended' },
  INACTIVE:  { color: 'bg-slate-100 text-slate-600 dark:bg-slate-800/40 dark:text-slate-400', icon: XCircle, label: 'Inactive' },
};

const planGrads: Record<string, string> = {
  STARTER: 'gradient-dark',
  PROFESSIONAL: 'gradient-brand',
  ENTERPRISE: 'gradient-purple',
};

const gradients = ['gradient-brand', 'gradient-blue', 'gradient-purple', 'gradient-green', 'gradient-teal', 'gradient-rose'];

const PLANS = ['STARTER', 'PROFESSIONAL', 'ENTERPRISE'];

const INDIA_STATES = [
  'Andhra Pradesh','Arunachal Pradesh','Assam','Bihar','Chhattisgarh','Goa','Gujarat',
  'Haryana','Himachal Pradesh','Jharkhand','Karnataka','Kerala','Madhya Pradesh',
  'Maharashtra','Manipur','Meghalaya','Mizoram','Nagaland','Odisha','Punjab','Rajasthan',
  'Sikkim','Tamil Nadu','Telangana','Tripura','Uttar Pradesh','Uttarakhand','West Bengal',
  'Delhi','Jammu and Kashmir','Ladakh',
];

const EMPTY_FORM = {
  name: '', email: '', phone: '', address: '', city: '', state: '',
  pincode: '', description: '', saasPlan: 'STARTER', maxMembers: 100,
};

// ─── Gym Form Modal (Add / Edit) ─────────────────────────────────────────────
function GymFormModal({ mode, initial, onClose, onSave }: {
  mode: 'add' | 'edit';
  initial?: any;
  onClose: () => void;
  onSave: (data: any) => Promise<void>;
}) {
  const [form, setForm] = useState<any>(
    initial
      ? {
          name: initial.name ?? '',
          email: initial.email ?? '',
          phone: initial.phone ?? '',
          address: initial.address ?? '',
          city: initial.city ?? '',
          state: initial.state ?? '',
          pincode: initial.pincode ?? '',
          description: initial.description ?? '',
          saasPlan: initial.saasPlan ?? 'STARTER',
          maxMembers: initial.maxMembers ?? 100,
        }
      : { ...EMPTY_FORM }
  );
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const set = (k: string, v: any) => {
    setForm((f: any) => ({ ...f, [k]: v }));
    setErrors((e) => { const n = { ...e }; delete n[k]; return n; });
  };

  const validate = (): Record<string, string> => {
    const e: Record<string, string> = {};
    if (!form.name.trim())    e.name    = 'Gym name is required';
    if (!form.email.trim())   e.email   = 'Email is required';
    else if (!/\S+@\S+\.\S+/.test(form.email)) e.email = 'Enter a valid email';
    if (!form.phone.trim())   e.phone   = 'Phone number is required';
    if (!form.address.trim()) e.address = 'Address is required';
    if (!form.city.trim())    e.city    = 'City is required';
    if (!form.state)          e.state   = 'State is required';
    if (!form.pincode.trim()) e.pincode = 'Pincode is required';
    else if (!/^\d{6}$/.test(form.pincode)) e.pincode = 'Enter a valid 6-digit pincode';
    return e;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length) { setErrors(errs); return; }
    setSaving(true);
    try {
      await onSave({ ...form, maxMembers: Number(form.maxMembers) });
    } finally {
      setSaving(false);
    }
  };

  const inputCls = (k: string) => cn(
    'w-full h-10 px-3 rounded-xl border text-sm bg-background outline-none transition-all',
    errors[k]
      ? 'border-rose-400 focus:border-rose-500 focus:ring-2 focus:ring-rose-200'
      : 'border-border focus:border-primary/60 focus:ring-2 focus:ring-primary/10'
  );

  const Label = ({ children, required }: any) => (
    <label className="block text-xs font-bold text-muted-foreground mb-1.5 uppercase tracking-wide">
      {children}{required && <span className="text-rose-500 ml-0.5">*</span>}
    </label>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-card w-full max-w-2xl rounded-2xl shadow-2xl border border-border max-h-[90vh] flex flex-col animate-scale-in">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
          <div>
            <h2 className="font-extrabold text-lg">{mode === 'add' ? 'Add New Gym' : 'Edit Gym'}</h2>
            <p className="text-sm text-muted-foreground">
              {mode === 'add' ? 'Register a new gym on the platform' : 'Update gym information'}
            </p>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-muted transition-all">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable form body */}
        <form id="gym-form" onSubmit={handleSubmit} className="overflow-y-auto flex-1 px-6 py-5 space-y-5">

          {/* Basic info */}
          <div>
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3 pb-1 border-b border-border/50">
              Basic Information
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <Label required>Gym Name</Label>
                <input value={form.name} onChange={e => set('name', e.target.value)}
                  placeholder="e.g. FitnessHub Premium" className={inputCls('name')} />
                {errors.name && <p className="text-rose-500 text-xs mt-1">{errors.name}</p>}
              </div>
              <div>
                <Label required>Email</Label>
                <input type="email" value={form.email} onChange={e => set('email', e.target.value)}
                  placeholder="gym@example.com" className={inputCls('email')} />
                {errors.email && <p className="text-rose-500 text-xs mt-1">{errors.email}</p>}
              </div>
              <div>
                <Label required>Phone</Label>
                <input value={form.phone} onChange={e => set('phone', e.target.value)}
                  placeholder="+91 9876543210" className={inputCls('phone')} />
                {errors.phone && <p className="text-rose-500 text-xs mt-1">{errors.phone}</p>}
              </div>
              <div className="col-span-2">
                <Label>Description</Label>
                <textarea value={form.description} onChange={e => set('description', e.target.value)}
                  placeholder="Brief description of the gym…" rows={2}
                  className="w-full px-3 py-2 rounded-xl border border-border focus:border-primary/60 focus:ring-2 focus:ring-primary/10 text-sm bg-background outline-none transition-all resize-none" />
              </div>
            </div>
          </div>

          {/* Address */}
          <div>
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3 pb-1 border-b border-border/50">
              Address
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <Label required>Street Address</Label>
                <input value={form.address} onChange={e => set('address', e.target.value)}
                  placeholder="123 MG Road, Near City Mall" className={inputCls('address')} />
                {errors.address && <p className="text-rose-500 text-xs mt-1">{errors.address}</p>}
              </div>
              <div>
                <Label required>City</Label>
                <input value={form.city} onChange={e => set('city', e.target.value)}
                  placeholder="Bangalore" className={inputCls('city')} />
                {errors.city && <p className="text-rose-500 text-xs mt-1">{errors.city}</p>}
              </div>
              <div>
                <Label required>State</Label>
                <select value={form.state} onChange={e => set('state', e.target.value)}
                  className={cn('w-full h-10 px-3 rounded-xl border text-sm bg-background outline-none transition-all',
                    errors.state ? 'border-rose-400' : 'border-border focus:border-primary/60 focus:ring-2 focus:ring-primary/10'
                  )}>
                  <option value="">Select state…</option>
                  {INDIA_STATES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
                {errors.state && <p className="text-rose-500 text-xs mt-1">{errors.state}</p>}
              </div>
              <div>
                <Label required>Pincode</Label>
                <input value={form.pincode} onChange={e => set('pincode', e.target.value)}
                  placeholder="560001" maxLength={6} className={inputCls('pincode')} />
                {errors.pincode && <p className="text-rose-500 text-xs mt-1">{errors.pincode}</p>}
              </div>
            </div>
          </div>

          {/* Subscription */}
          <div>
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3 pb-1 border-b border-border/50">
              Subscription
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Plan</Label>
                <select value={form.saasPlan} onChange={e => set('saasPlan', e.target.value)}
                  className="w-full h-10 px-3 rounded-xl border border-border focus:border-primary/60 focus:ring-2 focus:ring-primary/10 text-sm bg-background outline-none transition-all">
                  {PLANS.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
              <div>
                <Label>Max Members</Label>
                <input type="number" min={1} value={form.maxMembers} onChange={e => set('maxMembers', e.target.value)}
                  placeholder="100" className={inputCls('maxMembers')} />
              </div>
            </div>
          </div>
        </form>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-border shrink-0">
          <button type="button" onClick={onClose}
            className="px-5 py-2.5 rounded-xl border border-border text-sm font-bold hover:bg-muted transition-all">
            Cancel
          </button>
          <button type="submit" form="gym-form" disabled={saving}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl gradient-brand text-white text-sm font-bold shadow-brand hover:opacity-90 disabled:opacity-60 transition-all">
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            {mode === 'add' ? 'Create Gym' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Gym Details Modal ────────────────────────────────────────────────────────
function GymDetailsModal({ gym: initial, onClose, onEdit, onDelete }: {
  gym: any;
  onClose: () => void;
  onEdit: (gym: any) => void;
  onDelete: (gym: any) => void;
}) {
  const [gym, setGym] = useState(initial);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    gymsApi.getOne(initial.id)
      .then((res: any) => setGym(res))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [initial.id]);

  const { icon: StatusIcon, label } = statusConfig[gym.status] ?? statusConfig.INACTIVE;
  const grad = gradients[0];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-card w-full max-w-md rounded-2xl shadow-2xl border border-border max-h-[90vh] flex flex-col animate-scale-in">

        {/* Coloured header */}
        <div className={`${grad} p-5 rounded-t-2xl relative overflow-hidden shrink-0`}>
          <div className="absolute -top-4 -right-4 w-20 h-20 rounded-full bg-white/10" />
          <div className="relative z-10 flex items-start justify-between">
            <div>
              <div className="inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-full bg-white/20 border border-white/30 text-white mb-2">
                <StatusIcon className="w-3 h-3" /> {label}
              </div>
              <h2 className="text-white font-extrabold text-xl leading-tight">{gym.name}</h2>
              <div className="flex items-center gap-1.5 text-white/70 text-sm mt-1">
                <MapPin className="w-3.5 h-3.5" /> {gym.city}, {gym.state}
              </div>
            </div>
            <button onClick={onClose} className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-all">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="overflow-y-auto flex-1 p-5 space-y-4">
          {loading ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
          ) : (
            <>
              {/* Count chips */}
              <div className="grid grid-cols-3 gap-2">
                {[
                  { label: 'Members', value: gym._count?.members ?? 0 },
                  { label: 'Trainers', value: gym._count?.trainers ?? 0 },
                  { label: 'Max Members', value: gym.maxMembers ?? 0 },
                ].map(({ label, value }) => (
                  <div key={label} className="bg-muted/50 rounded-xl p-3 text-center">
                    <p className="font-extrabold text-lg">{value}</p>
                    <p className="text-xs text-muted-foreground">{label}</p>
                  </div>
                ))}
              </div>

              {/* Info rows */}
              <div className="space-y-2">
                {[
                  { icon: Mail, label: 'Email', value: gym.email },
                  { icon: Phone, label: 'Phone', value: gym.phone },
                  { icon: MapPin, label: 'Address', value: `${gym.address}, ${gym.city}, ${gym.state} – ${gym.pincode}` },
                ].map(({ icon: Icon, label, value }) => (
                  <div key={label} className="flex items-start gap-3 p-3 bg-muted/30 rounded-xl">
                    <Icon className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
                    <div className="min-w-0">
                      <p className="text-xs text-muted-foreground">{label}</p>
                      <p className="text-sm font-medium break-words">{value}</p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Plan + Admin */}
              <div className="grid grid-cols-2 gap-2">
                <div className="p-3 bg-muted/30 rounded-xl">
                  <p className="text-xs text-muted-foreground mb-1.5">Plan</p>
                  <span className={`${planGrads[gym.saasPlan] ?? 'gradient-dark'} text-white text-xs font-bold px-2.5 py-1 rounded-lg`}>
                    {gym.saasPlan}
                  </span>
                </div>
                <div className="p-3 bg-muted/30 rounded-xl">
                  <p className="text-xs text-muted-foreground mb-1">Admin</p>
                  <p className="text-sm font-medium">
                    {gym.admin ? `${gym.admin.firstName} ${gym.admin.lastName}` : '—'}
                  </p>
                  {gym.admin && <p className="text-xs text-muted-foreground truncate">{gym.admin.email}</p>}
                </div>
              </div>

              {gym.description && (
                <div className="p-3 bg-muted/30 rounded-xl">
                  <p className="text-xs text-muted-foreground mb-1">Description</p>
                  <p className="text-sm">{gym.description}</p>
                </div>
              )}
            </>
          )}
        </div>

        <div className="flex items-center justify-between px-5 py-4 border-t border-border shrink-0">
          <button onClick={() => onDelete(gym)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold text-rose-600 bg-rose-50 dark:bg-rose-900/20 hover:bg-rose-100 dark:hover:bg-rose-900/30 transition-all">
            <Trash2 className="w-4 h-4" /> Delete
          </button>
          <button onClick={() => onEdit(gym)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl gradient-brand text-white text-sm font-bold shadow-brand hover:opacity-90 transition-all">
            <Edit className="w-4 h-4" /> Edit Gym
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Delete Confirm Modal ─────────────────────────────────────────────────────
function DeleteConfirmModal({ gym, onClose, onConfirm, deleting }: {
  gym: any; onClose: () => void; onConfirm: () => void; deleting: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-card w-full max-w-sm rounded-2xl shadow-2xl border border-border p-6 animate-scale-in">
        <div className="w-12 h-12 bg-rose-100 dark:bg-rose-900/30 rounded-2xl flex items-center justify-center mb-4">
          <Trash2 className="w-6 h-6 text-rose-600" />
        </div>
        <h2 className="font-extrabold text-lg mb-1">Delete Gym</h2>
        <p className="text-sm text-muted-foreground mb-5">
          Are you sure you want to delete <span className="font-bold text-foreground">{gym.name}</span>?
          This action cannot be undone and will remove all associated data.
        </p>
        <div className="flex gap-3">
          <button onClick={onClose} disabled={deleting}
            className="flex-1 py-2.5 rounded-xl border border-border text-sm font-bold hover:bg-muted transition-all disabled:opacity-50">
            Cancel
          </button>
          <button onClick={onConfirm} disabled={deleting}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-sm font-bold transition-all disabled:opacity-60">
            {deleting && <Loader2 className="w-4 h-4 animate-spin" />}
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function GymsPage() {
  const [gyms, setGyms]           = useState<any[]>([]);
  const [total, setTotal]         = useState(0);
  const [search, setSearch]       = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [loading, setLoading]     = useState(true);
  const [page, setPage]           = useState(1);
  const [view, setView]           = useState<'grid' | 'list'>('grid');
  const [activeMenu, setActiveMenu] = useState<string | null>(null);

  const [summary, setSummary]     = useState({ total: 0, active: 0, pending: 0, suspended: 0 });

  const [showAdd, setShowAdd]     = useState(false);
  const [editGym, setEditGym]     = useState<any | null>(null);
  const [viewGym, setViewGym]     = useState<any | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<any | null>(null);
  const [deleting, setDeleting]   = useState(false);

  // ── Fetchers ──
  const fetchGyms = async () => {
    setLoading(true);
    try {
      const res: any = await gymsApi.getAll({ page, limit: 9, search, status: statusFilter || undefined });
      setGyms(res.data ?? []);
      setTotal(res.total ?? 0);
    } catch {}
    setLoading(false);
  };

  const fetchSummary = async () => {
    try {
      const [all, active, pending, suspended] = await Promise.all([
        gymsApi.getAll({ limit: 1 }),
        gymsApi.getAll({ limit: 1, status: 'ACTIVE' }),
        gymsApi.getAll({ limit: 1, status: 'PENDING' }),
        gymsApi.getAll({ limit: 1, status: 'SUSPENDED' }),
      ]) as any[];
      setSummary({
        total:     all.total ?? 0,
        active:    active.total ?? 0,
        pending:   pending.total ?? 0,
        suspended: suspended.total ?? 0,
      });
    } catch {}
  };

  useEffect(() => { fetchSummary(); }, []);
  useEffect(() => { fetchGyms(); }, [page, statusFilter]);
  useEffect(() => {
    const t = setTimeout(fetchGyms, 400);
    return () => clearTimeout(t);
  }, [search]);

  // ── Actions ──
  const updateStatus = async (id: string, newStatus: string) => {
    try {
      await gymsApi.updateStatus(id, newStatus);
      toast.success(`Gym marked as ${newStatus.toLowerCase()}`);
      fetchGyms();
      fetchSummary();
    } catch {}
    setActiveMenu(null);
  };

  const handleCreate = async (data: any) => {
    await gymsApi.create(data);
    toast.success('Gym created successfully!');
    setShowAdd(false);
    fetchGyms();
    fetchSummary();
  };

  const handleEdit = async (data: any) => {
    if (!editGym) return;
    await gymsApi.update(editGym.id, data);
    toast.success('Gym updated successfully!');
    setEditGym(null);
    setViewGym(null);
    fetchGyms();
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await gymsApi.remove(deleteTarget.id);
      toast.success('Gym deleted');
      setDeleteTarget(null);
      setViewGym(null);
      fetchGyms();
      fetchSummary();
    } catch {}
    setDeleting(false);
  };

  const totalPages = Math.ceil(total / 9);

  const stats = [
    { title: 'Total Gyms', value: summary.total,  icon: Building2,   gradient: 'orange' as const },
    { title: 'Active',     value: summary.active, icon: CheckCircle, gradient: 'green'  as const },
  ];

  // ── Render ──
  return (
    <div className="space-y-6 animate-slide-up">

      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">Gym Network</h1>
          <p className="text-muted-foreground mt-0.5">{summary.total} gyms on the ActiveFit platform</p>
        </div>
        <button
          onClick={() => setShowAdd(true)}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl gradient-brand text-white font-bold text-sm shadow-brand hover:opacity-90 transition-all">
          <Plus className="w-4 h-4" /> Add Gym
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 max-w-sm">
        {stats.map(s => <StatsCard key={s.title} {...s} />)}
      </div>

      {/* Pending alert */}
      {summary.pending > 0 && (
        <div className="flex items-center gap-3 p-4 bg-amber-50 dark:bg-amber-900/15 border border-amber-200 dark:border-amber-800/50 rounded-2xl">
          <div className="w-9 h-9 bg-amber-100 dark:bg-amber-900/30 rounded-xl flex items-center justify-center shrink-0">
            <Clock className="w-4 h-4 text-amber-600" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-bold text-amber-800 dark:text-amber-400">
              {summary.pending} gym{summary.pending > 1 ? 's' : ''} awaiting approval
            </p>
            <p className="text-xs text-amber-700/70 dark:text-amber-500">Review and approve or reject new gym applications</p>
          </div>
          <button
            onClick={() => setStatusFilter('PENDING')}
            className="text-xs font-bold text-amber-700 bg-amber-100 dark:bg-amber-900/30 px-3 py-1.5 rounded-lg hover:bg-amber-200 dark:hover:bg-amber-900/50 transition-all shrink-0">
            View Pending
          </button>
        </div>
      )}

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}
            placeholder="Search gyms by name or city…"
            className="w-full h-10 pl-10 pr-4 text-sm bg-card border border-border/60 rounded-xl outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/10 transition-all" />
        </div>
        <div className="flex gap-2 flex-wrap">
          {['', 'ACTIVE', 'INACTIVE'].map(s => (
            <button key={s} onClick={() => { setStatusFilter(s); setPage(1); }}
              className={cn('px-3.5 py-2 rounded-xl text-xs font-bold transition-all',
                statusFilter === s ? 'gradient-brand text-white' : 'bg-card border border-border text-muted-foreground hover:bg-muted')}>
              {s || 'All'}
            </button>
          ))}
        </div>
        <div className="flex border border-border rounded-xl overflow-hidden ml-auto">
          {(['grid', 'list'] as const).map(v => (
            <button key={v} onClick={() => setView(v)}
              className={cn('px-3 py-2 text-xs font-bold capitalize transition-all',
                view === v ? 'gradient-brand text-white' : 'bg-card text-muted-foreground hover:bg-muted')}>
              {v}
            </button>
          ))}
        </div>
      </div>

      {/* Grid / List */}
      {loading ? (
        <div className={cn('gap-4', view === 'grid' ? 'grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3' : 'flex flex-col')}>
          {Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-52 shimmer-bg rounded-2xl" />)}
        </div>
      ) : view === 'grid' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {gyms.map((gym: any, i: number) => {
            const { icon: StatusIcon, label } = statusConfig[gym.status] ?? statusConfig.INACTIVE;
            const grad = gradients[i % gradients.length];
            const planGrad = planGrads[gym.saasPlan] ?? 'gradient-dark';
            return (
              <div key={gym.id} className="group bg-card border border-border/60 rounded-2xl overflow-hidden hover:shadow-lifted hover:-translate-y-1 transition-all duration-300">
                {/* Card header */}
                <div className={`${grad} p-5 relative overflow-hidden`}>
                  <div className="absolute -top-6 -right-6 w-24 h-24 rounded-full bg-white/10" />
                  <div className="relative z-10 flex items-start justify-between">
                    <div>
                      <div className="inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-full bg-white/20 border border-white/30 text-white mb-2">
                        <StatusIcon className="w-3 h-3" /> {label}
                      </div>
                      <h3 className="text-white font-extrabold text-lg leading-tight">{gym.name}</h3>
                      <div className="flex items-center gap-1.5 text-white/70 text-xs mt-1">
                        <MapPin className="w-3 h-3" /> {gym.city}, {gym.state}
                      </div>
                    </div>
                    {/* Kebab menu */}
                    <div className="relative">
                      <button onClick={() => setActiveMenu(activeMenu === gym.id ? null : gym.id)}
                        className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-all">
                        <MoreVertical className="w-4 h-4" />
                      </button>
                      {activeMenu === gym.id && (
                        <>
                          <div className="fixed inset-0 z-10" onClick={() => setActiveMenu(null)} />
                          <div className="absolute right-0 top-full mt-1 w-44 bg-card border border-border rounded-xl shadow-lifted z-20 overflow-hidden animate-scale-in">
                            <button onClick={() => { setViewGym(gym); setActiveMenu(null); }}
                              className="w-full px-4 py-2.5 text-left text-sm hover:bg-muted transition-colors">
                              View Details
                            </button>
                            <button onClick={() => { setEditGym(gym); setActiveMenu(null); }}
                              className="w-full px-4 py-2.5 text-left text-sm hover:bg-muted transition-colors">
                              Edit Gym
                            </button>
                            {gym.status === 'PENDING' && (
                              <button onClick={() => updateStatus(gym.id, 'ACTIVE')}
                                className="w-full px-4 py-2.5 text-left text-sm text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition-colors">
                                ✓ Approve
                              </button>
                            )}
                            {gym.status === 'ACTIVE' && (
                              <button onClick={() => updateStatus(gym.id, 'SUSPENDED')}
                                className="w-full px-4 py-2.5 text-left text-sm text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-900/20 transition-colors">
                                Suspend
                              </button>
                            )}
                            {gym.status === 'SUSPENDED' && (
                              <button onClick={() => updateStatus(gym.id, 'ACTIVE')}
                                className="w-full px-4 py-2.5 text-left text-sm text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition-colors">
                                Reactivate
                              </button>
                            )}
                            <div className="border-t border-border/50 my-1" />
                            <button onClick={() => { setDeleteTarget(gym); setActiveMenu(null); }}
                              className="w-full px-4 py-2.5 text-left text-sm text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/20 transition-colors">
                              Delete Gym
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {/* Card body */}
                <div className="p-4">
                  <div className="grid grid-cols-3 gap-2 mb-4">
                    {[
                      { label: 'Members', value: gym._count?.members ?? 0 },
                      { label: 'Trainers', value: gym._count?.trainers ?? 0 },
                      { label: 'Max', value: gym.maxMembers ?? 0 },
                    ].map(({ label, value }) => (
                      <div key={label} className="bg-muted/50 rounded-xl p-2.5 text-center">
                        <p className="font-extrabold">{value}</p>
                        <p className="text-[10px] text-muted-foreground">{label}</p>
                      </div>
                    ))}
                  </div>

                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className={`${planGrad} text-white text-xs font-bold px-2.5 py-1 rounded-lg shrink-0`}>
                        {gym.saasPlan}
                      </span>
                      <span className="text-xs text-muted-foreground truncate">{gym.subscriptionStatus}</span>
                    </div>
                    {gym.status === 'PENDING' && (
                      <button onClick={() => updateStatus(gym.id, 'ACTIVE')}
                        className="text-xs font-bold text-emerald-600 bg-emerald-100 dark:bg-emerald-900/30 hover:bg-emerald-200 dark:hover:bg-emerald-900/50 px-3 py-1.5 rounded-lg transition-all shrink-0">
                        Approve →
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}

          {gyms.length === 0 && (
            <div className="col-span-3 bg-card border border-dashed border-border rounded-2xl p-16 text-center">
              <Building2 className="w-14 h-14 mx-auto mb-3 text-muted-foreground opacity-20" />
              <p className="font-semibold text-muted-foreground">No gyms found</p>
              <button onClick={() => setShowAdd(true)}
                className="mt-4 text-sm font-bold text-primary hover:underline">
                + Add the first gym
              </button>
            </div>
          )}
        </div>
      ) : (
        /* List view */
        <div className="bg-card rounded-2xl border border-border/60 overflow-hidden shadow-card">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/50 bg-muted/30">
                {['Gym', 'Location', 'Admin', 'Members', 'Plan', 'Status', 'Actions'].map(h => (
                  <th key={h} className="text-left py-3 px-4 text-xs font-bold text-muted-foreground uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border/30">
              {gyms.length === 0 && (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-muted-foreground">
                    <Building2 className="w-10 h-10 mx-auto mb-2 opacity-20" />
                    <p className="font-semibold">No gyms found</p>
                  </td>
                </tr>
              )}
              {gyms.map((gym: any, i: number) => {
                const { color, icon: StatusIcon, label } = statusConfig[gym.status] ?? statusConfig.INACTIVE;
                return (
                  <tr key={gym.id} className="hover:bg-muted/20 transition-colors">
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-3">
                        <div className={`w-9 h-9 ${gradients[i % gradients.length]} rounded-xl flex items-center justify-center text-white font-bold text-sm shrink-0`}>
                          {gym.name[0]}
                        </div>
                        <p className="font-semibold">{gym.name}</p>
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-muted-foreground">{gym.city}, {gym.state}</td>
                    <td className="py-3.5 px-4">
                      {gym.admin ? `${gym.admin.firstName} ${gym.admin.lastName}` : <span className="text-muted-foreground">—</span>}
                    </td>
                    <td className="py-3.5 px-4 font-bold">{gym._count?.members ?? 0}</td>
                    <td className="py-3.5 px-4">
                      <span className="text-xs font-bold bg-muted px-2.5 py-1 rounded-lg">{gym.saasPlan}</span>
                    </td>
                    <td className="py-3.5 px-4">
                      <span className={`flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-lg w-fit ${color}`}>
                        <StatusIcon className="w-3 h-3" /> {label}
                      </span>
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-2">
                        <button onClick={() => setViewGym(gym)}
                          className="text-xs font-bold text-primary hover:underline">View</button>
                        <button onClick={() => setEditGym(gym)}
                          className="text-xs font-bold text-muted-foreground hover:underline">Edit</button>
                        {gym.status === 'PENDING' && (
                          <button onClick={() => updateStatus(gym.id, 'ACTIVE')}
                            className="text-xs font-bold text-emerald-600 hover:underline">Approve</button>
                        )}
                        {gym.status === 'ACTIVE' && (
                          <button onClick={() => updateStatus(gym.id, 'SUSPENDED')}
                            className="text-xs font-bold text-amber-600 hover:underline">Suspend</button>
                        )}
                        {gym.status === 'SUSPENDED' && (
                          <button onClick={() => updateStatus(gym.id, 'ACTIVE')}
                            className="text-xs font-bold text-emerald-600 hover:underline">Reactivate</button>
                        )}
                        <button onClick={() => setDeleteTarget(gym)}
                          className="text-xs font-bold text-rose-600 hover:underline">Delete</button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Showing {(page - 1) * 9 + 1}–{Math.min(page * 9, total)} of {total} gyms
          </p>
          <div className="flex gap-2">
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
              className="px-3.5 py-2 rounded-xl border border-border text-sm font-bold hover:bg-muted disabled:opacity-40 transition-all">
              ← Prev
            </button>
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              const pg = page <= 3 ? i + 1 : page - 2 + i;
              if (pg > totalPages) return null;
              return (
                <button key={pg} onClick={() => setPage(pg)}
                  className={cn('w-9 h-9 rounded-xl text-sm font-bold transition-all',
                    pg === page ? 'gradient-brand text-white' : 'border border-border hover:bg-muted')}>
                  {pg}
                </button>
              );
            })}
            <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
              className="px-3.5 py-2 rounded-xl border border-border text-sm font-bold hover:bg-muted disabled:opacity-40 transition-all">
              Next →
            </button>
          </div>
        </div>
      )}

      {/* ── Modals ── */}
      {showAdd && (
        <GymFormModal mode="add" onClose={() => setShowAdd(false)} onSave={handleCreate} />
      )}

      {editGym && (
        <GymFormModal mode="edit" initial={editGym} onClose={() => setEditGym(null)} onSave={handleEdit} />
      )}

      {viewGym && !editGym && (
        <GymDetailsModal
          gym={viewGym}
          onClose={() => setViewGym(null)}
          onEdit={(g) => { setEditGym(g); setViewGym(null); }}
          onDelete={(g) => { setDeleteTarget(g); setViewGym(null); }}
        />
      )}

      {deleteTarget && (
        <DeleteConfirmModal
          gym={deleteTarget}
          onClose={() => setDeleteTarget(null)}
          onConfirm={handleDelete}
          deleting={deleting}
        />
      )}
    </div>
  );
}
