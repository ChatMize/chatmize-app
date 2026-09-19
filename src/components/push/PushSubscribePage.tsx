import React, { useEffect, useState } from 'react';
import { BellRing, Loader2, CheckCircle2, AlertTriangle, BellOff } from 'lucide-react';
import {
  getPushPublicConfig, enableBrowserPush, unsubscribePushToken,
  getStoredPushToken, clearStoredPushToken, type PushPublicConfig,
} from '../../lib/push';

/**
 * Public push signup page, rendered without login when the URL carries
 * ?push=<workspaceId>. Add &embed=1 for the compact iframe version.
 */
export const PushSubscribePage: React.FC<{ workspaceId: string; embed: boolean }> = ({ workspaceId, embed }) => {
  const [config, setConfig] = useState<PushPublicConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [state, setState] = useState<'ask' | 'done' | 'denied' | 'blocked' | 'unsupported' | 'error' | 'unsubscribed'>('ask');
  const [errorMsg, setErrorMsg] = useState('');
  const [alreadySubbed, setAlreadySubbed] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const cfg = await getPushPublicConfig(workspaceId);
        setConfig(cfg);
        if (cfg.configured && getStoredPushToken()) setAlreadySubbed(true);
      } catch {
        setConfig({ configured: false });
      } finally {
        setLoading(false);
      }
    })();
  }, [workspaceId]);

  const handleAllow = async () => {
    if (!config?.vapidPublicKey) return;
    setBusy(true);
    const r = await enableBrowserPush({ workspaceId, vapidPublicKey: config.vapidPublicKey });
    setBusy(false);
    if (r.status === 'subscribed') { setState('done'); setAlreadySubbed(true); }
    else if (r.status === 'denied') setState('denied');
    else if (r.status === 'blocked') setState('blocked');
    else if (r.status === 'unsupported') setState('unsupported');
    else { setErrorMsg(r.message || 'Something went wrong.'); setState('error'); }
  };

  const handleUnsubscribe = async () => {
    const token = getStoredPushToken();
    if (!token) return;
    setBusy(true);
    try {
      await unsubscribePushToken(workspaceId, token);
      clearStoredPushToken();
      setAlreadySubbed(false);
      setState('unsubscribed');
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : 'Could not unsubscribe.');
      setState('error');
    } finally {
      setBusy(false);
    }
  };

  const prompt = config?.prompt ?? {
    headline: 'Get updates from us',
    subtext: 'Tap allow and we will send you helpful updates right in your browser.',
    allowLabel: 'Allow notifications',
    dismissLabel: 'Not now',
  };

  const shell = (children: React.ReactNode) => (
    <div className={embed ? '' : 'min-h-screen bg-gradient-to-br from-slate-950 via-violet-950/30 to-slate-950 flex items-center justify-center p-6'}>
      <div className={`w-full ${embed ? '' : 'max-w-sm'} bg-slate-900 border border-white/10 rounded-2xl p-6 shadow-2xl`}>
        {children}
      </div>
    </div>
  );

  if (loading) {
    return shell(
      <div className="flex items-center justify-center py-10">
        <Loader2 className="w-6 h-6 text-violet-400 animate-spin" />
      </div>
    );
  }

  if (!config?.configured) {
    return shell(
      <div className="text-center py-6">
        <AlertTriangle className="w-8 h-8 text-amber-400 mx-auto mb-3" />
        <div className="text-white font-bold text-sm mb-1">Notifications are not available yet</div>
        <p className="text-xs text-slate-400">This business has not turned on push notifications.</p>
      </div>
    );
  }

  if (state === 'done' || alreadySubbed) {
    return shell(
      <div className="text-center py-6">
        <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto mb-3" />
        <div className="text-white font-bold text-sm mb-1">You are subscribed</div>
        <p className="text-xs text-slate-400 mb-4">
          {config.workspaceName} can now send you updates right in your browser.
        </p>
        <button
          onClick={handleUnsubscribe}
          disabled={busy}
          className="text-[11px] text-slate-500 hover:text-slate-300 font-semibold cursor-pointer flex items-center gap-1.5 mx-auto"
        >
          {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <BellOff className="w-3.5 h-3.5" />}
          Unsubscribe
        </button>
      </div>
    );
  }

  if (state === 'unsubscribed') {
    return shell(
      <div className="text-center py-6">
        <BellOff className="w-10 h-10 text-slate-500 mx-auto mb-3" />
        <div className="text-white font-bold text-sm mb-1">Unsubscribed</div>
        <p className="text-xs text-slate-400">You will not receive push notifications anymore.</p>
      </div>
    );
  }

  if (state === 'blocked' || state === 'denied') {
    return shell(
      <div className="text-center py-6">
        <AlertTriangle className="w-10 h-10 text-amber-400 mx-auto mb-3" />
        <div className="text-white font-bold text-sm mb-1">
          {state === 'blocked' ? 'Notifications are blocked' : 'No problem'}
        </div>
        <p className="text-xs text-slate-400 leading-relaxed">
          {state === 'blocked'
            ? 'Your browser is blocking notifications for this site. Open your browser site settings, allow notifications, then come back here.'
            : 'You can turn notifications on anytime by revisiting this page.'}
        </p>
      </div>
    );
  }

  if (state === 'unsupported') {
    return shell(
      <div className="text-center py-6">
        <AlertTriangle className="w-10 h-10 text-amber-400 mx-auto mb-3" />
        <div className="text-white font-bold text-sm mb-1">Not supported here</div>
        <p className="text-xs text-slate-400">This browser or device does not support web push notifications.</p>
      </div>
    );
  }

  if (state === 'error') {
    return shell(
      <div className="text-center py-6">
        <AlertTriangle className="w-10 h-10 text-red-400 mx-auto mb-3" />
        <div className="text-white font-bold text-sm mb-1">Something went wrong</div>
        <p className="text-xs text-slate-400 mb-4">{errorMsg}</p>
        <button
          onClick={() => setState('ask')}
          className="px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white rounded-xl text-xs font-bold cursor-pointer"
        >
          Try again
        </button>
      </div>
    );
  }

  return shell(
    <>
      <div className="flex items-center gap-3 mb-3">
        <div className="p-3 bg-violet-500/20 rounded-xl">
          <BellRing className="w-6 h-6 text-violet-300" />
        </div>
        <div>
          <div className="font-bold text-white leading-tight">{prompt.headline}</div>
          {config.workspaceName && (
            <div className="text-[11px] text-slate-500">from {config.workspaceName}</div>
          )}
        </div>
      </div>
      <p className="text-xs text-slate-400 leading-relaxed mb-5">{prompt.subtext}</p>
      <button
        onClick={handleAllow}
        disabled={busy}
        className="w-full py-3 bg-violet-600 hover:bg-violet-500 disabled:opacity-60 text-white rounded-xl text-sm font-bold cursor-pointer flex items-center justify-center gap-2"
      >
        {busy && <Loader2 className="w-4 h-4 animate-spin" />}
        {prompt.allowLabel}
      </button>
      {!embed && (
        <button
          onClick={() => setState('denied')}
          className="w-full py-2.5 text-slate-500 hover:text-slate-300 text-xs font-semibold cursor-pointer"
        >
          {prompt.dismissLabel}
        </button>
      )}
      <p className="text-[10px] text-slate-600 text-center mt-3">
        Powered by ChatMize. Unsubscribe anytime.
      </p>
    </>
  );
};
