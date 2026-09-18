import React, { useEffect, useState } from 'react';
import { AlertTriangle, RefreshCw, Loader2 } from 'lucide-react';
import { getMetaOAuthStatus, startMetaOAuth } from '../lib/meta';

interface MetaReconnectBannerProps {
  workspaceId: string;
  workspaceName?: string;
  /** Jump to Settings > Channels. */
  onGoToChannels: () => void;
}

/**
 * Sticky top banner shown app-wide when the workspace's Meta page token was
 * killed (error 190). Inbound keeps flowing; outbound stays broken until the
 * owner reconnects. The Reconnect button starts OAuth and returns to the
 * Channels page so the owner can verify the card flipped to connected.
 */
export const MetaReconnectBanner: React.FC<MetaReconnectBannerProps> = ({
  workspaceId,
  workspaceName,
  onGoToChannels,
}) => {
  const [tokenInvalid, setTokenInvalid] = useState(false);
  const [starting, setStarting] = useState(false);

  useEffect(() => {
    let alive = true;
    setTokenInvalid(false);
    getMetaOAuthStatus(workspaceId)
      .then((s) => {
        if (alive) setTokenInvalid(!!s?.tokenInvalid);
      })
      .catch(() => {
        // Status check failed: stay silent rather than flashing a false alarm.
      });
    return () => {
      alive = false;
    };
  }, [workspaceId]);

  if (!tokenInvalid) return null;

  const handleReconnect = async () => {
    setStarting(true);
    try {
      const url = await startMetaOAuth(workspaceId, 'app:settings_channels');
      window.location.href = url;
    } catch {
      setStarting(false);
    }
  };

  return (
    <div className="sticky top-0 z-30 mb-4 w-full px-4 py-3 rounded-2xl bg-amber-500/10 border border-amber-500/40 flex items-center gap-3 backdrop-blur-xl">
      <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold text-amber-200">
          Facebook session expired{workspaceName ? ` for ${workspaceName}` : ''}
        </p>
        <p className="text-xs text-amber-200/70">
          Incoming messages still arrive, but replies can&apos;t send until you
          reconnect. It takes about 30 seconds.
        </p>
      </div>
      <button
        onClick={onGoToChannels}
        className="text-xs font-semibold text-amber-200/80 hover:text-amber-100 underline underline-offset-2 shrink-0 cursor-pointer"
      >
        Channels
      </button>
      <button
        onClick={handleReconnect}
        disabled={starting}
        className="px-3.5 py-2 rounded-xl text-xs font-bold bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-white shadow-sm shrink-0 flex items-center gap-1.5 cursor-pointer disabled:opacity-60"
      >
        {starting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
        {starting ? 'Opening Facebook...' : 'Reconnect now'}
      </button>
    </div>
  );
};
