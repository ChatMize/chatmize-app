import React, { useState } from 'react';
import { X, Save } from 'lucide-react';
import {
  Plan,
  PlanFeature,
  ALL_FEATURES,
  FEATURE_LABELS,
  savePlan,
} from '../../lib/billing';

interface PlanEditorModalProps {
  plan: Plan | null; // null = create new
  onClose: () => void;
  onSaved: () => void;
}

const blankPlan = (): Plan => ({
  id: `plan_${Date.now()}`,
  name: '',
  tagline: '',
  priceMonthlyCents: 4900,
  contactLimit: 2500,
  aiCreditsMonthly: 1000,
  features: ['messenger', 'instagram', 'flow_builder'],
  isPublic: true,
  subscribersCount: 0,
  updatedAt: new Date().toISOString(),
});

export const PlanEditorModal: React.FC<PlanEditorModalProps> = ({ plan, onClose, onSaved }) => {
  const [form, setForm] = useState<Plan>(plan ? { ...plan, features: [...plan.features] } : blankPlan());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = <K extends keyof Plan>(key: K, value: Plan[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const toggleFeature = (feature: PlanFeature) => {
    setForm((prev) => ({
      ...prev,
      features: prev.features.includes(feature)
        ? prev.features.filter((f) => f !== feature)
        : [...prev.features, feature],
    }));
  };

  const handleSave = async () => {
    setError(null);
    if (!form.name.trim()) {
      setError('Plan name is required.');
      return;
    }
    setSaving(true);
    try {
      await savePlan(form);
      onSaved();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save plan.');
    } finally {
      setSaving(false);
    }
  };

  const inputCls =
    'w-full px-3 py-2 bg-slate-800/80 border border-white/10 rounded-xl text-white text-sm placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500 transition-all';
  const labelCls = 'block text-[11px] font-semibold text-slate-300 mb-1.5 uppercase tracking-wider';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
      <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-slate-900 border border-white/10 rounded-2xl shadow-2xl p-6">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-lg font-bold text-white">
            {plan ? `Edit Tier: ${plan.name}` : 'Create New Tier'}
          </h3>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
          <div>
            <label className={labelCls}>Plan name</label>
            <input className={inputCls} value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="Pro Automation" />
          </div>
          <div>
            <label className={labelCls}>Tagline</label>
            <input className={inputCls} value={form.tagline || ''} onChange={(e) => set('tagline', e.target.value)} placeholder="For growing teams" />
          </div>
          <div>
            <label className={labelCls}>Price (USD / month)</label>
            <input
              type="number" min={0} className={inputCls}
              value={Math.round(form.priceMonthlyCents / 100)}
              onChange={(e) => set('priceMonthlyCents', Math.max(0, Number(e.target.value) || 0) * 100)}
            />
          </div>
          <div>
            <label className={labelCls}>Badge (optional)</label>
            <input className={inputCls} value={form.badge || ''} onChange={(e) => set('badge', e.target.value)} placeholder="Most Popular" />
          </div>
          <div>
            <label className={labelCls}>Contact limit (blank = unlimited)</label>
            <input
              type="number" min={0} className={inputCls} placeholder="Unlimited"
              value={form.contactLimit ?? ''}
              onChange={(e) => set('contactLimit', e.target.value === '' ? null : Math.max(0, Number(e.target.value) || 0))}
            />
          </div>
          <div>
            <label className={labelCls}>AI credits / month</label>
            <input
              type="number" min={0} className={inputCls}
              value={form.aiCreditsMonthly}
              onChange={(e) => set('aiCreditsMonthly', Math.max(0, Number(e.target.value) || 0))}
            />
          </div>
        </div>

        <div className="mb-4">
          <label className={labelCls}>Features unlocked</label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {ALL_FEATURES.map((feature) => (
              <label
                key={feature}
                className={`flex items-center gap-2.5 px-3 py-2 rounded-xl border text-xs cursor-pointer transition-all ${
                  form.features.includes(feature)
                    ? 'bg-purple-500/15 border-purple-500/40 text-white'
                    : 'bg-slate-800/50 border-white/10 text-slate-400 hover:border-white/20'
                }`}
              >
                <input
                  type="checkbox"
                  checked={form.features.includes(feature)}
                  onChange={() => toggleFeature(feature)}
                  className="accent-purple-500 w-3.5 h-3.5"
                />
                <span>{FEATURE_LABELS[feature]}</span>
              </label>
            ))}
          </div>
        </div>

        <label className="flex items-center gap-2.5 text-xs text-slate-300 mb-6 cursor-pointer">
          <input
            type="checkbox"
            checked={form.isPublic}
            onChange={(e) => set('isPublic', e.target.checked)}
            className="accent-purple-500 w-4 h-4"
          />
          <span>Show on public pricing page</span>
        </label>

        <div className="flex items-center justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-sm font-medium transition-colors">
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-5 py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white rounded-xl text-sm font-semibold flex items-center gap-2 transition-all disabled:opacity-50"
          >
            {saving ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Save className="w-4 h-4" />}
            <span>{plan ? 'Save Changes' : 'Create Tier'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
