import React, { useEffect, useState } from 'react';
import { Smartphone, Loader2, CheckCircle2, AlertTriangle, Zap } from 'lucide-react';
import { getSmsStatus, provisionSmsNumber, SMS_CREDITS_PER_SEGMENT } from '../../lib/sms';
import { SmsStatus } from '../../types/workspace';

interface SmsChannelCardProps {
  workspaceId: string;
}

/**
 * Real SMS channel state. Replaces demo connection data: the number is
 * provisioned on Twilio by the backend, and the card shows live allowance,
 * opt-in audience, and compliance state.
 */
export const SmsChannelCard: React.FC<SmsChannelCardProps> = ({ workspaceId }) => {
  const [status, setStatus] = useState<SmsStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [provisioning, setProvisioning] = useState(false);
  const [useLocal, setUseLocal] = useState(false);
  const [areaCode, setAreaCode] = useState('');
  const [error, setError] = useState<string | null>(null);

  const refresh = async () => {
    try {
      setStatus(await getSmsStatus(workspaceId));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load SMS status.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspaceId]);

  const handleEnable = async () => {
    setProvisioning(true);
    setError(null);
    try {
      await provisionSmsNumber(workspaceId, useLocal ? areaCode.trim() || undefined : undefined);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Provisioning failed. Try again.');
    } finally {
      setProvisioning(false);
    }
  };

  const allowance = status?.monthlyAllowance ?? 0;
  const used = status?.usedThisMonth ?? 0;
  const pct = allowance > 0 ? Math.min(100, Math.round((used / allowance) * 100)) : 0;

  return (
    <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl p-5 flex flex-col justify-between hover:border-white/20 transition-all md:col-span-2">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-slate-900/80 rounded-xl border border-white/10">
            <Smartphone className="w-6 h-6 text-amber-400" />
          </div>
          <div>
            <h3 className="font-bold text-white text-sm">SMS &amp; Mobile</h3>
            <p className="text-xs font-mono text-slate-400">
              {loading ? 'Checking status...' : status?.connected ? status.phoneNumber : 'No number yet'}
            </p>
          </div>
        </div>
        <span
          className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full border flex items-center gap-1 ${
            status?.connected
              ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30'
              : 'bg-slate-800 text-slate-400 border-white/10'
          }`}
        >
          <span className={`w-1.5 h-1.5 rounded-full ${status?.connected ? 'bg-emerald-400' : 'bg-slate-500'}`} />
          {status?.connected ? 'Connected' : 'Not enabled'}
        </span>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-xs text-slate-400 py-4">
          <Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading SMS status...
        </div>
      ) : !status?.connected ? (
        <div className="space-y-3">
          <p className="text-xs text-slate-400 leading-relaxed">
            Get a dedicated phone number for two-way texting and broadcast blasts. We handle the
            carrier registration and STOP/HELP compliance. Your plan covers{' '}
            <span className="text-white font-bold">{allowance.toLocaleString()} segments/month</span>;
            overage bills at {SMS_CREDITS_PER_SEGMENT} credits per segment.
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
              <input
                type="checkbox"
                checked={useLocal}
                onChange={(e) => setUseLocal(e.target.checked)}
                className="accent-amber-500"
              />
              Local number instead of toll-free
            </label>
            {useLocal && (
              <input
                value={areaCode}
                onChange={(e) => setAreaCode(e.target.value.replace(/\D/g, '').slice(0, 3))}
                placeholder="Area code"
                className="w-24 bg-slate-800/60 border border-white/10 rounded-xl px-2.5 py-1.5 text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-amber-500/50"
              />
            )}
          </div>
          {error && <p className="text-[11px] text-red-400">{error}</p>}
          <button
            onClick={handleEnable}
            disabled={provisioning}
            className="px-5 py-2.5 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 disabled:opacity-50 text-white rounded-xl text-xs font-bold cursor-pointer shadow-lg shadow-orange-500/20 flex items-center gap-2"
          >
            {provisioning ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5" />}
            <span>{provisioning ? 'Provisioning your number...' : 'Enable SMS'}</span>
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-xl bg-slate-900/60 border border-white/10 p-3 text-center">
              <p className="text-lg font-black text-white">{(status.optedIn ?? 0).toLocaleString()}</p>
              <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Opted in</p>
            </div>
            <div className="rounded-xl bg-slate-900/60 border border-white/10 p-3 text-center">
              <p className="text-lg font-black text-white">
                {allowance > 0 ? `${(allowance - used).toLocaleString()}` : '0'}
              </p>
              <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Segments left</p>
            </div>
            <div className="rounded-xl bg-slate-900/60 border border-white/10 p-3 text-center">
              <p className="text-lg font-black text-white flex items-center justify-center gap-1">
                {status.tenDlc === 'approved' || status.tenDlc === 'not_required' ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                ) : (
                  <AlertTriangle className="w-4 h-4 text-amber-400" />
                )}
              </p>
              <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">
                {status.tenDlc === 'pending' ? '10DLC pending' : 'Compliant'}
              </p>
            </div>
          </div>
          {allowance > 0 && (
            <div>
              <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
                <div className="h-full rounded-full bg-gradient-to-r from-amber-500 to-orange-500" style={{ width: `${pct}%` }} />
              </div>
              <p className="text-[10px] text-slate-500 mt-1">
                {used.toLocaleString()} of {allowance.toLocaleString()} monthly segments used
              </p>
            </div>
          )}
          {status.complianceNote && (
            <p className="text-[11px] text-slate-500 leading-relaxed">{status.complianceNote}</p>
          )}
          <p className="text-[11px] text-slate-500">
            Collect phone numbers with opt-in in your flows, then blast from the SMS tab. Replies
            land in Live Conversations. STOP/START/HELP are handled automatically.
          </p>
        </div>
      )}
    </div>
  );
};
