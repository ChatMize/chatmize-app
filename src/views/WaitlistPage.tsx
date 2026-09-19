import React, { useState } from 'react';
import { MailCheck, Loader2, AlertCircle, Sparkles } from 'lucide-react';
import { ChatMizeLogo } from '../components/Logo';

/**
 * Public waitlist signup page, served at /waitlist (hosting rewrites ** to
 * index.html; App.tsx short-circuits to this view before the auth gate).
 * Writes go to the production waitlist API (double opt in via SES), never to
 * browser storage.
 */
const WAITLIST_API = 'https://us-west2-gen-lang-client-0433776094.cloudfunctions.net/metaWebhook?wl=signup';

export const WAITLIST_CONSENT_TEXT =
  'Yes, email me about the ChatMize launch, product updates, and early access invites. I can unsubscribe anytime.';

type SubmitState = 'idle' | 'sending' | 'done' | 'error';

export const WaitlistPage: React.FC = () => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [segmateUser, setSegmateUser] = useState(false);
  const [consent, setConsent] = useState(false);
  const [state, setState] = useState<SubmitState>('idle');
  const [message, setMessage] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (state === 'sending') return;
    if (!name.trim()) {
      setState('error');
      setMessage('Please enter your name.');
      return;
    }
    if (!consent) {
      setState('error');
      setMessage('Please accept the email consent to join the waitlist.');
      return;
    }
    setState('sending');
    setMessage('');
    try {
      const res = await fetch(WAITLIST_API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          source: 'app-waitlist-page',
          segmateUser,
          consentText: WAITLIST_CONSENT_TEXT,
          consentAt: new Date().toISOString(),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.ok === false) {
        throw new Error(data.error || 'Something went wrong. Please try again.');
      }
      setState('done');
    } catch (err: any) {
      setState('error');
      setMessage(err?.message || 'Something went wrong. Please try again.');
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 flex flex-col items-center justify-center px-4 py-12 relative overflow-hidden">
      {/* ambient glow */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-32 left-1/2 -translate-x-1/2 w-[560px] h-[560px] rounded-full bg-indigo-600/15 blur-[120px]" />
        <div className="absolute bottom-0 right-0 w-[420px] h-[420px] rounded-full bg-cyan-500/10 blur-[100px]" />
      </div>

      <div className="relative w-full max-w-md">
        <div className="flex justify-center mb-8">
          <ChatMizeLogo className="h-12 w-auto" />
        </div>

        {state === 'done' ? (
          <div className="bg-slate-900/80 border border-emerald-500/30 rounded-3xl p-8 text-center shadow-2xl backdrop-blur">
            <div className="mx-auto w-14 h-14 rounded-full bg-emerald-500/15 border border-emerald-500/40 flex items-center justify-center mb-5">
              <MailCheck className="w-7 h-7 text-emerald-400" />
            </div>
            <h1 className="text-2xl font-black text-white tracking-tight mb-2">Check your inbox</h1>
            <p className="text-sm text-slate-400 leading-relaxed">
              We sent a confirmation email to <span className="text-slate-200 font-semibold">{email.trim()}</span>.
              Tap the link inside to hold your spot. It expires in 7 days.
            </p>
          </div>
        ) : (
          <div className="bg-slate-900/80 border border-white/10 rounded-3xl p-8 shadow-2xl backdrop-blur">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-500/15 border border-indigo-500/30 text-indigo-300 text-[11px] font-bold uppercase tracking-wider mb-4">
              <Sparkles className="w-3.5 h-3.5" />
              Early access
            </div>
            <h1 className="text-3xl font-black text-white tracking-tight mb-2">Join the ChatMize waitlist</h1>
            <p className="text-sm text-slate-400 leading-relaxed mb-6">
              Be first in line when ChatMize opens. Early members get launch pricing and a say in what we build next.
            </p>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="wl-name" className="block text-xs font-bold text-slate-300 mb-1.5">Your name</label>
                <input
                  id="wl-name"
                  type="text"
                  name="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Jane Founder"
                  autoComplete="name"
                  className="w-full px-4 py-3 rounded-xl bg-slate-950/80 border border-white/10 text-white placeholder:text-slate-500 text-sm focus:outline-none focus:border-indigo-500/60 focus:ring-2 focus:ring-indigo-500/20"
                />
              </div>
              <div>
                <label htmlFor="wl-email" className="block text-xs font-bold text-slate-300 mb-1.5">Email address</label>
                <input
                  id="wl-email"
                  type="email"
                  name="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@company.com"
                  autoComplete="email"
                  inputMode="email"
                  required
                  className="w-full px-4 py-3 rounded-xl bg-slate-950/80 border border-white/10 text-white placeholder:text-slate-500 text-sm focus:outline-none focus:border-indigo-500/60 focus:ring-2 focus:ring-indigo-500/20"
                />
              </div>

              <label className="flex items-start gap-3 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={segmateUser}
                  onChange={(e) => setSegmateUser(e.target.checked)}
                  className="mt-0.5 w-4 h-4 rounded accent-indigo-500 cursor-pointer"
                />
                <span className="text-xs text-slate-400 group-hover:text-slate-300">
                  I am a SegMate user <span className="text-slate-500">(founding members get priority invites)</span>
                </span>
              </label>

              <label className="flex items-start gap-3 cursor-pointer bg-slate-950/60 border border-white/10 rounded-xl p-3.5">
                <input
                  type="checkbox"
                  checked={consent}
                  onChange={(e) => setConsent(e.target.checked)}
                  className="mt-0.5 w-4 h-4 rounded accent-indigo-500 cursor-pointer shrink-0"
                />
                <span className="text-xs text-slate-300 leading-relaxed">
                  {WAITLIST_CONSENT_TEXT} <span className="text-rose-400 font-bold">*</span>
                </span>
              </label>

              {state === 'error' && message && (
                <div className="flex items-start gap-2 text-xs text-rose-300 bg-rose-500/10 border border-rose-500/30 rounded-xl px-3.5 py-2.5">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-px" />
                  <span>{message}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={state === 'sending'}
                className="w-full py-3.5 rounded-xl font-bold text-sm text-white bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-400 hover:to-purple-500 disabled:opacity-60 disabled:cursor-wait transition-all shadow-lg shadow-indigo-500/25 flex items-center justify-center gap-2 cursor-pointer"
              >
                {state === 'sending' && <Loader2 className="w-4 h-4 animate-spin" />}
                {state === 'sending' ? 'Joining...' : 'Join the waitlist'}
              </button>

              <p className="text-[11px] text-slate-500 leading-relaxed text-center">
                We only email you about ChatMize. No spam, no selling your data, unsubscribe anytime.
              </p>
            </form>
          </div>
        )}

        <p className="text-center text-[11px] text-slate-600 mt-6">
          ChatMize &middot; chatmize.com
        </p>
      </div>
    </div>
  );
};
