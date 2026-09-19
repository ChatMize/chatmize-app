import React, { useEffect, useState } from 'react';
import { BellRing, Send, Loader2, CheckCircle2, AlertTriangle, Clock, Users, Tag } from 'lucide-react';
import {
  getPushStatus,
  sendPushBroadcast,
  schedulePush,
  type PushLinkType,
} from '../lib/push';
import { WorkspaceSilo } from '../types/workspace';

interface PushBlastViewProps {
  workspace?: WorkspaceSilo;
  onEnablePush: () => void;
}

/** Push blast composer: audience, link type, immediate or scheduled send. */
export const PushBlastView: React.FC<PushBlastViewProps> = ({ workspace, onEnablePush }) => {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [image, setImage] = useState('');
  const [linkType, setLinkType] = useState<PushLinkType>('website');
  const [linkValue, setLinkValue] = useState('');
  const [audience, setAudience] = useState<'all' | 'tag'>('all');
  const [tag, setTag] = useState('');
  const [scheduleMode, setScheduleMode] = useState<'now' | 'later'>('now');
  const [sendAt, setSendAt] = useState('');
  const [onlyIfNoReply, setOnlyIfNoReply] = useState(false);
  const [noReplyMinutes, setNoReplyMinutes] = useState(60);
  const [subscribers, setSubscribers] = useState(0);
  const [configured, setConfigured] = useState(false);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [report, setReport] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!workspace?.id) { setLoading(false); return; }
    getPushStatus(workspace.id)
      .then((s) => { setConfigured(s.configured); setSubscribers(s.subscriberCount); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [workspace?.id]);

  const valid = title.trim().length > 0 && body.trim().length > 0 && (audience === 'all' || tag.trim().length > 0);

  const handleBlast = async () => {
    if (!workspace?.id || !valid) return;
    if (scheduleMode === 'later' && !sendAt) { setError('Pick a date and time for the scheduled blast.'); return; }
    setSending(true); setReport(null); setError(null);
    try {
      const base = {
        workspaceId: workspace.id,
        title: title.trim(),
        body: body.trim(),
        image: image.trim() || undefined,
        linkType,
        linkValue: linkValue.trim() || undefined,
        tags: audience === 'tag' ? [tag.trim()] : undefined,
      };
      if (scheduleMode === 'now') {
        const key = `blast_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
        const r = await sendPushBroadcast({ ...base, idempotencyKey: key });
        setReport(`Blast queued: ${r.sent} sent, ${r.failed} failed.`);
      } else {
        const r = await schedulePush({
          ...base,
          sendAt: new Date(sendAt).toISOString(),
          onlyIfNoReply,
          noReplyWindowMinutes: noReplyMinutes,
          idempotencyKey: `blast_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
        });
        setReport(`Blast scheduled${onlyIfNoReply ? `, sends only when there is no reply within ${noReplyMinutes} minutes` : ''}. ID: ${r.scheduleId}`);
      }
      setConfirming(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Blast failed.');
    } finally {
      setSending(false);
    }
  };

  if (loading) {
    return (
      <div className="p-8 flex items-center gap-2 text-slate-400">
        <Loader2 className="w-5 h-5 animate-spin" /> Loading push status...
      </div>
    );
  }

  if (!configured) {
    return (
      <div className="p-8 max-w-xl">
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-6 space-y-3">
          <div className="flex items-center gap-2 text-amber-300 font-bold">
            <AlertTriangle className="w-5 h-5" /> Push is not set up yet
          </div>
          <p className="text-sm text-slate-300">
            Add the VAPID public key from Firebase Console before sending blasts. Subscribers join from your subscribe page.
          </p>
          <button
            onClick={onEnablePush}
            className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-sm font-bold cursor-pointer"
          >
            Open Push Settings
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-2xl space-y-5">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-2xl bg-violet-500/20 border border-violet-500/30 flex items-center justify-center">
          <BellRing className="w-5 h-5 text-violet-300" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-white">Push Blasts</h1>
          <p className="text-xs text-slate-400 flex items-center gap-1">
            <Users className="w-3 h-3" /> {subscribers} subscriber{subscribers === 1 ? '' : 's'} on this workspace
          </p>
        </div>
      </div>

      {/* Audience */}
      <div className="bg-slate-900/60 border border-white/10 rounded-2xl p-4 space-y-3">
        <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Audience</div>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setAudience('all')}
            className={`px-3 py-2.5 rounded-xl border text-sm font-semibold cursor-pointer transition-all ${
              audience === 'all' ? 'bg-violet-500/20 border-violet-500/50 text-violet-200' : 'bg-slate-950 border-white/10 text-slate-400 hover:text-slate-200'
            }`}
          >
            All subscribers
          </button>
          <button
            type="button"
            onClick={() => setAudience('tag')}
            className={`px-3 py-2.5 rounded-xl border text-sm font-semibold cursor-pointer transition-all flex items-center justify-center gap-1.5 ${
              audience === 'tag' ? 'bg-violet-500/20 border-violet-500/50 text-violet-200' : 'bg-slate-950 border-white/10 text-slate-400 hover:text-slate-200'
            }`}
          >
            <Tag className="w-3.5 h-3.5" /> Tag segment
          </button>
        </div>
        {audience === 'tag' && (
          <input
            value={tag}
            onChange={(e) => setTag(e.target.value)}
            placeholder="Tag name, e.g. vip"
            className="w-full bg-slate-950 border border-white/10 rounded-xl px-3 py-2 text-sm text-white placeholder:text-slate-600 outline-none focus:border-violet-500"
          />
        )}
      </div>

      {/* Message */}
      <div className="bg-slate-900/60 border border-white/10 rounded-2xl p-4 space-y-3">
        <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Message</div>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={120}
          placeholder="Title"
          className="w-full bg-slate-950 border border-white/10 rounded-xl px-3 py-2 text-sm text-white placeholder:text-slate-600 outline-none focus:border-violet-500"
        />
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          maxLength={500}
          rows={3}
          placeholder="Message body"
          className="w-full bg-slate-950 border border-white/10 rounded-xl px-3 py-2 text-sm text-white placeholder:text-slate-600 outline-none focus:border-violet-500 resize-none"
        />
        <input
          value={image}
          onChange={(e) => setImage(e.target.value)}
          placeholder="Image URL, https only (optional)"
          className="w-full bg-slate-950 border border-white/10 rounded-xl px-3 py-2 text-sm text-white placeholder:text-slate-600 outline-none focus:border-violet-500"
        />
        <div>
          <div className="text-[10px] font-bold uppercase text-slate-400 mb-1.5">Tap link</div>
          <div className="grid grid-cols-3 gap-1.5">
            {(['messenger', 'onpage', 'website'] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setLinkType(t)}
                className={`px-2 py-2 rounded-xl border text-xs font-semibold cursor-pointer transition-all ${
                  linkType === t ? 'bg-violet-500/20 border-violet-500/50 text-violet-200' : 'bg-slate-950 border-white/10 text-slate-400 hover:text-slate-200'
                }`}
              >
                {t === 'messenger' ? 'Messenger' : t === 'onpage' ? 'On page chat' : 'Website'}
              </button>
            ))}
          </div>
          <input
            value={linkValue}
            onChange={(e) => setLinkValue(e.target.value)}
            placeholder={linkType === 'messenger' ? 'Username or m.me link (optional)' : linkType === 'onpage' ? 'Your page URL, chat opens on tap (optional)' : 'Full https URL (optional)'}
            className="mt-2 w-full bg-slate-950 border border-white/10 rounded-xl px-3 py-2 text-sm text-white placeholder:text-slate-600 outline-none focus:border-violet-500"
          />
          <p className="text-[10px] text-slate-500 mt-1">
            {linkType === 'messenger' && 'Opens your Messenger thread so the conversation keeps going there.'}
            {linkType === 'onpage' && 'Opens your own page with the chat widget ready to talk.'}
            {linkType === 'website' && 'Plain link for sales pages and offers.'}
          </p>
        </div>
      </div>

      {/* Timing */}
      <div className="bg-slate-900/60 border border-white/10 rounded-2xl p-4 space-y-3">
        <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Timing</div>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setScheduleMode('now')}
            className={`px-3 py-2.5 rounded-xl border text-sm font-semibold cursor-pointer transition-all flex items-center justify-center gap-1.5 ${
              scheduleMode === 'now' ? 'bg-violet-500/20 border-violet-500/50 text-violet-200' : 'bg-slate-950 border-white/10 text-slate-400 hover:text-slate-200'
            }`}
          >
            <Send className="w-3.5 h-3.5" /> Send now
          </button>
          <button
            type="button"
            onClick={() => setScheduleMode('later')}
            className={`px-3 py-2.5 rounded-xl border text-sm font-semibold cursor-pointer transition-all flex items-center justify-center gap-1.5 ${
              scheduleMode === 'later' ? 'bg-violet-500/20 border-violet-500/50 text-violet-200' : 'bg-slate-950 border-white/10 text-slate-400 hover:text-slate-200'
            }`}
          >
            <Clock className="w-3.5 h-3.5" /> Schedule
          </button>
        </div>
        {scheduleMode === 'later' && (
          <div className="space-y-3">
            <input
              type="datetime-local"
              value={sendAt}
              onChange={(e) => setSendAt(e.target.value)}
              className="w-full bg-slate-950 border border-white/10 rounded-xl px-3 py-2 text-sm text-white outline-none focus:border-violet-500"
            />
            <button
              type="button"
              onClick={() => setOnlyIfNoReply(!onlyIfNoReply)}
              className="flex items-center gap-2 cursor-pointer"
            >
              <span className={`w-8 h-4.5 rounded-full p-0.5 transition-colors ${onlyIfNoReply ? 'bg-violet-500' : 'bg-slate-700'}`}>
                <span className={`block w-3.5 h-3.5 rounded-full bg-white transition-transform ${onlyIfNoReply ? 'translate-x-3.5' : ''}`} />
              </span>
              <span className="text-xs font-semibold text-slate-200">Only send when there is no reply</span>
            </button>
            {onlyIfNoReply && (
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-slate-400">No reply within</span>
                <input
                  type="number"
                  min={1}
                  max={10080}
                  value={noReplyMinutes}
                  onChange={(e) => setNoReplyMinutes(Math.max(1, Math.floor(Number(e.target.value) || 60)))}
                  className="w-20 bg-slate-950 border border-white/10 rounded-xl px-3 py-1.5 text-xs text-white outline-none focus:border-violet-500"
                />
                <span className="text-[11px] text-slate-400">minutes of send time</span>
              </div>
            )}
          </div>
        )}
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3 text-xs text-red-300 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" /> {error}
        </div>
      )}
      {report && (
        <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-3 text-xs text-emerald-300 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 flex-shrink-0" /> {report}
        </div>
      )}

      {!confirming ? (
        <button
          onClick={() => setConfirming(true)}
          disabled={!valid || sending}
          className="w-full px-4 py-3 bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white rounded-2xl text-sm font-bold cursor-pointer flex items-center justify-center gap-2"
        >
          <BellRing className="w-4 h-4" />
          {scheduleMode === 'now' ? `Blast to ${audience === 'all' ? 'all subscribers' : `tag "${tag.trim()}"`}` : 'Review scheduled blast'}
        </button>
      ) : (
        <div className="bg-slate-900/80 border border-violet-500/30 rounded-2xl p-4 space-y-3">
          <p className="text-sm text-slate-200">
            {scheduleMode === 'now' ? 'Send this push blast now' : 'Schedule this push blast'}
            {audience === 'all' ? ` to all ${subscribers} subscribers` : ` to tag "${tag.trim()}"`}{scheduleMode === 'later' && onlyIfNoReply ? `, only when there is no reply within ${noReplyMinutes} minutes` : ''}?
          </p>
          <div className="flex gap-2">
            <button
              onClick={handleBlast}
              disabled={sending}
              className="flex-1 px-4 py-2.5 bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white rounded-xl text-sm font-bold cursor-pointer flex items-center justify-center gap-2"
            >
              {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              Confirm
            </button>
            <button
              onClick={() => setConfirming(false)}
              disabled={sending}
              className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-sm font-semibold cursor-pointer"
            >
              Back
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
