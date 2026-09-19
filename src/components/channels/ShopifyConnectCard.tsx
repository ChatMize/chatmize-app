import React, { useEffect, useState } from 'react';
import { ShoppingBag, Loader2, CheckCircle2, AlertTriangle, RefreshCw, Unplug } from 'lucide-react';
import {
  startShopifyOAuth,
  getShopifyOAuthStatus,
  updateShopifySettings,
  disconnectShopify,
  ShopifyOAuthStatus,
} from '../../lib/shopify';
import { useCachedConnectionStatus, timeAgo } from '../../lib/useCachedConnectionStatus';

interface ShopifyConnectCardProps {
  workspaceId: string;
  /** Opaque descriptor of where the user was, e.g. "app:settings_channels". */
  returnTo?: string;
  /** Fired after a successful Shopify connection. */
  onConnected?: (shopName: string, shopDomain: string) => void;
}

/**
 * Shopify store connection card. Drives the ChatMize Shopify app OAuth flow:
 * enter the store domain -> approve in Shopify -> webhooks registered ->
 * abandoned cart, order, and fulfillment events flow into BotMaps.
 * The access token lives in Secret Manager, scoped to this workspace.
 */
export const ShopifyConnectCard: React.FC<ShopifyConnectCardProps> = ({
  workspaceId,
  returnTo,
  onConnected,
}) => {
  const [shopInput, setShopInput] = useState('');
  const [starting, setStarting] = useState(false);
  const [oauthError, setOauthError] = useState<string | null>(null);
  const [minutesInput, setMinutesInput] = useState('');
  const [savingMinutes, setSavingMinutes] = useState(false);
  const [minutesSaved, setMinutesSaved] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [confirmDisconnect, setConfirmDisconnect] = useState(false);

  const {
    status,
    loading,
    revalidating,
    lastCheckedAt,
    connectionLost,
    error: checkError,
    refresh,
  } = useCachedConnectionStatus<ShopifyOAuthStatus>({
    cacheKey: `chatmize_conn_shopify_${workspaceId}`,
    fetchStatus: () => getShopifyOAuthStatus(workspaceId),
    isConnected: (s) => s?.connected ?? false,
    onFresh: (s) => {
      if (s?.connected && s.shopDomain) {
        onConnected?.(s.shopName ?? '', s.shopDomain);
      }
      if (s) setMinutesInput(String(s.abandonedCartMinutes));
    },
  });

  useEffect(() => {
    // Handle the redirect back from Shopify.
    const params = new URLSearchParams(window.location.search);
    const outcome = params.get('shopify_oauth');
    if (outcome) {
      const clean = new URL(window.location.href);
      clean.searchParams.delete('shopify_oauth');
      clean.searchParams.delete('shopify_oauth_error');
      window.history.replaceState({}, '', clean.toString());
      if (outcome === 'error') {
        setOauthError(
          params.get('shopify_oauth_error') || 'Shopify login failed. Please try again.',
        );
        return;
      }
    }
    if (outcome === 'success') {
      refresh().then((s) => {
        if (s?.connected && s.shopDomain) {
          onConnected?.(s.shopName ?? '', s.shopDomain);
        }
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspaceId]);

  const handleConnect = async () => {
    setStarting(true);
    setOauthError(null);
    try {
      const url = await startShopifyOAuth(workspaceId, shopInput, returnTo);
      window.location.href = url;
    } catch (e) {
      setOauthError(e instanceof Error ? e.message : 'Could not start Shopify login.');
      setStarting(false);
    }
  };

  const handleSaveMinutes = async () => {
    const minutes = parseInt(minutesInput, 10);
    if (!Number.isFinite(minutes) || minutes < 15 || minutes > 4320) {
      setOauthError('Abandonment window must be between 15 minutes and 3 days.');
      return;
    }
    setSavingMinutes(true);
    setOauthError(null);
    try {
      const s = await updateShopifySettings(workspaceId, minutes);
      setMinutesInput(String(s.abandonedCartMinutes));
      setMinutesSaved(true);
      setTimeout(() => setMinutesSaved(false), 2500);
    } catch (e) {
      setOauthError(e instanceof Error ? e.message : 'Could not save the setting.');
    } finally {
      setSavingMinutes(false);
    }
  };

  const handleDisconnect = async () => {
    if (!confirmDisconnect) {
      setConfirmDisconnect(true);
      return;
    }
    setDisconnecting(true);
    try {
      await disconnectShopify(workspaceId);
      setConfirmDisconnect(false);
      await refresh();
    } catch (e) {
      setOauthError(e instanceof Error ? e.message : 'Could not disconnect the store.');
    } finally {
      setDisconnecting(false);
    }
  };

  const connected = status?.connected ?? false;

  return (
    <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl p-5 flex flex-col justify-between hover:border-white/20 transition-all md:col-span-2">
      <div>
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-slate-900/80 rounded-xl border border-white/10">
              <ShoppingBag className="w-6 h-6 text-emerald-400" />
            </div>
            <div>
              <h3 className="font-bold text-white text-sm">Shopify</h3>
              <p className="text-xs font-mono text-slate-400">
                {loading
                  ? 'Checking connection...'
                  : connected
                    ? (status?.shopName ?? status?.shopDomain ?? 'Connected')
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
            ? `Order and cart events from ${status?.shopName ?? 'your store'} can trigger BotMaps flows: abandoned cart recovery, order confirmations, shipping and delivery updates.`
            : 'Connect your Shopify store to trigger flows from carts, orders, and fulfillments. Abandoned cart recovery, order confirmations, and shipping updates, all from chat.'}
        </p>

        {connected && status?.shopDomain && (
          <p className="text-[11px] text-slate-500 font-mono mb-3">
            {status.shopDomain}
          </p>
        )}

        {!connected && (
          <div className="mb-4 space-y-2">
            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Store domain
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={shopInput}
                onChange={(e) => setShopInput(e.target.value)}
                placeholder="mystore.myshopify.com"
                className="flex-1 bg-slate-900 border border-white/10 rounded-xl px-3 py-2 text-xs text-white font-mono placeholder:text-slate-600 outline-none focus:border-emerald-500 transition-colors"
              />
              <button
                onClick={handleConnect}
                disabled={starting || !shopInput.trim()}
                className="px-3 py-2 rounded-xl font-semibold transition-all cursor-pointer flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm disabled:opacity-60 text-xs"
              >
                {starting ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Connecting...
                  </>
                ) : (
                  <>
                    <ShoppingBag className="w-3.5 h-3.5" />
                    Connect
                  </>
                )}
              </button>
            </div>
            <p className="text-[10px] text-slate-500 leading-relaxed">
              You will approve the connection inside your Shopify admin. ChatMize only reads orders, customers, and checkouts. It never changes your store.
            </p>
          </div>
        )}

        {connected && (
          <div className="mb-4 p-3 rounded-xl bg-slate-900/80 border border-white/10 space-y-2">
            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Abandoned cart window
            </label>
            <div className="flex gap-2 items-center">
              <input
                type="number"
                min={15}
                max={4320}
                value={minutesInput}
                onChange={(e) => setMinutesInput(e.target.value)}
                className="w-24 bg-slate-950 border border-white/10 rounded-xl px-3 py-1.5 text-xs text-white font-mono outline-none focus:border-emerald-500"
              />
              <span className="text-[11px] text-slate-500">minutes</span>
              <button
                onClick={handleSaveMinutes}
                disabled={savingMinutes}
                className="px-2.5 py-1.5 rounded-xl text-[11px] font-semibold bg-white/10 hover:bg-white/15 text-white cursor-pointer disabled:opacity-60 flex items-center gap-1"
              >
                {savingMinutes ? <Loader2 className="w-3 h-3 animate-spin" /> : minutesSaved ? <CheckCircle2 className="w-3 h-3 text-emerald-400" /> : null}
                {minutesSaved ? 'Saved' : 'Save'}
              </button>
            </div>
            <p className="text-[10px] text-slate-500 leading-relaxed">
              A checkout counts as abandoned when it stays open this long with no order. Then the cart recovery flow fires.
            </p>
          </div>
        )}

        {connectionLost && (
          <div className="mb-4 p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-xs text-amber-200 font-semibold">Shopify connection lost</p>
              <p className="text-xs text-amber-200/70">Reconnect to keep store events flowing.</p>
            </div>
          </div>
        )}

        {connected && status && status.webhookFailures.length > 0 && (
          <div className="mb-4 p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-xs text-amber-200 font-semibold">Some event subscriptions failed</p>
              <p className="text-xs text-amber-200/70 font-mono">{status.webhookFailures.join(', ')}</p>
              <button
                onClick={handleConnect}
                className="mt-2 px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-emerald-600 text-white cursor-pointer"
              >
                Reconnect to retry
              </button>
            </div>
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
              Store events live
              {lastCheckedAt && (
                <span className="text-slate-500">· checked {timeAgo(lastCheckedAt)}</span>
              )}
              {revalidating && <Loader2 className="w-3 h-3 animate-spin text-slate-500" />}
            </>
          ) : (
            'Abandoned cart plus order updates'
          )}
        </span>

        {connected ? (
          <div className="flex items-center gap-2">
            <button
              onClick={() => refresh()}
              className="px-3 py-1.5 rounded-xl font-semibold transition-all cursor-pointer flex items-center gap-1.5 bg-white/5 hover:bg-white/10 text-slate-300 border border-white/10"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Refresh
            </button>
            <button
              onClick={handleDisconnect}
              disabled={disconnecting}
              onBlur={() => setConfirmDisconnect(false)}
              className={`px-3 py-1.5 rounded-xl font-semibold transition-all cursor-pointer flex items-center gap-1.5 border disabled:opacity-60 ${
                confirmDisconnect
                  ? 'bg-red-600 hover:bg-red-500 text-white border-red-500'
                  : 'bg-white/5 hover:bg-white/10 text-slate-300 border-white/10'
              }`}
            >
              {disconnecting ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Unplug className="w-3.5 h-3.5" />
              )}
              {confirmDisconnect ? 'Click again to confirm' : 'Disconnect'}
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
};
