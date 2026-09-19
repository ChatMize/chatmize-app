import React, { useEffect, useState } from 'react';
import { MessageCircle, Loader2, CheckCircle2, AlertTriangle, RefreshCw } from 'lucide-react';
import {
  startWhatsAppOAuth,
  getWhatsAppOAuthStatus,
  listWhatsAppAccounts,
  selectWhatsAppNumber,
  WhatsAppOAuthStatus,
  WhatsAppBusinessAccount,
} from '../../lib/whatsapp';
import { useCachedConnectionStatus, timeAgo } from '../../lib/useCachedConnectionStatus';

interface WhatsAppConnectCardProps {
  workspaceId: string;
  /** Opaque descriptor of where the user was, e.g. "app:settings_channels". */
  returnTo?: string;
  /** Fired after a successful WhatsApp connection. */
  onConnected?: (displayName: string, phoneNumberId: string) => void;
}

/**
 * WhatsApp customer connection card. Drives Facebook Login for Business on
 * the main ChatMize Meta app: connect -> authorize -> pick one of the
 * customer's WhatsApp Business numbers -> the token is stored as the
 * workspace's own Secret Manager secret. Powers WhatsApp DMs for the
 * customer's own business number.
 */
export const WhatsAppConnectCard: React.FC<WhatsAppConnectCardProps> = ({
  workspaceId,
  returnTo,
  onConnected,
}) => {
  const [starting, setStarting] = useState(false);
  const [oauthError, setOauthError] = useState<string | null>(null);
  const [showPicker, setShowPicker] = useState(false);
  const [accounts, setAccounts] = useState<WhatsAppBusinessAccount[]>([]);
  const [accountsLoading, setAccountsLoading] = useState(false);
  const [accountsError, setAccountsError] = useState<string | null>(null);
  const [selecting, setSelecting] = useState<string | null>(null);

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
  } = useCachedConnectionStatus<WhatsAppOAuthStatus>({
    cacheKey: `chatmize_conn_wa_${workspaceId}`,
    fetchStatus: () => getWhatsAppOAuthStatus(workspaceId),
    isConnected: (s) => s?.connected ?? false,
    onFresh: (s) => {
      if (s.pending) {
        loadAccounts(true);
      }
      // Sync the workspace's local channel flag whenever the real status
      // shows connected, even if this session did not just complete OAuth.
      if (s?.connected && s.phoneNumberId) {
        onConnected?.(s.displayName || '', s.phoneNumberId);
      }
    },
  });

  // Close the number picker on Escape.
  useEffect(() => {
    if (!showPicker) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setShowPicker(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [showPicker]);

  /** Load the pending WhatsApp accounts with visible loading/error states. */
  const loadAccounts = async (openOnSuccess: boolean): Promise<WhatsAppBusinessAccount[]> => {
    setAccountsLoading(true);
    setAccountsError(null);
    try {
      let result = await listWhatsAppAccounts(workspaceId);
      if (result.accounts.length === 0) {
        // One automatic retry: the pending write can lag the redirect by a beat.
        await new Promise((r) => setTimeout(r, 1500));
        result = await listWhatsAppAccounts(workspaceId);
      }
      const a = result.accounts;
      setAccounts(a);
      if (openOnSuccess && a.length > 0) setShowPicker(true);
      if (a.length === 0) {
        setAccountsError('No WhatsApp Business accounts came back. Check that you granted the WhatsApp permissions, then try again.');
      }
      return a;
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Could not load your WhatsApp accounts.';
      setAccountsError(msg);
      return [];
    } finally {
      setAccountsLoading(false);
    }
  };

  useEffect(() => {
    // Handle the redirect back from Facebook.
    const params = new URLSearchParams(window.location.search);
    const outcome = params.get('whatsapp_oauth');
    if (outcome) {
      const clean = new URL(window.location.href);
      clean.searchParams.delete('whatsapp_oauth');
      clean.searchParams.delete('whatsapp_oauth_error');
      window.history.replaceState({}, '', clean.toString());
      if (outcome === 'error') {
        setOauthError(
          params.get('whatsapp_oauth_error') || 'WhatsApp login failed. Please try again.',
        );
        return;
      }
    }
    if (outcome === 'success') {
      // The hook already revalidates on mount; this ensures the fresh pick
      // is applied and the parent is notified.
      refresh().then((s) => {
        if (s?.connected && s.phoneNumberId) {
          onConnected?.(s.displayName || '', s.phoneNumberId);
        } else if (s?.pending) {
          loadAccounts(true);
        }
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspaceId]);

  const handleConnect = async () => {
    setStarting(true);
    setOauthError(null);
    try {
      const url = await startWhatsAppOAuth(workspaceId, returnTo);
      window.location.href = url;
    } catch (e) {
      setOauthError(e instanceof Error ? e.message : 'Could not start WhatsApp login.');
      setStarting(false);
    }
  };

  const handleSelect = async (phoneNumberId: string) => {
    setSelecting(phoneNumberId);
    setOauthError(null);
    try {
      await selectWhatsAppNumber(workspaceId, phoneNumberId);
      setShowPicker(false);
      setAccounts([]);
      const s = await refresh();
      if (s?.connected && s.phoneNumberId) {
        onConnected?.(s.displayName || '', s.phoneNumberId);
      }
    } catch (e) {
      setOauthError(e instanceof Error ? e.message : 'Could not connect that number.');
    } finally {
      setSelecting(null);
    }
  };

  const connected = status?.connected ?? false;
  const totalNumbers = accounts.reduce((n, a) => n + a.phoneNumbers.length, 0);

  return (
    <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl p-5 flex flex-col justify-between hover:border-white/20 transition-all md:col-span-2">
      <div>
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-slate-900/80 rounded-xl border border-white/10">
              <MessageCircle className="w-6 h-6 text-emerald-400" />
            </div>
            <div>
              <h3 className="font-bold text-white text-sm">WhatsApp Business</h3>
              <p className="text-xs font-mono text-slate-400">
                {loading
                  ? 'Checking connection...'
                  : connected
                    ? (status?.displayName ?? 'Connected')
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
            ? `Customers can message ${status?.displayName ?? 'your WhatsApp number'} and every conversation lands in this workspace's inbox. The token stays encrypted and scoped to this workspace only.`
            : 'Connect your own WhatsApp Business number. Customers message you on WhatsApp and you reply from the ChatMize inbox.'}
        </p>

        {connected && status?.phoneNumberId && (
          <p className="text-[11px] text-slate-500 font-mono mb-3">
            Number ID {status.phoneNumberId}
            {status?.verifiedName ? ` · ${status.verifiedName}` : ''}
          </p>
        )}

        {connected && (
          <div className="mb-4">
            <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-2">
              Connected channels
            </p>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="flex items-center gap-2 pl-1 pr-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30">
                <MessageCircle className="w-4 h-4 text-emerald-400 ml-1" />
                <span className="text-[11px] font-medium text-emerald-200">
                  {status?.displayName ?? 'WhatsApp'} · DMs
                </span>
              </span>
            </div>
          </div>
        )}

        {connectionLost && (
          <div className="mb-4 p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-xs text-amber-200 font-semibold">WhatsApp connection lost</p>
              <p className="text-xs text-amber-200/70">Reconnect to keep WhatsApp messages working.</p>
            </div>
            <button
              onClick={handleConnect}
              className="px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-emerald-600 text-white cursor-pointer"
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

        {showPicker && (
          <div className="mb-4 p-4 rounded-xl bg-slate-900/80 border border-white/10">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-bold text-white">Choose your WhatsApp number</p>
              <button
                onClick={() => setShowPicker(false)}
                className="text-[11px] text-slate-400 hover:text-white cursor-pointer"
              >
                Cancel
              </button>
            </div>
            {accountsLoading ? (
              <p className="text-xs text-slate-400 flex items-center gap-2">
                <Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading your WhatsApp accounts...
              </p>
            ) : accountsError ? (
              <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/25">
                <p className="text-xs text-red-300">{accountsError}</p>
                <button
                  onClick={() => loadAccounts(true)}
                  className="mt-2 px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-white/10 text-white cursor-pointer"
                >
                  Try again
                </button>
              </div>
            ) : totalNumbers === 0 ? (
              <p className="text-xs text-slate-400">
                No phone numbers found on your WhatsApp Business accounts. Add a number in the
                Meta dashboard first, then try again.
              </p>
            ) : (
              <div className="space-y-3 max-h-64 overflow-y-auto pr-1">
                {accounts.map((account) => (
                  <div key={account.wabaId}>
                    <p className="text-[11px] font-semibold text-slate-400 mb-1.5">
                      {account.wabaName}
                    </p>
                    <div className="space-y-1.5">
                      {account.phoneNumbers.map((number) => (
                        <button
                          key={number.phoneNumberId}
                          onClick={() => handleSelect(number.phoneNumberId)}
                          disabled={selecting !== null}
                          className="w-full flex items-center justify-between gap-3 p-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 transition-all cursor-pointer disabled:opacity-60 text-left"
                        >
                          <span className="flex items-center gap-2.5 min-w-0">
                            <MessageCircle className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                            <span className="min-w-0">
                              <span className="block text-xs font-semibold text-white truncate">
                                {number.displayPhoneNumber}
                              </span>
                              {number.verifiedName && (
                                <span className="block text-[11px] text-slate-500 truncate">
                                  {number.verifiedName}
                                </span>
                              )}
                            </span>
                          </span>
                          {selecting === number.phoneNumberId ? (
                            <Loader2 className="w-4 h-4 animate-spin text-emerald-400 flex-shrink-0" />
                          ) : (
                            <span className="text-[11px] font-semibold text-emerald-300 flex-shrink-0">
                              Select
                            </span>
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="pt-3 border-t border-white/10 flex items-center justify-between text-xs">
        <span className="text-slate-400 flex items-center gap-1.5">
          {connected ? (
            <>
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              <MessageCircle className="w-3.5 h-3.5 text-emerald-400" />
              WhatsApp ready
              {lastCheckedAt && (
                <span className="text-slate-500">· checked {timeAgo(lastCheckedAt)}</span>
              )}
              {revalidating && <Loader2 className="w-3 h-3 animate-spin text-slate-500" />}
            </>
          ) : status?.pending ? (
            <button
              onClick={() => loadAccounts(true)}
              className="text-emerald-300 hover:text-emerald-200 font-semibold cursor-pointer"
            >
              Finish setup: pick your number
            </button>
          ) : (
            'Your own business number'
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
        ) : status?.pending ? (
          <button
            onClick={() => loadAccounts(true)}
            disabled={accountsLoading}
            className="px-3 py-1.5 rounded-xl font-semibold transition-all cursor-pointer flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm disabled:opacity-60"
          >
            {accountsLoading ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Loading...
              </>
            ) : (
              <>
                <MessageCircle className="w-3.5 h-3.5" />
                Choose number
              </>
            )}
          </button>
        ) : (
          <button
            onClick={handleConnect}
            disabled={starting}
            className="px-3 py-1.5 rounded-xl font-semibold transition-all cursor-pointer flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm disabled:opacity-60"
          >
            {starting ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Connecting...
              </>
            ) : (
              <>
                <MessageCircle className="w-3.5 h-3.5" />
                Connect WhatsApp
              </>
            )}
          </button>
        )}
      </div>
    </div>
  );
};
