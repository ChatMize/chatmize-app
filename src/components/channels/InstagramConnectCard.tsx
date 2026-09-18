import React, { useEffect, useState } from 'react';
import { Instagram, Loader2, CheckCircle2, AlertTriangle, RefreshCw } from 'lucide-react';
import {
  startInstagramOAuth,
  getInstagramOAuthStatus,
  InstagramOAuthStatus,
} from '../../lib/instagram';
import { startMetaOAuth } from '../../lib/meta';
import { useCachedConnectionStatus, timeAgo } from '../../lib/useCachedConnectionStatus';

interface InstagramConnectCardProps {
  workspaceId: string;
  /** True when the workspace also has the Facebook Page anchor. */
  hasPageAnchor?: boolean;
  /** Opaque descriptor of where the user was, e.g. "app:settings_channels". */
  returnTo?: string;
  /** Fired after a successful Instagram connection. */
  onConnected?: (username: string, igUserId: string) => void;
}

/**
 * Instagram-only connection card. Drives Instagram Login through the
 * ChatMize-IG app: connect -> authorize -> the long-lived IG token is stored
 * as the workspace's own Secret Manager secret. Powers Instagram DMs without
 * requiring a Facebook Page.
 */
export const InstagramConnectCard: React.FC<InstagramConnectCardProps> = ({
  workspaceId,
  hasPageAnchor = false,
  returnTo,
  onConnected,
}) => {
  const [starting, setStarting] = useState(false);
  const [upgrading, setUpgrading] = useState(false);
  const [oauthError, setOauthError] = useState<string | null>(null);

  // Last known status renders instantly; a background check refreshes it and
  // only raises a flag when a working connection actually breaks.
  const {
    status,
    loading,
    revalidating,
    lastCheckedAt,
    connectionLost,
    error: checkError,
    refresh,
  } = useCachedConnectionStatus<InstagramOAuthStatus>({
    cacheKey: `chatmize_conn_ig_${workspaceId}`,
    fetchStatus: () => getInstagramOAuthStatus(workspaceId),
    isConnected: (s) => s?.connected ?? false,
  });

  useEffect(() => {
    // Handle the redirect back from Instagram.
    const params = new URLSearchParams(window.location.search);
    const outcome = params.get('instagram_oauth');
    if (outcome) {
      const clean = new URL(window.location.href);
      clean.searchParams.delete('instagram_oauth');
      clean.searchParams.delete('instagram_oauth_error');
      window.history.replaceState({}, '', clean.toString());
      if (outcome === 'error') {
        setOauthError(
          params.get('instagram_oauth_error') || 'Instagram login failed. Please try again.',
        );
        return;
      }
    }
    if (outcome === 'success') {
      refresh().then((s) => {
        if (s?.connected && s.igUserId) {
          onConnected?.(s.username || '', s.igUserId);
        }
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspaceId]);

  const handleConnect = async () => {
    setStarting(true);
    setOauthError(null);
    try {
      const url = await startInstagramOAuth(workspaceId, returnTo);
      window.location.href = url;
    } catch (e) {
      setOauthError(e instanceof Error ? e.message : 'Could not start Instagram login.');
      setStarting(false);
    }
  };

  const connected = status?.connected ?? false;

  /**
   * One click upgrade to the Facebook Page anchor (ManyChat style "change
   * connection"): reuses the Meta OAuth flow for the same workspace. The
   * backend re-anchors this Instagram account to the picked Page without
   * deleting anything; contacts, conversations, and automations stay put.
   */
  const handleUpgrade = async () => {
    setUpgrading(true);
    setOauthError(null);
    try {
      const url = await startMetaOAuth(workspaceId, returnTo);
      window.location.href = url;
    } catch (e) {
      setOauthError(e instanceof Error ? e.message : 'Could not start Facebook login.');
      setUpgrading(false);
    }
  };

  /** Plain connection type label so the anchor is always obvious. */
  const connectionLabel = status?.anchoredViaPage
    ? 'Connected via Facebook Page'
    : 'Connected via Instagram only';

  return (
    <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl p-5 flex flex-col justify-between hover:border-white/20 transition-all md:col-span-2">
      <div>
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-center gap-3">
            {connected && status?.pictureUrl ? (
              <div className="relative flex-shrink-0">
                <img
                  src={status.pictureUrl}
                  alt={status.username ?? 'Instagram account'}
                  className="w-12 h-12 rounded-xl object-cover border border-white/10"
                />
                <span
                  className="absolute -bottom-1.5 -right-1.5 w-6 h-6 rounded-full bg-gradient-to-br from-pink-500 via-fuchsia-500 to-purple-600 border-2 border-slate-900 flex items-center justify-center"
                  title="Instagram"
                >
                  <Instagram className="w-3 h-3 text-white" />
                </span>
              </div>
            ) : (
              <div className="p-3 bg-slate-900/80 rounded-xl border border-white/10">
                <Instagram className="w-6 h-6 text-pink-400" />
              </div>
            )}
            <div>
              <h3 className="font-bold text-white text-sm">Instagram Direct &amp; Comments</h3>
              <p className="text-xs font-mono text-slate-400">
                {loading
                  ? 'Checking connection...'
                  : connected
                    ? `@${status?.username}`
                    : 'Not connected'}
              </p>
            </div>
          </div>
          <span
            className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full border flex items-center gap-1 ${
              connected
                ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30'
                : 'bg-slate-800 text-slate-400 border-white/10'
            }`}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${connected ? 'bg-emerald-400' : 'bg-slate-500'}`} />
            {connected ? 'Connected' : 'Disconnected'}
          </span>
        </div>

        <p className="text-xs text-slate-400 mb-4 leading-relaxed">
          {connected
            ? `Automate DM triggers, story mentions, and post comment keyword replies on @${status?.username}. The Instagram token stays encrypted and scoped to this workspace only.`
            : 'Connect your Instagram professional account directly. No Facebook Page required, perfect for IG-first businesses and creators.'}
        </p>

        {connected && status?.igUserId && (
          <p className="text-[11px] text-slate-500 font-mono mb-3">
            IG ID {status.igUserId} · {connectionLabel}
          </p>
        )}

        {connected && (
          <div className="mb-4">
            <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-2">
              Connected channels
            </p>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="flex items-center gap-2 pl-1 pr-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30">
                {status?.pictureUrl ? (
                  <span className="relative flex-shrink-0">
                    <img src={status.pictureUrl} alt="" className="w-6 h-6 rounded-full object-cover" />
                    <span
                      className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-gradient-to-br from-pink-500 to-purple-600 border border-slate-900 flex items-center justify-center"
                      title="Instagram"
                    >
                      <Instagram className="w-2 h-2 text-white" />
                    </span>
                  </span>
                ) : (
                  <Instagram className="w-4 h-4 text-pink-400 ml-1" />
                )}
                <span className="text-[11px] font-medium text-emerald-200">
                  @{status?.username} · DMs
                </span>
              </span>
              <span className="flex items-center gap-2 pl-1 pr-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30">
                <Instagram className="w-4 h-4 text-pink-400 ml-1" />
                <span className="text-[11px] font-medium text-emerald-200">Comments</span>
              </span>
            </div>
          </div>
        )}

        {connected && !hasPageAnchor && !status?.anchoredViaPage && (
          <div className="mb-4 p-3 rounded-xl bg-cyan-500/10 border border-cyan-500/25">
            <p className="text-xs text-cyan-200 leading-relaxed mb-2.5">
              Also run a Facebook Page? Upgrade to a Facebook connection to add
              Messenger and send Instagram DMs on your Page token. Your
              contacts, conversations, and automations stay put.
            </p>
            <button
              onClick={handleUpgrade}
              disabled={upgrading}
              className="px-3 py-1.5 rounded-xl text-[11px] font-semibold transition-all cursor-pointer flex items-center gap-1.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white shadow-sm disabled:opacity-60"
            >
              {upgrading ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Redirecting...
                </>
              ) : (
                'Upgrade to Facebook connection'
              )}
            </button>
          </div>
        )}

        {connectionLost && (
          <div className="mb-4 p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-xs text-amber-200 font-semibold">Instagram connection lost</p>
              <p className="text-xs text-amber-200/70">Reconnect to keep DMs and comments working.</p>
            </div>
            <button
              onClick={handleConnect}
              className="px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-gradient-to-r from-pink-500 to-purple-600 text-white cursor-pointer"
            >
              Reconnect
            </button>
          </div>
        )}

        {(oauthError || checkError) && (
          <div className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/25 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-red-300">{oauthError || checkError}</p>
          </div>
        )}
      </div>

      <div className="pt-3 border-t border-white/10 flex items-center justify-between text-xs">
        <span className="text-slate-400 flex items-center gap-1.5">
          {connected ? (
            <>
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              <Instagram className="w-3.5 h-3.5 text-pink-400" />
              Instagram DMs ready
              {lastCheckedAt && (
                <span className="text-slate-500">· checked {timeAgo(lastCheckedAt)}</span>
              )}
              {revalidating && <Loader2 className="w-3 h-3 animate-spin text-slate-500" />}
            </>
          ) : (
            'No Facebook Page needed'
          )}
        </span>

        {connected ? (
          <button
            onClick={() => refresh()}
            className="px-3 py-1.5 rounded-xl font-semibold transition-all cursor-pointer flex items-center gap-1.5 bg-white/5 hover:bg-white/10 text-slate-300 border border-white/10"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Refresh
          </button>
        ) : (
          <button
            onClick={handleConnect}
            disabled={starting}
            className="px-3 py-1.5 rounded-xl font-semibold transition-all cursor-pointer flex items-center gap-1.5 bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-400 hover:to-purple-500 text-white shadow-sm disabled:opacity-60"
          >
            {starting ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Connecting...
              </>
            ) : (
              <>
                <Instagram className="w-3.5 h-3.5" />
                Connect Instagram
              </>
            )}
          </button>
        )}
      </div>
    </div>
  );
};
