import React, { useState } from 'react';
import { AlertTriangle, RefreshCw, Loader2 } from 'lucide-react';
import { startMetaOAuth } from '../lib/meta';
import { useMetaTokenInvalid } from '../lib/useMetaTokenInvalid';

interface MetaReconnectBannerProps {
  workspaceId: string;
  workspaceName?: string;
  /** False when the signed-in user is not the workspace owner. Non-owners
   * see the banner but get no reconnect button (mirrors MetaReconnectModal). */
  isOwner?: boolean;
  ownerName?: string;
}

/**
 * Sticky top banner shown app-wide when the workspace's Meta page token was
 * killed (error 190). The token-invalid flag streams live from the backend
 * integration doc, so the banner appears the moment the token dies instead
 * of waiting for a poll cycle. Inbound keeps flowing; outbound stays broken
 * until the owner reconnects.
 */
export const MetaReconnectBanner: React.FC<MetaReconnectBannerProps> = ({
  workspaceId,
  workspaceName,
  isOwner = true,
  ownerName,
}) => {
  const tokenInvalid = useMetaTokenInvalid(workspaceId);
  const [starting, setStarting] = useState(false);

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
          {isOwner ? (
            <>Incoming messages still arrive, but replies can&apos;t send until you reconnect. It takes about 30 seconds.</>
          ) : (
            <>Only the workspace owner can reconnect it. {ownerName ? `Ask ${ownerName} to reconnect it in Settings under Channels.` : 'Ask your workspace owner to reconnect it in Settings under Channels.'}</>
          )}
        </p>
      </div>
      {isOwner && (
        <button
          onClick={handleReconnect}
          disabled={starting}
          className="px-3.5 py-2 rounded-xl text-xs font-bold bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-white shadow-sm shrink-0 flex items-center gap-1.5 cursor-pointer disabled:opacity-60"
        >
          {starting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
          {starting ? 'Opening Facebook...' : 'Reconnect now'}
        </button>
      )}
    </div>
  );
};
