import React, { useEffect, useState } from 'react';
import { Facebook, Loader2, CheckCircle2, AlertTriangle, RefreshCw, Search } from 'lucide-react';
import {
  startMetaOAuth,
  getMetaOAuthStatus,
  listMetaOAuthPages,
  selectMetaOAuthPage,
  MetaOAuthStatus,
  MetaPage,
} from '../../lib/meta';

interface MetaConnectCardProps {
  workspaceId: string;
  /** Fired after a Page is picked and the token is stored. Lets parents (e.g. onboarding) sync local state. */
  onConnected?: (pageName: string, pageId: string) => void;
  /** Opaque descriptor of where the user was, e.g. "onboarding:connect" or "app:settings_channels".
   *  Sent through the OAuth state and returned as ?return_to= so the app can restore the spot. */
  returnTo?: string;
}

/**
 * Real Meta connection card. Drives Facebook Login for Business:
 * connect -> pick one of the user's Pages -> the page token is stored as the
 * workspace's own Secret Manager secret. Powers Messenger + Instagram.
 */
export const MetaConnectCard: React.FC<MetaConnectCardProps> = ({ workspaceId, onConnected, returnTo }) => {
  const [status, setStatus] = useState<MetaOAuthStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [pages, setPages] = useState<MetaPage[]>([]);
  const [showPicker, setShowPicker] = useState(false);
  const [selecting, setSelecting] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pageQuery, setPageQuery] = useState('');

  const refresh = async (): Promise<MetaOAuthStatus | null> => {
    try {
      const s = await getMetaOAuthStatus(workspaceId);
      setStatus(s);
      if (s.pending) {
        const p = await listMetaOAuthPages(workspaceId);
        setPages(p);
        if (p.length > 0) setShowPicker(true);
      }
      return s;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load Meta status.');
      return null;
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Handle the redirect back from Facebook.
    const params = new URLSearchParams(window.location.search);
    const outcome = params.get('meta_oauth');
    if (outcome) {
      const clean = new URL(window.location.href);
      clean.searchParams.delete('meta_oauth');
      clean.searchParams.delete('meta_oauth_error');
      window.history.replaceState({}, '', clean.toString());
      if (outcome === 'error') {
        setError(
          params.get('meta_oauth_error') || 'Facebook login failed. Please try again.',
        );
        setLoading(false);
        return;
      }
    }
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspaceId]);

  const handleConnect = async () => {
    setStarting(true);
    setError(null);
    try {
      const url = await startMetaOAuth(workspaceId, returnTo);
      window.location.href = url;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not start Facebook login.');
      setStarting(false);
    }
  };

  const handleSelect = async (pageId: string) => {
    setSelecting(pageId);
    setError(null);
    try {
      await selectMetaOAuthPage(workspaceId, pageId);
      setShowPicker(false);
      setPages([]);
      const s = await refresh();
      if (s?.connected && s.pageId) {
        onConnected?.(s.pageName || '', s.pageId);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not connect that Page.');
    } finally {
      setSelecting(null);
    }
  };

  const connected = status?.connected ?? false;

  return (
    <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl p-5 flex flex-col justify-between hover:border-white/20 transition-all md:col-span-2">
      <div>
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-slate-900/80 rounded-xl border border-white/10">
              <Facebook className="w-6 h-6 text-blue-500" />
            </div>
            <div>
              <h3 className="font-bold text-white text-sm">Facebook Page (Meta Anchor)</h3>
              <p className="text-xs font-mono text-slate-400">
                {loading ? 'Checking connection...' : connected ? status?.pageName : 'Not connected'}
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
          Connect your Facebook Page with Facebook Login. This is the Meta anchor for the
          workspace: Messenger and Instagram messaging run on this Page's token, stored
          encrypted and scoped to this workspace only.
        </p>

        {connected && status?.pageId && (
          <p className="text-[11px] text-slate-500 font-mono mb-3">Page ID {status.pageId}</p>
        )}

        {error && (
          <div className="mb-3 p-2.5 rounded-xl bg-red-500/10 border border-red-500/25 text-red-300 text-xs flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}
      </div>

      <div className="pt-3 border-t border-white/10 flex items-center justify-between text-xs">
        <span className="text-slate-400">
          {connected ? 'Messenger + Instagram ready' : 'Ready to authenticate'}
        </span>
        <button
          onClick={handleConnect}
          disabled={starting || loading}
          className="px-3 py-1.5 rounded-xl font-semibold transition-all cursor-pointer flex items-center gap-1.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white shadow-sm disabled:opacity-60"
        >
          {starting ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : connected ? (
            <RefreshCw className="w-3.5 h-3.5" />
          ) : (
            <Facebook className="w-3.5 h-3.5" />
          )}
          {starting ? 'Redirecting...' : connected ? 'Reconnect' : 'Connect with Facebook'}
        </button>
      </div>

      {showPicker && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-slate-900 border border-white/10 rounded-2xl p-6 w-full max-w-2xl shadow-2xl">
            <div className="flex items-center gap-2 mb-1">
              <CheckCircle2 className="w-5 h-5 text-emerald-400" />
              <h3 className="font-bold text-white">Choose your Facebook Page</h3>
            </div>
            <p className="text-xs text-slate-400 mb-3">
              Pick the Page ChatMize should send and receive messages as.
            </p>
            <div className="relative mb-3">
              <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={pageQuery}
                onChange={(e) => setPageQuery(e.target.value)}
                placeholder="Search pages by name or ID..."
                className="w-full pl-9 pr-3 py-2 rounded-xl bg-white/5 border border-white/10 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-blue-500/60"
              />
            </div>
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {pages
                .filter((page) => {
                  const q = pageQuery.trim().toLowerCase();
                  if (!q) return true;
                  return page.name.toLowerCase().includes(q) || page.id.includes(q);
                })
                .map((page) => (
                <button
                  key={page.id}
                  onClick={() => handleSelect(page.id)}
                  disabled={selecting !== null}
                  className="w-full text-left p-3 rounded-xl border border-white/10 bg-white/5 hover:border-blue-500/40 hover:bg-blue-500/5 transition-all cursor-pointer disabled:opacity-60 flex items-center justify-between gap-3"
                >
                  <div>
                    <div className="text-sm font-semibold text-white">{page.name}</div>
                    <div className="text-[11px] font-mono text-slate-500">{page.id}</div>
                  </div>
                  {selecting === page.id && <Loader2 className="w-4 h-4 animate-spin text-blue-400" />}
                </button>
              ))}
            </div>
            {pages.length === 0 && (
              <p className="text-xs text-slate-500">No pages found on this Facebook account.</p>
            )}
            <button
              onClick={() => { setShowPicker(false); setPageQuery(''); }}
              className="mt-4 w-full py-2 rounded-xl text-xs font-semibold bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 transition-all cursor-pointer"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
