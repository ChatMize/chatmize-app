import React, { useEffect, useState } from 'react';
import { BellRing, Loader2, CheckCircle2, AlertTriangle, KeyRound } from 'lucide-react';
import { getPushVapidStatus, setPushVapidKey } from '../../lib/push';

/**
 * Super Admin > Push: the one place a Super Admin enters the VAPID public key.
 * One key powers web push for every workspace. Saving here flips every
 * workspace channel card to its configured state (they read the same doc).
 */
export const SuperAdminPushTab: React.FC = () => {
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [vapidInput, setVapidInput] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = async () => {
    setLoading(true); setError(null);
    try {
      const s = await getPushVapidStatus();
      setConfigured(s.configured);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load push status.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { refresh(); }, []);

  const handleSave = async () => {
    const key = vapidInput.trim();
    if (!key) return;
    setSaving(true); setError(null); setSaved(false);
    try {
      await setPushVapidKey(key);
      setVapidInput('');
      setSaved(true);
      await refresh();
      setTimeout(() => setSaved(false), 3000);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Could not save the key.';
      setError(msg.includes('permission-denied') || msg.includes('Super Admin')
        ? 'Only a Super Admin can save the key. Use Claim Super Admin above first, then sign out and back in.'
        : msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl p-6 max-w-2xl">
      <div className="flex items-center gap-3 mb-1">
        <div className="p-2.5 bg-violet-500/15 rounded-xl border border-violet-500/25">
          <BellRing className="w-5 h-5 text-violet-300" />
        </div>
        <div>
          <h3 className="font-bold text-white text-sm">Web Push</h3>
          <p className="text-xs text-slate-400">One key powers browser push for every workspace.</p>
        </div>
      </div>

      {error && (
        <div className="my-4 p-3 rounded-xl bg-red-500/10 border border-red-500/25 text-red-300 text-xs flex gap-2">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" /> {error}
        </div>
      )}

      {loading ? (
        <div className="my-6 flex items-center gap-2 text-xs text-slate-400">
          <Loader2 className="w-4 h-4 animate-spin" /> Checking push status...
        </div>
      ) : configured ? (
        <div className="my-4 flex items-center gap-2 text-xs text-emerald-300 bg-emerald-500/10 border border-emerald-500/25 rounded-xl px-4 py-3">
          <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
          Web Push is connected. Every workspace channel card now shows it as live.
        </div>
      ) : (
        <div className="my-4 flex items-center gap-2 text-xs text-amber-300 bg-amber-500/10 border border-amber-500/25 rounded-xl px-4 py-3">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          Web Push is not connected yet. Add the key once below and push goes live everywhere.
        </div>
      )}

      <div className="p-4 rounded-xl bg-violet-500/5 border border-violet-500/25 space-y-2.5">
        <div className="flex items-center gap-2 text-xs font-bold text-violet-300">
          <KeyRound className="w-4 h-4" /> {configured ? 'Replace the VAPID public key' : 'Add the VAPID public key'}
        </div>
        <p className="text-[11px] text-slate-400 leading-relaxed">
          In the Firebase console open Project Settings, Cloud Messaging, Web configuration,
          and generate a key pair. Paste the public key here. It is stored once and used by all workspaces.
        </p>
        <div className="flex gap-2">
          <input
            value={vapidInput}
            onChange={(e) => setVapidInput(e.target.value)}
            placeholder="VAPID public key (starts with B...)"
            className="flex-1 bg-slate-900 border border-white/10 rounded-xl px-3 py-2 text-xs text-white font-mono placeholder:text-slate-600 outline-none focus:border-violet-500"
          />
          <button
            onClick={handleSave}
            disabled={saving || !vapidInput.trim()}
            className="px-4 py-2 bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white rounded-xl text-xs font-bold cursor-pointer flex items-center gap-1.5"
          >
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : saved ? <CheckCircle2 className="w-3.5 h-3.5" /> : null}
            {saved ? 'Saved' : 'Save key'}
          </button>
        </div>
      </div>
    </div>
  );
};
