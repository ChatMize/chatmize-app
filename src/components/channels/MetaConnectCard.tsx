import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Facebook, Instagram, MessageCircle, Loader2, CheckCircle2, AlertTriangle, RefreshCw, Search, X } from 'lucide-react';
import {
  startMetaOAuth,
  getMetaOAuthStatus,
  listMetaOAuthPages,
  selectMetaOAuthPage,
  MetaOAuthStatus,
  MetaPage,
} from '../../lib/meta';
import {
  getWhatsAppOAuthStatus,
  WhatsAppOAuthStatus,
} from '../../lib/whatsapp';
import { useCachedConnectionStatus, timeAgo } from '../../lib/useCachedConnectionStatus';

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
  const [starting, setStarting] = useState(false);
  const [pages, setPages] = useState<MetaPage[]>([]);
  const [showPicker, setShowPicker] = useState(false);
  const [selecting, setSelecting] = useState<string | null>(null);
  const [oauthError, setOauthError] = useState<string | null>(null);
  const [pageQuery, setPageQuery] = useState('');
  const [pagesLoading, setPagesLoading] = useState(false);
  const [pagesError, setPagesError] = useState<string | null>(null);
  const [connectedAs, setConnectedAs] = useState<string | null>(null);

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
  } = useCachedConnectionStatus<MetaOAuthStatus>({
    cacheKey: `chatmize_conn_meta_${workspaceId}`,
    fetchStatus: () => getMetaOAuthStatus(workspaceId),
    isConnected: (s) => s?.connected ?? false,
    onFresh: (s) => {
      if (s.pending) {
        loadPages(true);
      }
    },
  });
  // WhatsApp connection state for the status pills. Separate flow, separate
  // status — the pill must reflect reality, not a hardcoded placeholder.
  const { status: waStatus } = useCachedConnectionStatus<WhatsAppOAuthStatus>({
    cacheKey: `chatmize_conn_whatsapp_${workspaceId}`,
    fetchStatus: () => getWhatsAppOAuthStatus(workspaceId),
    isConnected: (s) => s?.connected ?? false,
  });
  // Close the page picker on Escape.
  useEffect(() => {
    if (!showPicker) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowPicker(false);
        setPageQuery('');
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [showPicker]);

  const closePicker = () => {
    setShowPicker(false);
    setPageQuery('');
  };

  /** Load the pending pages with visible loading/error states. Retries once on empty. */
  const loadPages = async (openOnSuccess: boolean): Promise<MetaPage[]> => {
    setPagesLoading(true);
    setPagesError(null);
    try {
      let result = await listMetaOAuthPages(workspaceId);
      if (result.pages.length === 0) {
        // One automatic retry: the pending write can lag the redirect by a beat.
        await new Promise((r) => setTimeout(r, 1500));
        result = await listMetaOAuthPages(workspaceId);
      }
      const p = result.pages;
      setPages(p);
      setConnectedAs(result.connectedAs ?? null);
      if (openOnSuccess && p.length > 0) setShowPicker(true);
      if (p.length === 0) {
        setPagesError('No pages came back from Facebook. Check that you granted the Pages permission, then try again.');
      }
      return p;
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Could not load your Facebook Pages.';
      setPagesError(msg);
      return [];
    } finally {
      setPagesLoading(false);
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
        setOauthError(
          params.get('meta_oauth_error') || 'Facebook login failed. Please try again.',
        );
        return;
      }
    }
    if (outcome === 'success') {
      // The hook already revalidates on mount; this ensures the fresh pick
      // is applied and the parent is notified.
      refresh();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspaceId]);

  const handleConnect = async () => {
    setStarting(true);
    setOauthError(null);
    try {
      const url = await startMetaOAuth(workspaceId, returnTo);
      window.location.href = url;
    } catch (e) {
      setOauthError(e instanceof Error ? e.message : 'Could not start Facebook login.');
      setStarting(false);
    }
  };

  const handleSelect = async (pageId: string) => {
    setSelecting(pageId);
    setOauthError(null);
    try {
      await selectMetaOAuthPage(workspaceId, pageId);
      setShowPicker(false);
      setPages([]);
      const s = await refresh();
      if (s?.connected && s.pageId) {
        onConnected?.(s.pageName || '', s.pageId);
      }
    } catch (e) {
      setOauthError(e instanceof Error ? e.message : 'Could not connect that Page.');
    } finally {
      setSelecting(null);
    }
  };

  const connected = status?.connected ?? false;
  /** Meta killed the page token (error 190). Inbound keeps flowing; outbound
   * stays broken until the owner reconnects. This is the persistent flag. */
  const tokenInvalid = status?.tokenInvalid ?? false;

  const pageQueryLower = pageQuery.trim().toLowerCase();
  // Normalize: ignore spaces, dashes, and other punctuation so
  // "tester555121" matches "Tester 555121", "Tester-555121", etc.
  const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
  const queryNorm = normalize(pageQueryLower);
  const filteredPages = pages.filter(
    (page) =>
      !queryNorm ||
      normalize(page.name).includes(queryNorm) ||
      page.id.includes(pageQueryLower),
  );

  return (
    <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl p-5 flex flex-col justify-between hover:border-white/20 transition-all md:col-span-2">
      <div>
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-center gap-3">
            {connected && status?.pagePictureUrl ? (
              <div className="relative flex-shrink-0">
                <img
                  src={status.pagePictureUrl}
                  alt={status.pageName ?? 'Facebook Page'}
                  className="w-12 h-12 rounded-xl object-cover border border-white/10"
                />
                <span
                  className="absolute -bottom-1.5 -right-1.5 w-6 h-6 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 border-2 border-slate-900 flex items-center justify-center"
                  title="Facebook"
                >
                  <Facebook className="w-3 h-3 text-white" />
                </span>
              </div>
            ) : (
              <div className="p-3 bg-slate-900/80 rounded-xl border border-white/10">
                <Facebook className="w-6 h-6 text-blue-500" />
              </div>
            )}
            <div>
              <h3 className="font-bold text-white text-sm">Facebook Page (Meta Anchor)</h3>
              <p className="text-xs font-mono text-slate-400">
                {loading ? 'Checking connection...' : tokenInvalid ? 'Session expired' : connected ? status?.pageName : 'Not connected'}
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

        {connected && (
          <p className="text-[11px] text-slate-500 mb-3">Connected via Facebook Page</p>
        )}

        {connected && status?.pageId && (
          <p className="text-[11px] text-slate-500 font-mono mb-3">Page ID {status.pageId}</p>
        )}

        {connected && (
          <div className="mb-4">
            <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-2">
              Connected channels
            </p>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="flex items-center gap-2 pl-1 pr-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30">
                {status?.pagePictureUrl ? (
                  <span className="relative flex-shrink-0">
                    <img src={status.pagePictureUrl} alt="" className="w-6 h-6 rounded-full object-cover" />
                    <span
                      className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 border border-slate-900 flex items-center justify-center"
                      title="Facebook"
                    >
                      <Facebook className="w-2 h-2 text-white" />
                    </span>
                  </span>
                ) : (
                  <Facebook className="w-4 h-4 text-blue-400 ml-1" />
                )}
                <span className="text-[11px] font-medium text-emerald-200">
                  {status?.pageName ?? 'Facebook Page'}
                </span>
              </span>
              {status?.instagram ? (
                <span className="flex items-center gap-2 pl-1 pr-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30">
                  {status.instagram.pictureUrl ? (
                    <img src={status.instagram.pictureUrl} alt="" className="w-6 h-6 rounded-full object-cover" />
                  ) : (
                    <Instagram className="w-4 h-4 text-pink-400 ml-1" />
                  )}
                  <span className="text-[11px] font-medium text-emerald-200">
                    @{status.instagram.username}
                  </span>
                </span>
              ) : (
                <span
                  className="flex items-center gap-2 pl-1 pr-3 py-1 rounded-full bg-white/5 border border-dashed border-white/15"
                  title="Link an Instagram account in the Page's Facebook Settings"
                >
                  <Instagram className="w-4 h-4 text-slate-500 ml-1" />
                  <span className="text-[11px] text-slate-500">Instagram not linked</span>
                </span>
              )}
              {waStatus?.connected ? (
                <span className="flex items-center gap-2 pl-1 pr-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30">
                  <MessageCircle className="w-4 h-4 text-emerald-400 ml-1" />
                  <span className="text-[11px] font-medium text-emerald-200">
                    {waStatus.displayName ?? waStatus.verifiedName ?? 'WhatsApp'}
                  </span>
                </span>
              ) : (
                <span
                  className="flex items-center gap-2 pl-1 pr-3 py-1 rounded-full bg-white/5 border border-dashed border-white/15"
                  title="WhatsApp Business Cloud API — coming soon"
                >
                  <MessageCircle className="w-4 h-4 text-slate-500 ml-1" />
                  <span className="text-[11px] text-slate-500">WhatsApp soon</span>
                </span>
              )}
            </div>
            {!status?.instagram && (
              <p className="mt-2 flex items-start gap-1.5 text-[11px] text-amber-300/90">
                <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-px" />
                <span>
                  No Instagram account linked. Link one in the Page's Facebook Settings
                  to enable Instagram DMs.
                </span>
              </p>
            )}
          </div>
        )}

        {(connectionLost || tokenInvalid) && (
          <div className="mb-3 p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5 text-amber-400" />
            <div className="flex-1 text-xs">
              <p className="text-amber-200 font-semibold">
                {tokenInvalid ? 'Facebook session expired' : 'Facebook connection lost'}
              </p>
              <p className="text-amber-200/70">
                {tokenInvalid
                  ? 'Reconnect to resume sending. Incoming messages are unaffected.'
                  : 'Reconnect to keep Messenger working.'}
              </p>
            </div>
            <button
              onClick={handleConnect}
              className="px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-gradient-to-r from-blue-600 to-indigo-600 text-white cursor-pointer"
            >
              Reconnect
            </button>
          </div>
        )}

        {(oauthError || checkError) && (
          <div className="mb-3 p-2.5 rounded-xl bg-red-500/10 border border-red-500/25 text-red-300 text-xs flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <span>{oauthError || checkError}</span>
          </div>
        )}
      </div>

      <div className="pt-3 border-t border-white/10 flex items-center justify-between text-xs">
        <span className="text-slate-400 flex items-center gap-1.5">
          {tokenInvalid
            ? 'Session expired · reconnect to resume sending'
            : connected
            ? status?.instagram
              ? 'Messenger + Instagram ready'
              : 'Messenger ready · Instagram not linked'
            : 'Ready to authenticate'}
          {connected && lastCheckedAt && (
            <span className="text-slate-500">· checked {timeAgo(lastCheckedAt)}</span>
          )}
          {revalidating && <Loader2 className="w-3 h-3 animate-spin text-slate-500" />}
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

      {showPicker &&
        createPortal(
          <div className="fixed inset-0 z-50" onClick={closePicker}>
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
            <aside
              className="absolute right-0 top-0 bottom-0 flex w-full max-w-md flex-col overflow-hidden border-l border-white/10 bg-slate-900 p-6 shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
            <button
              onClick={closePicker}
              aria-label="Close"
              className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-all cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
            <div className="flex items-center gap-2 mb-1 pr-8">
              <CheckCircle2 className="w-5 h-5 text-emerald-400" />
              <h3 className="font-bold text-white">Choose your Facebook Page</h3>
              <button
                onClick={() => loadPages(false)}
                disabled={pagesLoading}
                aria-label="Reload pages"
                title="Reload pages"
                className="ml-auto p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-all cursor-pointer disabled:opacity-50"
              >
                <RefreshCw className={`w-4 h-4 ${pagesLoading ? 'animate-spin' : ''}`} />
              </button>
            </div>
            <p className="text-xs text-slate-400 mb-3">
              Pick the Page ChatMize should send and receive messages as.
              {pages.length > 0 && (
                <span className="text-slate-500"> {pages.length} found.</span>
              )}
              {connectedAs && (
                <span className="block mt-1 text-slate-500">
                  Logged in as <span className="text-slate-300 font-medium">{connectedAs}</span>
                  <span className="text-slate-600"> — missing a Page? Reconnect and make sure it is checked on the Facebook permission screen.</span>
                </span>
              )}
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
            <div className="space-y-2 overflow-y-auto min-h-0 flex-1 pr-1">
              {pagesLoading && (
                <div className="flex items-center gap-2 px-1 py-6 text-sm text-slate-400">
                  <Loader2 className="w-4 h-4 animate-spin text-blue-400" />
                  Loading your Facebook Pages...
                </div>
              )}
              {!pagesLoading && pagesError && (
                <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3">
                  <p className="text-xs text-amber-200 mb-2">{pagesError}</p>
                  <button
                    onClick={() => loadPages(false)}
                    className="text-xs font-semibold text-amber-100 underline underline-offset-2 hover:text-white cursor-pointer"
                  >
                    Try again
                  </button>
                </div>
              )}
              {!pagesLoading && !pagesError && filteredPages.length === 0 && pages.length > 0 && (
                <p className="text-xs text-slate-500 px-1 py-2">No pages match your search.</p>
              )}
              {filteredPages.map((page) => (
                <button
                  key={page.id}
                  onClick={() => handleSelect(page.id)}
                  disabled={selecting !== null}
                  className="w-full text-left p-3 rounded-xl border border-white/10 bg-white/5 hover:border-blue-500/40 hover:bg-blue-500/5 transition-all cursor-pointer disabled:opacity-60 flex items-center gap-3"
                >
                  <span className="relative w-9 h-9 flex-shrink-0 rounded-full overflow-hidden bg-blue-600/20 flex items-center justify-center">
                    <Facebook className="w-4 h-4 text-blue-400" />
                    <img
                      src={`https://graph.facebook.com/${page.id}/picture?type=large`}
                      alt=""
                      loading="lazy"
                      className="absolute inset-0 w-full h-full object-cover"
                      onError={(e) => {
                        e.currentTarget.remove();
                      }}
                    />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-semibold text-white truncate">{page.name}</div>
                    <div className="text-[11px] font-mono text-slate-500">{page.id}</div>
                  </div>
                  {selecting === page.id && <Loader2 className="w-4 h-4 animate-spin text-blue-400 flex-shrink-0" />}
                </button>
              ))}
            </div>
            {!pagesLoading && !pagesError && pages.length === 0 && (
              <p className="text-xs text-slate-500">No pages found on this Facebook account.</p>
            )}
            <button
              onClick={closePicker}
              className="mt-4 w-full py-2 rounded-xl text-xs font-semibold bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 transition-all cursor-pointer shrink-0"
            >
              Cancel
            </button>
          </aside>
        </div>,
        document.body
      )}
    </div>
  );
};
