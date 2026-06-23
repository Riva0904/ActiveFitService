'use client';

import { Crown, X, Check, Zap, Star } from 'lucide-react';

interface UpgradeModalProps {
  open: boolean;
  onClose: () => void;
  featureName?: string;
}

const proFeatures = [
  'Unlimited members & trainers',
  'PT session management',
  'Payment & invoice handling',
  'Expense tracking & audit reports',
  'Supplement sales management',
  'Advanced analytics & charts',
  'Workout & diet planning',
  'Notifications & broadcast',
  'Export PDF / CSV reports',
  'QR attendance system',
];

export function UpgradeModal({ open, onClose, featureName }: UpgradeModalProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-card border border-border rounded-3xl shadow-lifted w-full max-w-md overflow-hidden animate-slide-up">
        {/* Header gradient */}
        <div className="relative gradient-brand p-7 text-center overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-purple-600/40 to-orange-400/40" />
          <div className="absolute -top-8 -right-8 w-32 h-32 rounded-full bg-white/10 blur-2xl" />
          <button
            onClick={onClose}
            className="absolute top-4 right-4 w-8 h-8 bg-white/20 rounded-full flex items-center justify-center hover:bg-white/30 transition-all"
          >
            <X className="w-4 h-4 text-white" />
          </button>
          <div className="relative z-10">
            <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center mx-auto mb-4 backdrop-blur-sm">
              <Crown className="w-8 h-8 text-white" />
            </div>
            <h2 className="text-2xl font-extrabold text-white">Upgrade to Pro</h2>
            <p className="text-white/80 text-sm mt-1.5">
              {featureName
                ? `${featureName} requires a Pro or Enterprise plan`
                : 'Unlock the full power of ActiveFit'}
            </p>
          </div>
        </div>

        {/* Features */}
        <div className="p-6">
          <p className="text-sm font-bold text-muted-foreground uppercase tracking-wider mb-4">
            Everything in Pro includes:
          </p>
          <div className="grid grid-cols-1 gap-2 mb-6">
            {proFeatures.map((f) => (
              <div key={f} className="flex items-center gap-2.5">
                <div className="w-5 h-5 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center shrink-0">
                  <Check className="w-3 h-3 text-green-600 dark:text-green-400" />
                </div>
                <span className="text-sm text-foreground">{f}</span>
              </div>
            ))}
          </div>

          {/* Pricing */}
          <div className="bg-muted/50 rounded-2xl p-4 mb-5 text-center">
            <div className="flex items-baseline justify-center gap-1">
              <span className="text-3xl font-extrabold">₹7,999</span>
              <span className="text-muted-foreground text-sm">/month</span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">Billed monthly · Cancel anytime</p>
          </div>

          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 py-2.5 rounded-xl border border-border text-sm font-medium hover:bg-muted transition-all"
            >
              Maybe later
            </button>
            <button
              className="flex-1 py-2.5 rounded-xl gradient-brand text-white text-sm font-bold flex items-center justify-center gap-2 hover:opacity-90 transition-all shadow-brand"
            >
              <Zap className="w-4 h-4" />
              Upgrade Now
            </button>
          </div>

          <p className="text-center text-xs text-muted-foreground mt-3">
            Contact your super admin to upgrade the plan
          </p>
        </div>
      </div>
    </div>
  );
}
