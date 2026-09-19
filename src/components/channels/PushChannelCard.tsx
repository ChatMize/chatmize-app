import React, { useEffect, useState } from 'react';
import { BellRing, Loader2, CheckCircle2, AlertTriangle, Copy, Send, KeyRound, BellPlus } from 'lucide-react';
import {
  getPushStatus, setPushVapidKey, sendPush, enableBrowserPush,
  getStoredPushToken, type PushStatus,
} from '../../lib/push';
import { getAuth } from 'firebase/auth';

interface PushChannelCardProps {
  workspaceId: string;
}

/**
 * Web push notification channel card. Status, subscriber count, Super Admin
 * VAPID setup, test send, and the business subscribe link. The opt in prompt
 * builder lives in PushOptinBuilder, mounted right below in Settings.
 */
export const PushChannelCard: React.FC<PushChannelCardProps> = ({ workspaceId }) => {
  const [status, setStatus] = useState<PushStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [vapidInput, setVapidInput] = useState('');
  const [savingVapid, setSavingVapid] = useState(false);
  const [testTitle, setTestTitle] = useState('Test notification');
  const [testBody, setTestBody] = useState('Push notifications are working on this workspace.');
  const [testLinkType, setTestLinkType] = useState<'messenger' | 'onpage' | 'website'>('website');
  const [testLinkValue, setTestLinkValue] = useState('');
  const [sending, setSending] = useState(false);
  const [sendResult, setSendResult] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [enablingAlerts, setEnablingAlerts] = useState(false);
  const [alertsOn, setAlertsOn] = useState(false);

  const refresh = async () => {
    try {
      setStatus(await getPushStatus(workspaceId));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load push status.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { refresh(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [workspaceId]);

  const subscribeLink = `${window.location.origin}${window.location.pathname}?push=${workspaceId}`;

  const handleCopy = async () => {
    try { await navigator.clipboard.writeText(subscribeLink); } catch {
      const ta = document.createElement('textarea');
      ta.value = subscribeLink; document.body.appendChild(ta); ta.select();
      document.execCommand('copy'); ta.remove();
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSaveVapid = async () => {
    setSavingVapid(true); setError(null);
    try {
      await setPushVapidKey(vapidInput.trim());
      setVapidInput('');
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save the key.');
    } finally {
      setSavingVapid(false);
    }
  };

  const handleTestSend = async () => {
    setSending(true); setSendResult(null); setError(null);
    try {
      const r = await sendPush({ workspaceId, title: testTitle, body: testBody, linkType: testLinkType, linkValue: testLinkValue || undefined });
      setSendResult(`Sent to ${r.sent} subscriber${r.sent === 1 ? '' : 's'}${r.failed ? `, ${r.failed} failed` : ''}.`);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Send failed.');
    } finally {
      setSending(false);
    }
  };

  const handleEnableAlerts = async () => {
    setEnablingAlerts(true); setError(null);
    try {
      const uid = getAuth().currentUser?.uid;
      if (!uid) throw new Error('Sign in first.');
      if (!status?.configured) throw new Error('Push is not set up yet. Add the VAPID key first.');
      const cfg = await getPushPublicConfigSafe();
      const r = await enableBrowserPush({ workspaceId, vapidPublicKey: cfg, ownerUid: uid });
      if (r.status === 'subscribed') {
        setAlertsOn(true);
      } else if (r.status === 'blocked') {
        setError('Notifications are blocked for this site. Allow them in your browser settings, then try again.');
      } else if (r.status === 'denied') {
        setError('Permission was not granted.');
      } else {
        setError(r.message || 'Could not enable browser alerts.');
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not enable browser alerts.');
    } finally {
      setEnablingAlerts(false);
    }
  };

  const getPushPublicConfigSafe = async (): Promise<string> => {
    const { getPushPublicConfig } = await import('../../lib/push');
    const cfg = await getPushPublicConfig(workspaceId);
    if (!cfg.configured || !cfg.vapidPublicKey) throw new Error('Push is not configured yet.');
    return cfg.vapidPublicKey;
  };

  useEffect(() => { setAlertsOn(!!getStoredPushToken()); }, []);

  const configured = !!status?.configured;

  return (
    <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl p-5 flex flex-col justify-between hover:border-white/20 transition-all md:col-span-2">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-slate-900/80 rounded-xl border border-white/10">
            <BellRing className="w-6 h-6 text-violet-400" />
          </div>
          <div>
            <h3 className="font-bold text-white text-sm">Web Push Notifications</h3>
            <p className="text-xs font-mono text-slate-400">
              {loading ? 'Checking status...' : configured
                ? `${status?.subscriberCount ?? 0} subscriber${(status?.subscriberCount ?? 0) === 1 ? '' : 's'}`
                : 'Not set up yet'}
            </p>
          </div>
        </div>
        <span className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full border flex items-center gap-1 ${
          configured
            ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30'
            : 'bg-slate-800 text-slate-400 border-white/10'
        }`}>
          <span className={`w-1.5 h-1.5 rounded-full ${configured ? 'bg-emerald-400' : 'bg-slate-500'}`} />
          {configured ? 'Live' : 'Setup needed'}
        </span>
      </div>

      <p className="text-xs text-slate-400 mb-4 leading-relaxed">
        Send browser notifications straight to subscriber devices. No app install, no per message
        cost. Businesses collect subscribers with the opt in prompt, then send from broadcasts,
        BotMaps flows, and booking reminders.
      </p>

      {error && (
        <div className="mb-3 p-3 rounded-xl bg-red-500/10 border border-red-500/25 text-red-300 text-xs flex gap-2">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" /> {error}
        </div>
      )}

      {/* Super Admin VAPID setup */}
      {status?.isSuperAdmin && !configured && (
        <div className="mb-4 p-4 rounded-xl bg-violet-500/5 border border-violet-500/25 space-y-2.5">
          <div className="flex items-center gap-2 text-xs font-bold text-violet-300">
            <KeyRound className="w-4 h-4" /> Super Admin: connect Web Push
          </div>
          <p className="text-[11px] text-slate-400 leading-relaxed">
            In the Firebase console open Project Settings, Cloud Messaging, Web configuration,
            and generate a key pair. Paste the public key here once. It powers push for every workspace.
          </p>
          <div className="flex gap-2">
            <input
              value={vapidInput}
              onChange={(e) => setVapidInput(e.target.value)}
              placeholder="VAPID public key (starts with B...)"
              className="flex-1 bg-slate-900 border border-white/10 rounded-xl px-3 py-2 text-xs text-white font-mono placeholder:text-slate-600 outline-none focus:border-violet-500"
            />
            <button
              onClick={handleSaveVapid}
              disabled={savingVapid || !vapidInput.trim()}
              className="px-4 py-2 bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white rounded-xl text-xs font-bold cursor-pointer flex items-center gap-1.5"
            >
              {savingVapid && <Loader2 className="w-3.5 h-3.5 animate-spin" />} Save key
            </button>
          </div>
        </div>
      )}
      {status?.isSuperAdmin && configured && (
        <div className="mb-4 flex items-center gap-2 text-[11px] text-emerald-300 bg-emerald-500/10 border border-emerald-500/25 rounded-xl px-3 py-2">
          <CheckCircle2 className="w-4 h-4" /> Web Push connected for all workspaces.
        </div>
      )}
      {!status?.isSuperAdmin && !configured && !loading && (
        <div className="mb-4 text-[11px] text-amber-300 bg-amber-500/10 border border-amber-500/25 rounded-xl px-3 py-2">
          Web Push is not connected yet. A Super Admin adds the key once, then this channel goes live.
        </div>
      )}

      {configured && (
        <>
          {/* Subscribe link */}
          <div className="mb-4">
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">Subscriber signup page</div>
            <div className="flex gap-2">
              <input
                readOnly
                value={subscribeLink}
                className="flex-1 bg-slate-900 border border-white/10 rounded-xl px-3 py-2 text-[11px] text-slate-300 font-mono outline-none"
              />
              <button
                onClick={handleCopy}
                className="px-3 py-2 bg-white/10 hover:bg-white/15 text-white rounded-xl text-xs font-bold cursor-pointer flex items-center gap-1.5"
              >
                {copied ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                {copied ? 'Copied' : 'Copy'}
              </button>
            </div>
          </div>

          {/* Test send */}
          <div className="mb-4 p-4 rounded-xl bg-slate-900/50 border border-white/10 space-y-2.5">
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Send a test</div>
            <input
              value={testTitle}
              onChange={(e) => setTestTitle(e.target.value)}
              maxLength={120}
              placeholder="Title"
              className="w-full bg-slate-900 border border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder:text-slate-600 outline-none focus:border-violet-500"
            />
            <textarea
              value={testBody}
              onChange={(e) => setTestBody(e.target.value)}
              maxLength={500}
              rows={2}
              placeholder="Message"
              className="w-full bg-slate-900 border border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder:text-slate-600 outline-none focus:border-violet-500 resize-none"
            />
            <div className="flex gap-1.5">
              {(['messenger', 'onpage', 'website'] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTestLinkType(t)}
                  className={`flex-1 px-2 py-1.5 rounded-lg border text-[10px] font-semibold cursor-pointer transition-all ${
                    testLinkType === t
                      ? 'bg-violet-500/20 border-violet-500/50 text-violet-200'
                      : 'bg-slate-900 border-white/10 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {t === 'messenger' ? 'Messenger' : t === 'onpage' ? 'On page chat' : 'Website'}
                </button>
              ))}
            </div>
            <input
              value={testLinkValue}
              onChange={(e) => setTestLinkValue(e.target.value)}
              placeholder={testLinkType === 'messenger' ? 'Username or m.me link (optional)' : testLinkType === 'onpage' ? 'Page URL, chat opens on tap (optional)' : 'Full https URL (optional)'}
              className="w-full bg-slate-900 border border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder:text-slate-600 outline-none focus:border-violet-500"
            />
            <button
              onClick={handleTestSend}
              disabled={sending || !testTitle.trim() || !testBody.trim()}
              className="px-4 py-2 bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white rounded-xl text-xs font-bold cursor-pointer flex items-center gap-1.5"
            >
              {sending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
              Send to all subscribers
            </button>
            {sendResult && (
              <div className="text-[11px] text-emerald-300 flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5" /> {sendResult}
              </div>
            )}
          </div>

          {/* Owner browser alerts */}
          <button
            onClick={handleEnableAlerts}
            disabled={enablingAlerts || alertsOn}
            className="px-4 py-2.5 bg-white/10 hover:bg-white/15 disabled:opacity-60 text-white rounded-xl text-xs font-bold cursor-pointer flex items-center justify-center gap-2"
          >
            {enablingAlerts ? <Loader2 className="w-4 h-4 animate-spin" /> : <BellPlus className="w-4 h-4 text-violet-300" />}
            {alertsOn ? 'Browser alerts on for this device' : 'Notify me in this browser (owner alerts)'}
          </button>
          <p className="text-[10px] text-slate-500 mt-1.5 leading-relaxed">
            Owner alerts like channel reconnect warnings can reach you here once the alert system is wired up.
          </p>
        </>
      )}
    </div>
  );
};
