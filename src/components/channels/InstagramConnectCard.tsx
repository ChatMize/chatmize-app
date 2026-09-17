import React, { useEffect, useState } from 'react';
import { Instagram, Loader2, CheckCircle2, AlertTriangle, RefreshCw } from 'lucide-react';
import {
  startInstagramOAuth,
  getInstagramOAuthStatus,
  InstagramOAuthStatus,
} from '../../lib/instagram';

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
  const [status, setStatus] = useState<InstagramOAuthStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = async (): Promise<InstagramOAuthStatus | null> => {
    try {
      const s = await getInstagramOAuthStatus(workspaceId);
      setStatus(s);
      return s;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load Instagram status.');
      return null;
    } finally {
      setLoading(false);
    }
  };

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
        setError(
          params.get('instagram_oauth_error') || 'Instagram login failed. Please try again.',
        );
        setLoading(false);
        return;
      }
    }
    refresh().then((s) => {
      if (s?.connected && s.igUserId && outcome === 'success') {
        onConnected?.(s.username || '', s.igUserId);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspaceId]);

  const handleConnect = async () => {
    setStarting(true);
    setError(null);
    try {
      const url = await startInstagramOAuth(workspaceId, returnTo);
      window.location.href = url;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not start Instagram login.');
      setStarting(false);
    }
  };

  const connected = status?.connected ?? false;

  return (
    <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl p-5 flex flex-col justify-between hover:border-white/20 transition-all">
      <div>
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-center gap-3">
            {connected && status?.pictureUrl ? (
              <img
                src={status.pictureUrl}
                alt={status.username ?? 'Instagram account'}
                className="w-12 h-12 rounded-xl object-cover border border-white/10"
              />
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
          <p className="text-[11px] text-slate-500 font-mono mb-3">IG ID {status.igUserId}</p>
        )}

        {connected && !hasPageAnchor && (
          <div className="mb-4 p-3 rounded-xl bg-cyan-500/10 border border-cyan-500/25">
            <p className="text-xs text-cyan-200 leading-relaxed">
              Upgrade path: also run a Facebook Page? Connect it as your Meta anchor to add
              Messenger and merge both channels under one workspace.
            </p>
          </div>
        )}

        {error && (
          <div className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/25 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-red-300">{error}</p>
          </div>
        )}
      </div>

      <div className="pt-3 border-t border-white/10 flex items-center justify-between text-xs">
        <span className="text-slate-400 flex items-center gap-1.5">
          {connected ? (
            <>
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              Instagram DMs ready
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
