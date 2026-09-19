import React, { useEffect, useState } from 'react';
import { Video, Loader2, CheckCircle2, AlertTriangle, RefreshCw, KeyRound } from 'lucide-react';
import {
  getBigmarkerStatus,
  connectBigmarker,
  disconnectBigmarker,
  BigmarkerConnectionStatus,
} from '../../lib/bigmarker';

interface BigMarkerConnectCardProps {
  workspaceId: string;
}

/**
 * BigMarker connection card. The workspace pastes its BigMarker API key
 * (BigMarker user settings, API Key section). The key is validated against
 * BigMarker, then stored as the workspace's own Secret Manager secret.
 * Powers webinar registration, attendance sync, and reminder broadcasts.
 */
export const BigMarkerConnectCard: React.FC<BigMarkerConnectCardProps> = ({ workspaceId }) => {
  const [status, setStatus] = useState<BigmarkerConnectionStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [apiKey, setApiKey] = useState('');
  const [baseUrl, setBaseUrl] = useState('');
  const [connecting, setConnecting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = async () => {
    setLoading(true);
    setError(null);
    try {
      setStatus(await getBigmarkerStatus(workspaceId));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not check the BigMarker connection.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspaceId]);

  const handleConnect = async () => {
    if (!apiKey.trim()) {
      setError('Paste your BigMarker API key first.');
      return;
    }
    setConnecting(true);
    setError(null);
    try {
      await connectBigmarker(workspaceId, apiKey.trim(), baseUrl.trim() || undefined);
      setApiKey('');
      setBaseUrl('');
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not connect BigMarker.');
    } finally {
      setConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    setDisconnecting(true);
    setError(null);
    try {
      await disconnectBigmarker(workspaceId);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not disconnect BigMarker.');
    } finally {
      setDisconnecting(false);
    }
  };

  const connected = status?.connected ?? false;

  return (
    <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl p-5 flex flex-col justify-between hover:border-white/20 transition-all">
      <div>
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-slate-900/80 rounded-xl border border-white/10">
              <Video className="w-6 h-6 text-sky-400" />
            </div>
            <div>
              <h3 className="font-bold text-white text-sm">BigMarker Webinars</h3>
              <p className="text-xs font-mono text-slate-400">
                {loading ? 'Checking connection...' : connected ? 'Connected' : 'Not connected'}
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
            ? 'Register contacts for webinars from BotMaps, sync who showed up, and send reminders to registrants.'
            : 'Connect your BigMarker account to register contacts for webinars, see who attended, and follow up automatically.'}
        </p>

        {status?.keyInvalid && (
          <div className="mb-4 p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-amber-200">
              BigMarker rejected the saved API key. Reconnect with a fresh key below.
            </p>
          </div>
        )}

        {!connected && !loading && (
          <div className="mb-4 space-y-2.5">
            <label className="block">
              <span className="text-[11px] font-semibold text-slate-300">BigMarker API key</span>
              <div className="relative mt-1">
                <KeyRound className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="password"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="Paste your API key"
                  className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-900/80 border border-white/10 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-sky-500/50"
                />
              </div>
              <span className="text-[11px] text-slate-500">
                Find it in BigMarker under your user settings, API Key section.
              </span>
            </label>
            <label className="block">
              <span className="text-[11px] font-semibold text-slate-300">Base URL (only if BigMarker gave you a custom one)</span>
              <input
                type="text"
                value={baseUrl}
                onChange={(e) => setBaseUrl(e.target.value)}
                placeholder="https://www.bigmarker.com"
                className="mt-1 w-full px-3 py-2 rounded-xl bg-slate-900/80 border border-white/10 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-sky-500/50"
              />
            </label>
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
              <Video className="w-3.5 h-3.5 text-sky-400" />
              Webinar registration ready
            </>
          ) : (
            'Key stays encrypted, workspace only'
          )}
        </span>

        {connected ? (
          <div className="flex items-center gap-2">
            <button
              onClick={refresh}
              disabled={loading}
              className="px-3 py-1.5 rounded-xl font-semibold transition-all cursor-pointer flex items-center gap-1.5 bg-white/5 hover:bg-white/10 text-slate-300 border border-white/10 disabled:opacity-60"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
            <button
              onClick={handleDisconnect}
              disabled={disconnecting}
              className="px-3 py-1.5 rounded-xl font-semibold transition-all cursor-pointer bg-white/5 hover:bg-white/10 text-slate-300 border border-white/10 disabled:opacity-60"
            >
              {disconnecting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Disconnect'}
            </button>
          </div>
        ) : (
          <button
            onClick={handleConnect}
            disabled={connecting || loading}
            className="px-3 py-1.5 rounded-xl font-semibold transition-all cursor-pointer flex items-center gap-1.5 bg-gradient-to-r from-sky-600 to-blue-600 hover:from-sky-500 hover:to-blue-500 text-white shadow-sm disabled:opacity-60"
          >
            {connecting ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Connecting...
              </>
            ) : (
              <>
                <Video className="w-3.5 h-3.5" />
                Connect BigMarker
              </>
            )}
          </button>
        )}
      </div>
    </div>
  );
};
