import React, { useState } from 'react';
import { Check, X, ArrowRight, ArrowLeft, Plug } from 'lucide-react';
import {
  IntegrationApp,
  CHATMIZE_INTEGRATIONS,
  getStoredIntegrationCredentials,
} from '../../data/integrations';

interface IntegrationsStepProps {
  onNext: () => void;
  onBack: () => void;
}

const CATEGORIES: { id: string; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'email', label: 'Email' },
  { id: 'automation', label: 'Automation' },
  { id: 'webinar', label: 'Webinars' },
  { id: 'crm', label: 'CRM' },
  { id: 'ecommerce', label: 'Ecommerce' },
  { id: 'contest', label: 'Contests' },
];

const STORAGE_KEY = 'chatmize_integration_credentials';

/**
 * Onboarding integrations step: connect the rest of the marketing stack
 * (email providers, automation bridges, webinars, CRM, ecommerce, contests)
 * using the shared CHATMIZE_INTEGRATIONS catalog. Credentials are stored
 * the same way as Settings > Integrations so the two stay in sync.
 */
export const IntegrationsStep: React.FC<IntegrationsStepProps> = ({ onNext, onBack }) => {
  const [credentials, setCredentials] = useState<Record<string, Record<string, string>>>(() =>
    getStoredIntegrationCredentials(),
  );
  const [category, setCategory] = useState('all');
  const [activeApp, setActiveApp] = useState<IntegrationApp | null>(null);
  const [formInputs, setFormInputs] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const connectedIds = new Set(Object.keys(credentials).filter((id) => credentials[id] && Object.keys(credentials[id]).length > 0));
  const visible = CHATMIZE_INTEGRATIONS.filter((app) => category === 'all' || app.category === category);

  const openModal = (app: IntegrationApp) => {
    setActiveApp(app);
    setFormInputs(credentials[app.id] || {});
    setSaving(false);
  };

  const save = () => {
    if (!activeApp) return;
    const missing = activeApp.fields.find((f) => !formInputs[f.name]?.trim());
    if (missing) return;
    setSaving(true);
    const next = { ...credentials, [activeApp.id]: { ...formInputs } };
    setTimeout(() => {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
        window.dispatchEvent(new Event('chatmize_integrations_updated'));
      } catch {
        // ignore
      }
      setCredentials(next);
      setSaving(false);
      setActiveApp(null);
    }, 500);
  };

  const disconnect = (id: string) => {
    const next = { ...credentials };
    delete next[id];
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      window.dispatchEvent(new Event('chatmize_integrations_updated'));
    } catch {
      // ignore
    }
    setCredentials(next);
  };

  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-lg font-black text-white mb-1">Connect your integrations</h3>
        <p className="text-xs text-slate-400">
          Plug ChatMize into the tools you already use. Leads flow straight into your email list,
          CRM, or automations. ({connectedIds.size} connected, optional)
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {CATEGORIES.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => setCategory(c.id)}
            className={`px-3 py-1.5 rounded-full text-[11px] font-bold cursor-pointer border transition-all ${
              category === c.id
                ? 'bg-purple-500/20 border-purple-500/50 text-purple-200'
                : 'bg-white/5 border-white/10 text-slate-400 hover:text-slate-200'
            }`}
          >
            {c.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {visible.map((app) => {
          const connected = connectedIds.has(app.id);
          return (
            <div
              key={app.id}
              className={`rounded-2xl border p-4 transition-all ${
                connected ? 'border-emerald-500/30 bg-emerald-500/5' : 'border-white/10 bg-slate-900/60'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-3 min-w-0">
                  <span className={`w-9 h-9 rounded-xl flex items-center justify-center text-xs font-black shrink-0 ${app.logoBg} ${app.logoTextColor}`}>
                    {app.initials}
                  </span>
                  <div className="min-w-0">
                    <h4 className="text-xs font-bold text-white truncate">{app.name}</h4>
                    <p className="text-[11px] text-slate-500 truncate">{app.tagline}</p>
                  </div>
                </div>
                {connected ? (
                  <span className="flex items-center gap-1 text-[10px] font-extrabold uppercase tracking-wider text-emerald-300 bg-emerald-500/15 border border-emerald-500/30 px-2 py-1 rounded-full shrink-0">
                    <Check className="w-3 h-3" /> On
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => openModal(app)}
                    className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 bg-white/5 border border-white/10 hover:border-purple-500/40 hover:text-purple-200 px-2 py-1 rounded-full cursor-pointer shrink-0 flex items-center gap-1"
                  >
                    <Plug className="w-3 h-3" /> Connect
                  </button>
                )}
              </div>
              {connected && (
                <button
                  type="button"
                  onClick={() => disconnect(app.id)}
                  className="mt-2 text-[11px] text-slate-500 hover:text-red-400 cursor-pointer"
                >
                  Disconnect
                </button>
              )}
            </div>
          );
        })}
      </div>

      <div className="flex items-center justify-between pt-2">
        <button
          type="button"
          onClick={onBack}
          className="px-4 py-2.5 text-xs font-bold text-slate-400 hover:text-white flex items-center gap-1.5 cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" /> Back
        </button>
        <button
          type="button"
          onClick={onNext}
          className="px-6 py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-lg shadow-purple-500/20"
        >
          <span>{connectedIds.size > 0 ? 'Continue' : 'Skip for now'}</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>

      {activeApp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" onClick={() => setActiveApp(null)}>
          <div
            className="w-full max-w-md rounded-3xl border border-white/10 bg-slate-900 p-6 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <span className={`w-10 h-10 rounded-xl flex items-center justify-center text-sm font-black ${activeApp.logoBg} ${activeApp.logoTextColor}`}>
                  {activeApp.initials}
                </span>
                <div>
                  <h4 className="text-sm font-black text-white">{activeApp.name}</h4>
                  <p className="text-[11px] text-slate-500">{activeApp.authType}</p>
                </div>
              </div>
              <button type="button" onClick={() => setActiveApp(null)} className="text-slate-500 hover:text-white cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-slate-400">{activeApp.description}</p>
            <div className="space-y-3">
              {activeApp.fields.map((f) => (
                <div key={f.name}>
                  <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">{f.label}</label>
                  <input
                    type={f.type || 'text'}
                    value={formInputs[f.name] || ''}
                    onChange={(e) => setFormInputs((prev) => ({ ...prev, [f.name]: e.target.value }))}
                    placeholder={f.placeholder}
                    className="mt-1 w-full bg-slate-800/60 border border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-purple-500/50"
                  />
                  {f.helpText && <p className="text-[10px] text-slate-600 mt-1">{f.helpText}</p>}
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={save}
              disabled={saving || activeApp.fields.some((f) => !formInputs[f.name]?.trim())}
              className="w-full py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 disabled:opacity-40 text-white rounded-xl text-xs font-bold cursor-pointer"
            >
              {saving ? 'Connecting...' : `Connect ${activeApp.name}`}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
