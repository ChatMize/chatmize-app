import React, { useState } from 'react';
import { Check, Wrench, ConciergeBell, ArrowRight, ArrowLeft } from 'lucide-react';
import {
  Plan,
  PlanMode,
  FEATURE_LABELS,
  formatPrice,
} from '../../lib/billing';

interface RoutePickerProps {
  plans: Plan[];
  initialMode?: PlanMode;
  initialPlanId?: string;
  /** Called with the chosen mode + plan (plan may be null = track only). */
  onSelect: (mode: PlanMode, plan: Plan | null) => void;
  onBack?: () => void;
  submitLabel?: string;
  allowDecideLater?: boolean;
  onDecideLater?: () => void;
}

const TRACK_COPY: Record<PlanMode, { title: string; subtitle: string; best: string; bullets: string[] }> = {
  diy: {
    title: 'DIY Self-Service',
    subtitle: 'You run it',
    best: 'Pick DIY if you want hands-on control at the lowest cost and you (or your team) will build and manage the automation.',
    bullets: [
      'You build flows with the AI Copilot',
      'You spend your own monthly AI credit pool',
      'Every AI action shows its credit cost before it runs',
      'Top up credits anytime at 4x cost (plans save you 25%)',
      'Upgrade, downgrade, or switch tracks whenever you want',
    ],
  },
  dfu: {
    title: 'Done-For-You',
    subtitle: 'We run it for you',
    best: 'Pick Done-For-You if you want it live fast without touching the tech. Our team builds, launches, and manages everything.',
    bullets: [
      'Our team builds and launches your flows for you',
      'We operate the AI on your behalf from a larger credit pool',
      'Done-for-you onboarding and managed broadcasts',
      'Dedicated account manager',
      'Upgrade, downgrade, or switch tracks whenever you want',
    ],
  },
};

/**
 * Guided DIY vs Done-For-You fork with tier selection.
 * Used by the onboarding wizard and the Settings plan tab (change plan).
 */
export const RoutePicker: React.FC<RoutePickerProps> = ({
  plans,
  initialMode,
  initialPlanId,
  onSelect,
  onBack,
  submitLabel = 'Continue',
  allowDecideLater = false,
  onDecideLater,
}) => {
  const [mode, setMode] = useState<PlanMode | null>(initialMode ?? null);
  const [planId, setPlanId] = useState<string | null>(initialPlanId ?? null);

  const publicPlans = plans.filter((p) => p.isPublic);
  const diyPlans = publicPlans.filter((p) => p.mode !== 'dfu');
  const dfuPlans = publicPlans.filter((p) => p.mode === 'dfu');
  const visiblePlans = mode === 'dfu' ? dfuPlans : diyPlans;
  const selectedPlan = visiblePlans.find((p) => p.id === planId) ?? null;

  const pickMode = (m: PlanMode) => {
    setMode(m);
    setPlanId(null);
  };

  return (
    <div className="space-y-6">
      {/* Track cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {(['diy', 'dfu'] as PlanMode[]).map((m) => {
          const copy = TRACK_COPY[m];
          const active = mode === m;
          return (
            <button
              key={m}
              type="button"
              onClick={() => pickMode(m)}
              className={`text-left rounded-3xl border p-6 transition-all cursor-pointer ${
                active
                  ? m === 'dfu'
                    ? 'border-amber-400/60 bg-amber-500/10 shadow-lg shadow-amber-500/10'
                    : 'border-cyan-400/60 bg-cyan-500/10 shadow-lg shadow-cyan-500/10'
                  : 'border-white/10 bg-slate-900/60 hover:border-white/25'
              }`}
            >
              <div className="flex items-center justify-between mb-3">
                <span className={`p-2.5 rounded-2xl ${m === 'dfu' ? 'bg-amber-500/15' : 'bg-cyan-500/15'}`}>
                  {m === 'dfu' ? (
                    <ConciergeBell className="w-5 h-5 text-amber-300" />
                  ) : (
                    <Wrench className="w-5 h-5 text-cyan-300" />
                  )}
                </span>
                <span className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                  active ? (m === 'dfu' ? 'border-amber-400' : 'border-cyan-400') : 'border-slate-600'
                }`}>
                  {active && (
                    <span className={`w-2.5 h-2.5 rounded-full ${m === 'dfu' ? 'bg-amber-400' : 'bg-cyan-400'}`} />
                  )}
                </span>
              </div>
              <h3 className="text-lg font-black text-white">{copy.title}</h3>
              <p className={`text-xs font-bold mb-3 ${m === 'dfu' ? 'text-amber-300' : 'text-cyan-300'}`}>{copy.subtitle}</p>
              <ul className="space-y-2">
                {copy.bullets.map((b) => (
                  <li key={b} className="flex items-start gap-2 text-xs text-slate-300">
                    <Check className={`w-3.5 h-3.5 shrink-0 mt-0.5 ${m === 'dfu' ? 'text-amber-400' : 'text-cyan-400'}`} />
                    <span>{b}</span>
                  </li>
                ))}
              </ul>
              <p className="text-[11px] text-slate-500 mt-4 italic">{copy.best}</p>
            </button>
          );
        })}
      </div>

      {/* Tier list for the chosen track */}
      {mode && (
        <div className="space-y-3">
          <h4 className="text-sm font-bold text-white">
            {mode === 'dfu' ? 'Choose your Done-For-You tier' : 'Choose your DIY tier'}
          </h4>
          {visiblePlans.length === 0 ? (
            <p className="text-xs text-slate-500 py-4 text-center">
              No {mode === 'dfu' ? 'Done-For-You' : 'DIY'} tiers are published yet. You can still continue and pick one later.
            </p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {visiblePlans.map((plan) => {
                const active = planId === plan.id;
                return (
                  <button
                    key={plan.id}
                    type="button"
                    onClick={() => setPlanId(plan.id)}
                    className={`text-left rounded-3xl border p-5 transition-all cursor-pointer flex flex-col ${
                      active
                        ? 'border-purple-400/60 bg-purple-500/10 shadow-lg shadow-purple-500/10'
                        : 'border-white/10 bg-slate-900/60 hover:border-white/25'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <h5 className="text-sm font-black text-white">{plan.name}</h5>
                      <span className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${active ? 'border-purple-400' : 'border-slate-600'}`}>
                        {active && <span className="w-2.5 h-2.5 rounded-full bg-purple-400" />}
                      </span>
                    </div>
                    {plan.tagline && <p className="text-[11px] text-slate-500 mb-2">{plan.tagline}</p>}
                    <div className="flex items-baseline gap-1 mb-2">
                      <span className="text-2xl font-black text-white">{formatPrice(plan.priceMonthlyCents)}</span>
                      <span className="text-[11px] text-slate-400">/month</span>
                    </div>
                    <p className="text-[11px] text-slate-400 mb-3">
                      {plan.contactLimit === null ? 'Unlimited' : plan.contactLimit.toLocaleString()} contacts
                      {' · '}{plan.aiCreditsMonthly.toLocaleString()} AI credits/mo
                    </p>
                    <ul className="space-y-1.5 mb-3">
                      {plan.features.slice(0, 5).map((f) => (
                        <li key={f} className="flex items-start gap-1.5 text-[11px] text-slate-300">
                          <Check className="w-3 h-3 text-cyan-400 shrink-0 mt-0.5" />
                          <span>{FEATURE_LABELS[f]}</span>
                        </li>
                      ))}
                      {plan.features.length > 5 && (
                        <li className="text-[11px] text-slate-500">+{plan.features.length - 5} more</li>
                      )}
                    </ul>
                    {plan.serviceInclusions && plan.serviceInclusions.length > 0 && (
                      <ul className="space-y-1.5 border-t border-amber-500/20 pt-3">
                        {plan.serviceInclusions.slice(0, 3).map((s, i) => (
                          <li key={i} className="flex items-start gap-1.5 text-[11px] text-amber-100/80">
                            <Check className="w-3 h-3 text-amber-400 shrink-0 mt-0.5" />
                            <span>{s}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center justify-between pt-2">
        <div>
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              className="px-4 py-2.5 text-xs font-bold text-slate-400 hover:text-white flex items-center gap-1.5 cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" /> Back
            </button>
          )}
        </div>
        <div className="flex items-center gap-3">
          {allowDecideLater && (
            <button
              type="button"
              onClick={onDecideLater}
              className="text-xs text-slate-500 hover:text-slate-300 underline underline-offset-2 cursor-pointer"
            >
              Decide later
            </button>
          )}
          <button
            type="button"
            disabled={!mode}
            onClick={() => mode && onSelect(mode, selectedPlan)}
            className="px-6 py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-lg shadow-purple-500/20"
          >
            <span>{submitLabel}</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
