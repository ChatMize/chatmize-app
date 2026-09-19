import React, { useState } from 'react';
import { X, Save } from 'lucide-react';
import {
  Plan,
  PlanFeature,
  PlanMode,
  PLAN_MODE_LABELS,
  ALL_FEATURES,
  FEATURE_LABELS,
  savePlan,
} from '../../lib/billing';
import {
  usePlanModules,
  moduleValueFor,
  MODULE_CATEGORY_LABELS,
  type PlanModuleCategory,
} from '../../lib/planModules';

interface PlanEditorModalProps {
  plan: Plan | null; // null = create new
  /** Pre-select the fulfillment track when creating. */
  defaultMode?: PlanMode;
  onClose: () => void;
  onSaved: () => void;
}

const blankPlan = (mode: PlanMode = 'diy'): Plan => ({
  id: `plan_${Date.now()}`,
  name: '',
  tagline: '',
  mode,
  priceMonthlyCents: 4900,
  contactLimit: 2500,
  aiCreditsMonthly: 1000,
  smsAllowanceMonthly: 0,
  features: ['messenger', 'instagram', 'flow_builder'],
  modules: {},
  serviceInclusions: [],
  isPublic: true,
  subscribersCount: 0,
  updatedAt: new Date().toISOString(),
});

export const PlanEditorModal: React.FC<PlanEditorModalProps> = ({ plan, defaultMode = 'diy' as PlanMode, onClose, onSaved }) => {
  const [form, setForm] = useState<Plan>(
    plan
      ? { ...plan, features: [...plan.features], modules: { ...(plan.modules || {}) }, serviceInclusions: [...(plan.serviceInclusions || [])] }
      : blankPlan(defaultMode)
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newInclusion, setNewInclusion] = useState('');
  const { modules: registry } = usePlanModules();

  const setModuleValue = (moduleId: string, value: boolean | number) => {
    setForm((prev) => ({
      ...prev,
      modules: { ...(prev.modules || {}), [moduleId]: value },
    }));
  };

  const clearModuleValue = (moduleId: string) => {
    setForm((prev) => {
      const next = { ...(prev.modules || {}) };
      delete next[moduleId];
      return { ...prev, modules: next };
    });
  };

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
      <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-slate-900 border border-white/10 rounded-2xl shadow-2xl p-6" data-no-emoji>
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
          <div className="sm:col-span-2">
            <label className={labelCls}>Fulfillment track</label>
            <div className="grid grid-cols-2 gap-2">
              {(['diy', 'dfu'] as PlanMode[]).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => set('mode', mode)}
                  className={`px-3 py-2.5 rounded-xl border text-xs font-bold transition-all ${
                    form.mode === mode
                      ? 'bg-purple-500/15 border-purple-500/40 text-white'
                      : 'bg-slate-800/50 border-white/10 text-slate-400 hover:border-white/20'
                  }`}
                >
                  {PLAN_MODE_LABELS[mode]}
                </button>
              ))}
            </div>
            <p className="text-[11px] text-slate-500 mt-1.5">
              {form.mode === 'diy'
                ? 'Self-service: the user spends their own credits.'
                : 'White-glove: your team operates the AI on the client\u2019s behalf from this plan\u2019s credit pool.'}
            </p>
          </div>
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
          <div>
            <label className={labelCls}>SMS segments / month</label>
            <input
              type="number" min={0} className={inputCls}
              value={form.smsAllowanceMonthly ?? 0}
              onChange={(e) => set('smsAllowanceMonthly', Math.max(0, Number(e.target.value) || 0))}
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

        <div className="mb-4">
          <label className={labelCls}>Modules (modular plan builder)</label>
          <p className="text-[11px] text-slate-500 mb-2">
            Compose this plan from modules. A value set here overrides the registry default; clearing it falls back to the default.
          </p>
          {(['capture', 'seats', 'workspaces', 'credits', 'channels', 'integrations', 'features'] as PlanModuleCategory[]).map((cat) => {
            const list = registry.filter((m) => m.category === cat);
            if (list.length === 0) return null;
            return (
              <div key={cat} className="mb-3">
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                  {MODULE_CATEGORY_LABELS[cat]}
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {list.map((m) => {
                    const override = form.modules?.[m.id];
                    const effective = moduleValueFor(form, m.id, registry);
                    return (
                      <div
                        key={m.id}
                        className={`flex items-center gap-2.5 px-3 py-2 rounded-xl border text-xs transition-all ${
                          override !== undefined
                            ? 'bg-purple-500/15 border-purple-500/40 text-white'
                            : 'bg-slate-800/50 border-white/10 text-slate-400'
                        }`}
                      >
                        {m.type === 'boolean' ? (
                          <input
                            type="checkbox"
                            checked={effective === true}
                            onChange={(e) => setModuleValue(m.id, e.target.checked)}
                            className="accent-purple-500 w-3.5 h-3.5 shrink-0"
                          />
                        ) : (
                          <input
                            type="number"
                            min={0}
                            value={typeof effective === 'number' ? effective : 0}
                            onChange={(e) => setModuleValue(m.id, Math.max(0, Number(e.target.value) || 0))}
                            className="w-16 px-1.5 py-1 bg-slate-800/80 border border-white/10 rounded-lg text-white text-xs shrink-0"
                          />
                        )}
                        <div className="min-w-0 flex-1">
                          <span className="block truncate">{m.name}</span>
                          {m.unit && <span className="block text-[10px] text-slate-500">{m.unit}</span>}
                        </div>
                        {override !== undefined && (
                          <button
                            type="button"
                            onClick={() => clearModuleValue(m.id)}
                            title="Clear override, use registry default"
                            className="text-slate-500 hover:text-white shrink-0 cursor-pointer"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        <div className="mb-4">
          <label className={labelCls}>Service inclusions {form.mode === 'diy' ? '(optional)' : ''}</label>
          <p className="text-[11px] text-slate-500 mb-2">
            {form.mode === 'dfu'
              ? 'What your team does for the client, e.g. "We build your first 3 flows".'
              : 'Extra white-glove line items, if any.'}
          </p>
          <div className="space-y-2 mb-2">
            {form.serviceInclusions.map((item, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <input
                  className={inputCls}
                  value={item}
                  onChange={(e) => {
                    const next = [...form.serviceInclusions];
                    next[idx] = e.target.value;
                    set('serviceInclusions', next);
                  }}
                  placeholder="We build your first 3 flows"
                />
                <button
                  type="button"
                  onClick={() => set('serviceInclusions', form.serviceInclusions.filter((_, i) => i !== idx))}
                  className="p-2 text-slate-500 hover:text-red-400 transition-colors shrink-0"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <input
              className={inputCls}
              value={newInclusion}
              onChange={(e) => setNewInclusion(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && newInclusion.trim()) {
                  e.preventDefault();
                  set('serviceInclusions', [...form.serviceInclusions, newInclusion.trim()]);
                  setNewInclusion('');
                }
              }}
              placeholder="Add a service inclusion, Enter to add"
            />
            <button
              type="button"
              onClick={() => {
                if (newInclusion.trim()) {
                  set('serviceInclusions', [...form.serviceInclusions, newInclusion.trim()]);
                  setNewInclusion('');
                }
              }}
              className="px-3 py-2 bg-white/10 hover:bg-white/15 text-white rounded-xl text-xs font-bold transition-all shrink-0"
            >
              Add
            </button>
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
