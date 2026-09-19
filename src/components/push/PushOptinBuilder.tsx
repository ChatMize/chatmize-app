import React, { useEffect, useState } from 'react';
import { BellRing, Loader2, CheckCircle2, AlertTriangle, Copy, Code2, Link2, Eye } from 'lucide-react';
import { getPushPromptCopy, setPushPromptCopy } from '../../lib/push';

interface PushOptinBuilderProps {
  workspaceId: string;
}

const DEFAULTS = {
  headline: 'Get updates from us',
  subtext: 'Tap allow and we will send you helpful updates right in your browser. No spam, unsubscribe anytime.',
  allowLabel: 'Allow notifications',
  dismissLabel: 'Not now',
};

/**
 * Growth tool: the web push opt-in prompt. Businesses customize the soft-ask
 * prompt, then place it on their site with the embed snippet or send visitors
 * to the hosted signup page. The prompt always soft-asks first so the hard
 * browser permission prompt only appears after a tap.
 */
export const PushOptinBuilder: React.FC<PushOptinBuilderProps> = ({ workspaceId }) => {
  const [copy, setCopy] = useState(DEFAULTS);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [embedMode, setEmbedMode] = useState<'iframe' | 'script' | 'link'>('iframe');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        // Member-guarded read: returns the saved prompt even before a VAPID
        // key exists. The public config deliberately omits the prompt when
        // unconfigured, which made saves look like they silently reverted.
        const prompt = await getPushPromptCopy(workspaceId);
        setCopy({ ...DEFAULTS, ...prompt });
      } catch { /* leave defaults */ }
    })();
  }, [workspaceId]);

  const pageUrl = `${window.location.origin}${window.location.pathname}?push=${workspaceId}`;

  const embedCode = embedMode === 'iframe'
    ? `<iframe src="${pageUrl}&embed=1" width="380" height="300" style="border:0;border-radius:16px;overflow:hidden" title="Push signup"></iframe>`
    : embedMode === 'script'
      ? `<script>\n  // ChatMize push opt-in: opens the signup prompt as a popup\n  function chatmizePushPrompt() {\n    window.open("${pageUrl}", "chatmize-push", "width=420,height=560");\n  }\n</script>\n<button onclick="chatmizePushPrompt()">${copy.allowLabel}</button>`
      : pageUrl;

  const handleSave = async () => {
    setSaving(true); setError(null); setSaved(false);
    try {
      await setPushPromptCopy(workspaceId, copy);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save.');
    } finally {
      setSaving(false);
    }
  };

  const handleCopyEmbed = async () => {
    try { await navigator.clipboard.writeText(embedCode); } catch {
      const ta = document.createElement('textarea');
      ta.value = embedCode; document.body.appendChild(ta); ta.select();
      document.execCommand('copy'); ta.remove();
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const field = (label: string, key: keyof typeof DEFAULTS, max: number, multiline = false) => (
    <label className="block">
      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{label}</span>
      {multiline ? (
        <textarea
          value={copy[key]}
          onChange={(e) => setCopy({ ...copy, [key]: e.target.value })}
          maxLength={max}
          rows={3}
          className="mt-1 w-full bg-slate-900 border border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder:text-slate-600 outline-none focus:border-violet-500 resize-none"
        />
      ) : (
        <input
          value={copy[key]}
          onChange={(e) => setCopy({ ...copy, [key]: e.target.value })}
          maxLength={max}
          className="mt-1 w-full bg-slate-900 border border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder:text-slate-600 outline-none focus:border-violet-500"
        />
      )}
    </label>
  );

  return (
    <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl p-5 md:col-span-2">
      <div className="flex items-center gap-3 mb-1">
        <div className="p-2.5 bg-violet-500/15 rounded-xl border border-violet-500/25">
          <BellRing className="w-5 h-5 text-violet-300" />
        </div>
        <div>
          <h3 className="font-bold text-white text-sm">Push opt in prompt</h3>
          <p className="text-xs text-slate-400">A friendly soft ask that lives on your site and grows your push list.</p>
        </div>
      </div>

      {error && (
        <div className="my-3 p-3 rounded-xl bg-red-500/10 border border-red-500/25 text-red-300 text-xs flex gap-2">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" /> {error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-4">
        {/* Copy editor */}
        <div className="space-y-3">
          {field('Headline', 'headline', 80)}
          {field('Subtext', 'subtext', 300, true)}
          <div className="grid grid-cols-2 gap-3">
            {field('Allow button', 'allowLabel', 40)}
            {field('Dismiss button', 'dismissLabel', 40)}
          </div>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white rounded-xl text-xs font-bold cursor-pointer flex items-center gap-1.5"
          >
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : saved ? <CheckCircle2 className="w-3.5 h-3.5" /> : null}
            {saved ? 'Saved' : 'Save prompt copy'}
          </button>
          <p className="text-[10px] text-slate-500 leading-relaxed">
            The prompt soft asks first. Only when a visitor taps allow does the browser show its
            own permission dialog. That keeps opt in rates high and avoids permanent blocks.
          </p>
        </div>

        {/* Live preview */}
        <div>
          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-2 flex items-center gap-1.5">
            <Eye className="w-3 h-3" /> Live preview
          </div>
          <div className="rounded-2xl bg-gradient-to-br from-violet-950/60 to-slate-950 border border-violet-500/20 p-8 flex items-center justify-center">
            <div className="w-full max-w-[320px] bg-slate-900 border border-white/10 rounded-2xl p-5 shadow-2xl">
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2.5 bg-violet-500/20 rounded-xl">
                  <BellRing className="w-5 h-5 text-violet-300" />
                </div>
                <div className="font-bold text-white text-sm leading-tight">{copy.headline || DEFAULTS.headline}</div>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed mb-4">{copy.subtext || DEFAULTS.subtext}</p>
              <button className="w-full py-2.5 bg-violet-600 text-white rounded-xl text-xs font-bold mb-2">
                {copy.allowLabel || DEFAULTS.allowLabel}
              </button>
              <button className="w-full py-2 text-slate-500 text-xs font-semibold">
                {copy.dismissLabel || DEFAULTS.dismissLabel}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Embed */}
      <div className="mt-6 pt-4 border-t border-white/10">
        <div className="flex items-center gap-2 mb-3">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Put it on your site</span>
          <div className="flex items-center gap-1 p-0.5 bg-slate-900 border border-white/10 rounded-lg text-[11px] font-semibold">
            {(['iframe', 'script', 'link'] as const).map((m) => (
              <button
                key={m}
                onClick={() => setEmbedMode(m)}
                className={`px-2.5 py-1 rounded-md cursor-pointer flex items-center gap-1 ${embedMode === m ? 'bg-violet-600 text-white' : 'text-slate-400 hover:text-white'}`}
              >
                {m === 'iframe' ? <Code2 className="w-3 h-3" /> : <Link2 className="w-3 h-3" />}
                {m === 'iframe' ? 'Embed' : m === 'script' ? 'Popup button' : 'Link'}
              </button>
            ))}
          </div>
        </div>
        <div className="flex gap-2">
          <pre className="flex-1 bg-slate-950 border border-white/10 rounded-xl px-3 py-2.5 text-[11px] text-slate-300 font-mono overflow-x-auto whitespace-pre-wrap break-all">{embedCode}</pre>
          <button
            onClick={handleCopyEmbed}
            className="px-3 py-2 bg-white/10 hover:bg-white/15 text-white rounded-xl text-xs font-bold cursor-pointer flex items-center gap-1.5 self-start"
          >
            {copied ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            {copied ? 'Copied' : 'Copy'}
          </button>
        </div>
      </div>
    </div>
  );
};
