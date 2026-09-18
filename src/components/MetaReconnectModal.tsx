import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, RefreshCw, Loader2, X } from 'lucide-react';
import { startMetaOAuth } from '../lib/meta';

interface MetaReconnectModalProps {
  workspaceId: string;
  workspaceName?: string;
  ownerName?: string;
  /** False when the signed-in user is not the workspace owner. */
  isOwner: boolean;
  onClose: () => void;
}

/** True when a send failure was caused by a dead Meta page token. */
export function isConnectionExpiredError(message: string | null): boolean {
  return !!message && /connection expired/i.test(message);
}

/**
 * Full-screen popup shown the moment a send fails because the Meta page
 * token died. Rendered through a portal to document.body so it sits on top
 * of everything with the app faded behind it.
 * Owner: one-click reconnect right in the modal.
 * Non-owner: told to contact the workspace owner (only the owner can
 * reconnect through Facebook Login).
 */
export const MetaReconnectModal: React.FC<MetaReconnectModalProps> = ({
  workspaceId,
  workspaceName,
  ownerName,
  isOwner,
  onClose,
}) => {
  const [starting, setStarting] = useState(false);

  const handleReconnect = async () => {
    setStarting(true);
    try {
      const url = await startMetaOAuth(workspaceId, 'app:settings_channels');
      window.location.href = url;
    } catch {
      setStarting(false);
    }
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="w-full max-w-md rounded-2xl bg-slate-900 border border-amber-500/40 shadow-2xl p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center shrink-0">
              <AlertTriangle className="w-5 h-5 text-amber-400" />
            </div>
            <h2 className="text-lg font-bold text-white">
              Facebook connection expired
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white shrink-0 cursor-pointer"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {isOwner ? (
          <>
            <p className="text-sm text-slate-300 mb-2">
              {workspaceName
                ? `The Facebook connection for ${workspaceName} expired, so your reply couldn't send.`
                : `Your Facebook connection expired, so your reply couldn't send.`}{' '}
              Incoming messages are unaffected.
            </p>
            <p className="text-sm text-slate-400 mb-6">
              Reconnect now, it takes about 30 seconds, then send your reply again.
            </p>
            <button
              onClick={handleReconnect}
              disabled={starting}
              className="w-full px-4 py-3 rounded-xl text-sm font-bold bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-white shadow-sm flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
            >
              {starting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <RefreshCw className="w-4 h-4" />
              )}
              {starting ? 'Opening Facebook...' : 'Reconnect now'}
            </button>
            <button
              onClick={onClose}
              className="w-full mt-2 px-4 py-2 rounded-xl text-sm font-semibold text-slate-400 hover:text-white cursor-pointer"
            >
              Not now
            </button>
          </>
        ) : (
          <>
            <p className="text-sm text-slate-300 mb-2">
              The Facebook connection{workspaceName ? ` for ${workspaceName}` : ''} expired,
              so replies can't send right now. Only the workspace owner can reconnect it.
            </p>
            <p className="text-sm text-slate-400 mb-6">
              {ownerName
                ? `Ask ${ownerName} to reconnect it in Settings under Channels.`
                : 'Ask your workspace owner to reconnect it in Settings under Channels.'}
            </p>
            <button
              onClick={onClose}
              className="w-full px-4 py-3 rounded-xl text-sm font-bold bg-slate-700 hover:bg-slate-600 text-white cursor-pointer"
            >
              Got it
            </button>
          </>
        )}
      </div>
    </div>,
    document.body,
  );
};
