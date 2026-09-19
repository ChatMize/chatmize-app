import React, { useState, useEffect } from 'react';
import { Sparkles, Check, ChevronRight, X, Minus } from 'lucide-react';
import { WorkspaceSilo } from '../types/workspace';
import { getStoredIntegrationCredentials } from '../data/integrations';

interface CopilotGuideProps {
  workspace: WorkspaceSilo;
  onGoToPlan: () => void;
  onGoToChannels: () => void;
  onGoToIntegrations: () => void;
  onGoToFlows: () => void;
  /** Permanently dismiss (persisted by the parent). */
  onDismiss: () => void;
}

interface GuideStep {
  id: string;
  title: string;
  description: string;
  done: boolean;
  detail?: string;
  actionLabel: string;
  onAction: () => void;
}

function countBots(): number {
  try {
    const raw = localStorage.getItem('chatmize_bot_maps_list');
    if (!raw) return 0;
    const list = JSON.parse(raw);
    return Array.isArray(list) ? list.length : 0;
  } catch {
    return 0;
  }
}

function countIntegrations(): number {
  try {
    return Object.keys(getStoredIntegrationCredentials()).length;
  } catch {
    return 0;
  }
}

/**
 * Post-onboarding copilot walkthrough: a floating guide that pops up after
 * launch and walks the user through the remaining setup work step by step.
 * Step completion is auto-detected from workspace state; each step deep-links
 * to the right place. Dismissable, and celebrates with confetti when done.
 */
export const CopilotGuide: React.FC<CopilotGuideProps> = ({
  workspace,
  onGoToPlan,
  onGoToChannels,
  onGoToIntegrations,
  onGoToFlows,
  onDismiss,
}) => {
  const [minimized, setMinimized] = useState(false);
  const [celebrated, setCelebrated] = useState(false);

  const cp = workspace.connectedPage;
  const channelCount = [
    Boolean(cp?.pageId),
    Boolean(cp?.connectedIg?.connected),
    Boolean(cp?.connectedWhatsApp?.connected),
    Boolean(workspace.connectedSms?.connected),
  ].filter(Boolean).length;
  const integrationCount = countIntegrations();
  const botCount = countBots();

  const steps: GuideStep[] = [
    {
      id: 'plan',
      title: 'Choose your route',
      description: 'DIY self service or Done For You.',
      done: Boolean(workspace.planId),
      actionLabel: 'Pick a plan',
      onAction: onGoToPlan,
    },
    {
      id: 'channels',
      title: 'Connect your channels',
      description: 'Where your audience talks to you.',
      done: channelCount > 0,
      detail: `${channelCount}/4 connected`,
      actionLabel: 'Connect',
      onAction: onGoToChannels,
    },
    {
      id: 'integrations',
      title: 'Plug in your tools',
      description: 'Email, CRM, and automations.',
      done: integrationCount > 0,
      detail: integrationCount > 0 ? `${integrationCount} connected` : undefined,
      actionLabel: 'Browse',
      onAction: onGoToIntegrations,
    },
    {
      id: 'flow',
      title: 'Build your first flow',
      description: 'Start from a template or blank canvas.',
      done: botCount > 0,
      detail: botCount > 0 ? `${botCount} bot${botCount === 1 ? '' : 's'}` : undefined,
      actionLabel: 'Open builder',
      onAction: onGoToFlows,
    },
  ];

  const doneCount = steps.filter((s) => s.done).length;
  const allDone = doneCount === steps.length;
  const currentStep = steps.find((s) => !s.done);

  useEffect(() => {
    if (allDone && !celebrated) {
      setCelebrated(true);
      // Loaded on demand: confetti only fires once, when the guide completes.
      import('canvas-confetti').then(({ default: confetti }) => {
        confetti({ particleCount: 120, spread: 75, origin: { y: 0.7 } });
        setTimeout(() => confetti({ particleCount: 60, spread: 100, origin: { y: 0.7 } }), 400);
      }).catch(() => {});
    }
  }, [allDone, celebrated]);

  if (minimized) {
    return (
      <button
        type="button"
        onClick={() => setMinimized(false)}
        title="Open setup guide"
        className="fixed bottom-5 right-5 z-50 w-12 h-12 rounded-full bg-gradient-to-br from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white flex items-center justify-center shadow-lg shadow-blue-500/30 cursor-pointer"
      >
        <Sparkles className="w-5 h-5" />
        {doneCount < steps.length && (
          <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-purple-600 text-[10px] font-black flex items-center justify-center border-2 border-slate-950">
            {steps.length - doneCount}
          </span>
        )}
      </button>
    );
  }

  return (
    <div className="fixed bottom-5 right-5 z-50 w-80 max-w-[calc(100vw-2.5rem)] rounded-3xl border border-white/10 bg-slate-900/95 backdrop-blur shadow-2xl shadow-black/50 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-cyan-600/20 to-blue-600/20 border-b border-white/10">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-cyan-300" />
          <div>
            <p className="text-xs font-black text-white leading-tight">Copilot setup guide</p>
            <p className="text-[10px] text-slate-400 leading-tight">
              {allDone ? 'You are live. Nice work.' : `${doneCount} of ${steps.length} done — let's finish strong.`}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setMinimized(true)}
            title="Minimize"
            className="p-1.5 text-slate-500 hover:text-white cursor-pointer"
          >
            <Minus className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={onDismiss}
            title="Dismiss forever"
            className="p-1.5 text-slate-500 hover:text-white cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="p-3 space-y-1.5">
        {steps.map((s) => {
          const isCurrent = !allDone && currentStep?.id === s.id;
          return (
            <div
              key={s.id}
              className={`rounded-2xl border p-3 transition-all ${
                s.done
                  ? 'border-emerald-500/25 bg-emerald-500/5'
                  : isCurrent
                  ? 'border-cyan-500/40 bg-cyan-500/5'
                  : 'border-white/5 bg-white/[0.02]'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2.5 min-w-0">
                  <span
                    className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${
                      s.done ? 'bg-emerald-500/20 text-emerald-300' : 'bg-white/5 text-slate-500'
                    }`}
                  >
                    {s.done ? <Check className="w-3.5 h-3.5" /> : <span className="text-[10px] font-black">{steps.indexOf(s) + 1}</span>}
                  </span>
                  <div className="min-w-0">
                    <p className={`text-xs font-bold truncate ${s.done ? 'text-slate-400' : 'text-white'}`}>{s.title}</p>
                    <p className="text-[10px] text-slate-500 truncate">
                      {s.description}
                      {s.detail ? ` · ${s.detail}` : ''}
                    </p>
                  </div>
                </div>
                {!s.done && isCurrent && (
                  <button
                    type="button"
                    onClick={s.onAction}
                    className="shrink-0 flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-500/40 text-cyan-200 text-[11px] font-bold cursor-pointer"
                  >
                    {s.actionLabel}
                    <ChevronRight className="w-3 h-3" />
                  </button>
                )}
                {!s.done && !isCurrent && (
                  <button
                    type="button"
                    onClick={s.onAction}
                    className="shrink-0 text-[11px] font-bold text-slate-500 hover:text-slate-200 cursor-pointer px-1"
                  >
                    {s.actionLabel}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="px-4 pb-3">
        <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
          <div
            className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-blue-500 transition-all"
            style={{ width: `${(doneCount / steps.length) * 100}%` }}
          />
        </div>
        {allDone && (
          <button
            type="button"
            onClick={onDismiss}
            className="mt-2 w-full text-[11px] font-bold text-slate-400 hover:text-white cursor-pointer"
          >
            Done — dismiss the guide
          </button>
        )}
      </div>
    </div>
  );
};
