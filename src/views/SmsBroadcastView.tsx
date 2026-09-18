import React, { useEffect, useState } from 'react';
import { EmojiPickerButton, useEmojiTarget } from '../components/emoji';
import { PersonalizationPickerButton, usePersonalizationTarget } from '../components/personalization';
import { MessageSquareText, Send, Loader2, CheckCircle2, AlertTriangle, Users } from 'lucide-react';
import {
  getSmsStatus,
  sendSmsBroadcast,
  estimateSegments,
  estimateBroadcastCredits,
  SMS_CREDITS_PER_SEGMENT,
  SmsBroadcastReport,
} from '../lib/sms';
import { WorkspaceSilo } from '../types/workspace';

interface SmsBroadcastViewProps {
  workspace?: WorkspaceSilo;
  onEnableSms: () => void;
}

/** SMS blast composer: live segment/credit estimates, backend delivery report. */
export const SmsBroadcastView: React.FC<SmsBroadcastViewProps> = ({ workspace, onEnableSms }) => {
  const [message, setMessage] = useState('');
  const smsPz = usePersonalizationTarget<HTMLTextAreaElement>();
  const [optedIn, setOptedIn] = useState(0);
  const [connected, setConnected] = useState(false);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [report, setReport] = useState<SmsBroadcastReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const smsEmoji = useEmojiTarget<HTMLTextAreaElement>();

  useEffect(() => {
    if (!workspace?.id) {
      setLoading(false);
      return;
    }
    getSmsStatus(workspace.id)
      .then((s) => {
        setConnected(s.connected);
        setOptedIn(s.optedIn ?? 0);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [workspace?.id]);

  const segments = estimateSegments(message);
  const estCredits = estimateBroadcastCredits(segments, optedIn);
  const chars = message.length;

  const handleSend = async () => {
    if (!workspace?.id || !message.trim()) return;
    setSending(true);
    setError(null);
    try {
      const r = await sendSmsBroadcast(workspace.id, message.trim());
      setReport(r);
      setConfirming(false);
      setMessage('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Broadcast failed.');
    } finally {
      setSending(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 text-slate-400 text-sm gap-2">
        <Loader2 className="w-4 h-4 animate-spin" /> Loading SMS broadcast...
      </div>
    );
  }

  if (!connected) {
    return (
      <div className="max-w-lg mx-auto text-center py-24 space-y-4">
        <MessageSquareText className="w-8 h-8 text-amber-400 mx-auto" />
        <h2 className="text-lg font-black text-white">Enable SMS first</h2>
        <p className="text-xs text-slate-400">
          You need a provisioned phone number before you can send broadcasts.
        </p>
        <button
          onClick={onEnableSms}
          className="px-6 py-2.5 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 text-white rounded-xl text-xs font-bold cursor-pointer"
        >
          Go to Settings → Channels
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <span className="p-2.5 rounded-2xl bg-amber-500/15 border border-amber-500/30">
          <MessageSquareText className="w-5 h-5 text-amber-300" />
        </span>
        <div>
          <h2 className="text-xl font-black text-white">SMS Broadcast</h2>
          <p className="text-xs text-slate-400">Blast your opted-in SMS audience in one shot.</p>
        </div>
      </div>

      {report && (
        <div className="rounded-3xl border border-emerald-500/30 bg-emerald-500/5 p-5 space-y-2">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-300" />
            <h3 className="text-sm font-bold text-white">Broadcast complete</h3>
          </div>
          <p className="text-xs text-slate-300">
            {report.sent.toLocaleString()} sent · {report.failed} failed · {report.skipped} skipped
            {report.creditsCharged > 0 && <> · {report.creditsCharged.toLocaleString()} credits charged</>}
          </p>
          {report.errors.length > 0 && (
            <p className="text-[11px] text-amber-300/80">{report.errors.join(' · ')}</p>
          )}
          <button
            onClick={() => setReport(null)}
            className="text-[11px] text-slate-400 hover:text-white font-bold cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      <div className="rounded-3xl border border-white/10 bg-slate-900/60 p-6 space-y-4">
        <div className="flex items-center gap-2 text-xs text-slate-300">
          <Users className="w-3.5 h-3.5 text-cyan-300" />
          <span>
            <span className="font-black text-white">{optedIn.toLocaleString()}</span> opted-in recipients
          </span>
        </div>

        <div className="relative">
          <textarea
            ref={(el) => { smsEmoji.ref(el); smsPz.ref(el); }}
            value={message}
            onChange={(e) => setMessage(e.target.value.slice(0, 1600))}
            rows={5}
            placeholder="Your blast message... (include your business name; replies like STOP are handled automatically)"
            className="w-full bg-slate-800/60 border border-white/10 rounded-2xl px-4 py-3 pr-11 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-amber-500/50 resize-none"
          />
          <span className="absolute right-2.5 bottom-2.5">
            <EmojiPickerButton onPick={(e) => smsEmoji.insert(e, message, (v) => setMessage(v.slice(0, 1600)))} placement="up" />
            <PersonalizationPickerButton
              onPick={(t) => smsPz.insert(t, message, setMessage)}
              placement="up"
              title="Insert personalization"
            />
          </span>
          <div className="flex items-center justify-between mt-2 text-[11px] text-slate-500">
            <span>{chars}/1600 characters · {segments} segment{segments === 1 ? '' : 's'}</span>
            <span>
              Est. cost: <span className="text-white font-bold">{estCredits.toLocaleString()} credits</span>
              <span className="text-slate-600"> ({SMS_CREDITS_PER_SEGMENT}/segment · plan allowance applies first)</span>
            </span>
          </div>
        </div>

        {error && (
          <div className="flex items-start gap-2 text-[11px] text-red-400">
            <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {!confirming ? (
          <button
            onClick={() => setConfirming(true)}
            disabled={!message.trim() || optedIn === 0}
            className="w-full py-3 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 disabled:opacity-40 text-white rounded-2xl text-sm font-bold flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-orange-500/20"
          >
            <Send className="w-4 h-4" />
            <span>
              {optedIn === 0 ? 'No opted-in recipients yet' : `Review blast to ${optedIn.toLocaleString()} recipients`}
            </span>
          </button>
        ) : (
          <div className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-4 space-y-3">
            <p className="text-xs text-slate-300">
              Send <span className="font-bold text-white">"{message.trim().slice(0, 80)}{message.trim().length > 80 ? '...' : ''}"</span>{' '}
              to <span className="font-bold text-white">{optedIn.toLocaleString()}</span> opted-in recipients?
              This cannot be undone.
            </p>
            <div className="flex gap-2">
              <button
                onClick={handleSend}
                disabled={sending}
                className="flex-1 py-2.5 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 disabled:opacity-50 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 cursor-pointer"
              >
                {sending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                <span>{sending ? 'Sending...' : 'Yes, send it'}</span>
              </button>
              <button
                onClick={() => setConfirming(false)}
                disabled={sending}
                className="px-5 py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 rounded-xl text-xs font-bold cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        <p className="text-[11px] text-slate-600 leading-relaxed">
          Only contacts who opted in receive this. Anyone replying STOP is removed automatically and
          never messaged again. Keep blasts relevant: carrier filtering punishes spam patterns.
        </p>
      </div>
    </div>
  );
};
