import React, { useState, useEffect } from 'react';
import confetti from 'canvas-confetti';
import { Sparkles, ArrowRight, Rocket, Gift, Check, Plug } from 'lucide-react';
import { WorkspaceSilo } from '../../types/workspace';
import { Plan, PlanMode, formatPrice } from '../../lib/billing';
import { usePlans } from '../../lib/entitlements';
import { listStarterBonuses, importSnapshotPayload } from '../../lib/snapshots';
import { getStoredIntegrationCredentials } from '../../data/integrations';
import { ChatMizeLogo } from '../Logo';
import { ConnectStep } from './ConnectStep';
import { IntegrationsStep } from './IntegrationsStep';
import { RoutePicker } from './RoutePicker';

interface OnboardingWizardProps {
  workspace: WorkspaceSilo;
  onUpdateWorkspace: (ws: WorkspaceSilo) => void;
  onComplete: () => void;
  /** Start the wizard on a later step (e.g. after returning from an OAuth round-trip). */
  initialStep?: Step;
}

type Step = 'welcome' | 'connect' | 'integrations' | 'route' | 'done';

const STEPS: Step[] = ['welcome', 'connect', 'integrations', 'route', 'done'];
const STEP_LABELS: Record<Step, string> = {
  welcome: 'Welcome',
  connect: 'Connect accounts',
  integrations: 'Integrations',
  route: 'Choose your route',
  done: 'Launch',
};

/**
 * New-user onboarding: connect Meta/WhatsApp/SMS accounts, plug in the rest
 * of the marketing stack, pick the DIY vs Done-For-You track with the
 * trade-offs spelled out, choose a tier (changeable anytime in Settings),
 * then launch.
 */
export const OnboardingWizard: React.FC<OnboardingWizardProps> = ({
  workspace,
  onUpdateWorkspace,
  onComplete,
  initialStep,
}) => {
  const [step, setStep] = useState<Step>(initialStep ?? 'welcome');
  const [chosenMode, setChosenMode] = useState<PlanMode | null>(workspace.planMode ?? null);
  const [chosenPlan, setChosenPlan] = useState<Plan | null>(null);
  const [claimingBonus, setClaimingBonus] = useState(false);
  const [bonusClaimed, setBonusClaimed] = useState(false);
  const [bonusCount, setBonusCount] = useState(0);
  const [celebrated, setCelebrated] = useState(false);
  const { plans } = usePlans();

  const stepIndex = STEPS.indexOf(step);

  // Celebrate arrival at the launch step
  useEffect(() => {
    if (step === 'done' && !celebrated) {
      setCelebrated(true);
      const fire = (particleRatio: number, opts: confetti.Options) =>
        confetti({ origin: { y: 0.6 }, ...opts, particleCount: Math.floor(200 * particleRatio) });
      fire(0.25, { spread: 26, startVelocity: 55 });
      fire(0.2, { spread: 60 });
      fire(0.35, { spread: 100, decay: 0.91, scalar: 0.8 });
      fire(0.1, { spread: 120, startVelocity: 25, decay: 0.92, scalar: 1.2 });
      fire(0.1, { spread: 120, startVelocity: 45 });
    }
  }, [step, celebrated]);

  // Connected channel summary for the launch step
  const connectedChannels: { label: string; detail: string }[] = [];
  const cp = workspace.connectedPage;
  if (cp?.pageId) connectedChannels.push({ label: 'Messenger', detail: cp.pageName || cp.pageId });
  if (cp?.connectedIg?.connected) connectedChannels.push({ label: 'Instagram', detail: cp.connectedIg.username || '' });
  if (cp?.connectedWhatsApp?.connected) connectedChannels.push({ label: 'WhatsApp', detail: cp.connectedWhatsApp.phoneNumber || '' });
  if (workspace.connectedSms?.connected) connectedChannels.push({ label: 'SMS', detail: `${workspace.connectedSms.phoneNumber} · ${workspace.connectedSms.provider}` });
  let connectedIntegrations = 0;
  try {
    connectedIntegrations = Object.keys(getStoredIntegrationCredentials()).length;
  } catch {
    connectedIntegrations = 0;
  }

  const finish = (mode: PlanMode | null, plan: Plan | null) => {
    onUpdateWorkspace({
      ...workspace,
      planMode: mode ?? undefined,
      planId: plan?.id,
      onboardingComplete: true,
    });
    onComplete();
  };

  const handleRouteSelect = (mode: PlanMode, plan: Plan | null) => {
    setChosenMode(mode);
    setChosenPlan(plan);
    setStep('done');
  };

  const claimBonus = async () => {
    setClaimingBonus(true);
    try {
      const bonuses = await listStarterBonuses();
      let total = 0;
      for (const b of bonuses) {
        const counts = importSnapshotPayload(b.payload);
        total += Object.values(counts).reduce((a, n) => a + n, 0);
      }
      setBonusCount(total);
      setBonusClaimed(true);
    } catch {
      setBonusClaimed(true);
    } finally {
      setClaimingBonus(false);
    }
  };

  return (
    <div className="h-screen w-screen bg-slate-950 text-slate-50 flex flex-col overflow-hidden font-sans relative">
      <div className="absolute -top-48 -left-48 w-96 h-96 bg-cyan-600/15 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute top-1/2 -right-48 w-96 h-96 bg-purple-600/15 rounded-full blur-[120px] pointer-events-none" />

      {/* Header */}
      <div className="relative z-10 flex items-center justify-between px-6 sm:px-10 py-5">
        <div className="flex items-center gap-3">
          <ChatMizeLogo className="w-9 h-9" />
          <span className="text-xl font-black tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-cyan-400 to-blue-500">
            Chatmize
          </span>
        </div>
        <div className="flex items-center gap-2">
          {STEPS.map((s, i) => (
            <div key={s} className="flex items-center gap-2">
              <div
                className={`flex items-center gap-1.5 text-[11px] font-bold ${
                  i < stepIndex ? 'text-emerald-400' : i === stepIndex ? 'text-white' : 'text-slate-600'
                }`}
              >
                <span
                  className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${
                    i < stepIndex
                      ? 'bg-emerald-500/20 border border-emerald-500/40'
                      : i === stepIndex
                      ? 'bg-purple-500/20 border border-purple-500/40'
                      : 'bg-white/5 border border-white/10'
                  }`}
                >
                  {i + 1}
                </span>
                <span className="hidden sm:inline">{STEP_LABELS[s]}</span>
              </div>
              {i < STEPS.length - 1 && <div className="w-6 h-px bg-white/10" />}
            </div>
          ))}
        </div>
      </div>

      {/* Body */}
      <div className="relative z-10 flex-1 overflow-y-auto px-6 sm:px-10 pb-10">
        <div className="max-w-3xl mx-auto">
          {step === 'welcome' && (
            <div className="text-center pt-10 sm:pt-16 space-y-6">
              <div className="inline-flex p-4 rounded-3xl bg-gradient-to-br from-cyan-500/15 to-purple-500/15 border border-white/10">
                <Sparkles className="w-8 h-8 text-cyan-300" />
              </div>
              <h1 className="text-3xl sm:text-4xl font-black text-white leading-tight">
                Turn your DMs into<br />revenue on autopilot
              </h1>
              <p className="text-sm text-slate-400 max-w-xl mx-auto">
                ChatMize connects your Messenger, Instagram, WhatsApp, and SMS, then puts AI to work:
                answering questions, qualifying leads, and recovering sales while you sleep.
                Four quick steps and you are live.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-left max-w-2xl mx-auto pt-2">
                {[
                  { n: '1', t: 'Connect your accounts', d: 'Link your Facebook Page, Instagram, WhatsApp, and SMS.' },
                  { n: '2', t: 'Plug in your tools', d: 'Connect your email provider, CRM, and automations.' },
                  { n: '3', t: 'Choose your route', d: 'Run it yourself, or let our team do it for you.' },
                  { n: '4', t: 'Launch your automation', d: 'Pick a tier and your workspace is ready.' },
                ].map((s) => (
                  <div key={s.n} className="rounded-2xl border border-white/10 bg-slate-900/60 p-4">
                    <span className="text-[10px] font-black text-purple-300 bg-purple-500/15 border border-purple-500/30 px-2 py-0.5 rounded-full">
                      STEP {s.n}
                    </span>
                    <h3 className="text-xs font-bold text-white mt-2">{s.t}</h3>
                    <p className="text-[11px] text-slate-500 mt-1">{s.d}</p>
                  </div>
                ))}
              </div>
              <button
                type="button"
                onClick={() => setStep('connect')}
                className="px-8 py-3 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white rounded-2xl text-sm font-bold inline-flex items-center gap-2 cursor-pointer shadow-lg shadow-blue-500/25"
              >
                <span>Get started</span>
                <ArrowRight className="w-4 h-4" />
              </button>
              <p className="text-[11px] text-slate-600">Workspace: {workspace.name}</p>
            </div>
          )}

          {step === 'connect' && (
            <div className="pt-6">
              <ConnectStep
                workspace={workspace}
                onUpdate={onUpdateWorkspace}
                onNext={() => setStep('integrations')}
                onBack={() => setStep('welcome')}
              />
            </div>
          )}

          {step === 'integrations' && (
            <div className="pt-6">
              <IntegrationsStep
                onNext={() => setStep('route')}
                onBack={() => setStep('connect')}
              />
            </div>
          )}

          {step === 'route' && (
            <div className="pt-6 space-y-5">
              <div>
                <h2 className="text-lg font-black text-white mb-1">Choose your route</h2>
                <p className="text-xs text-slate-400">
                  Two ways to win with ChatMize. Pick the one that fits you today.
                  You can upgrade, downgrade, or switch tracks anytime in Settings.
                </p>
              </div>
              <RoutePicker
                plans={plans}
                initialMode={chosenMode ?? undefined}
                initialPlanId={chosenPlan?.id}
                onSelect={handleRouteSelect}
                onBack={() => setStep('connect')}
                submitLabel="Continue"
                allowDecideLater
                onDecideLater={() => {
                  setChosenMode(null);
                  setChosenPlan(null);
                  setStep('done');
                }}
              />
            </div>
          )}

          {step === 'done' && (
            <div className="text-center pt-10 sm:pt-16 space-y-6">
              <div className="inline-flex p-4 rounded-3xl bg-gradient-to-br from-emerald-500/15 to-cyan-500/15 border border-white/10">
                <Rocket className="w-8 h-8 text-emerald-300" />
              </div>
              <h1 className="text-3xl font-black text-white">You are all set</h1>
              <p className="text-sm text-slate-400 max-w-md mx-auto">
                Your workspace is live. Here is everything you wired up{chosenPlan ? '' : ' — pick your plan anytime in Settings → Plan'}.
              </p>

              <div className="max-w-md mx-auto rounded-3xl border border-white/10 bg-slate-900/60 p-5 text-left space-y-3">
                <p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500">Your setup</p>
                {(chosenMode || chosenPlan) && (
                  <>
                    {chosenMode && (
                      <p className="text-sm text-slate-300">
                        <span className="text-slate-500">Route:</span>{' '}
                        <span className="font-bold text-white">{chosenMode === 'dfu' ? 'Done-For-You' : 'DIY Self-Service'}</span>
                      </p>
                    )}
                    {chosenPlan && (
                      <p className="text-sm text-slate-300">
                        <span className="text-slate-500">Tier:</span>{' '}
                        <span className="font-bold text-white">{chosenPlan.name}</span>
                        <span className="text-slate-400"> · {formatPrice(chosenPlan.priceMonthlyCents)}/month</span>
                      </p>
                    )}
                  </>
                )}
                {connectedChannels.length > 0 && (
                  <div>
                    <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                      Channels ({connectedChannels.length})
                    </p>
                    <ul className="space-y-1.5">
                      {connectedChannels.map((c) => (
                        <li key={c.label} className="flex items-center gap-2 text-xs text-slate-300">
                          <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                          <span className="font-bold text-white">{c.label}</span>
                          <span className="text-slate-500 truncate">{c.detail}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {connectedIntegrations > 0 && (
                  <p className="text-sm text-slate-300 flex items-center gap-2">
                    <Plug className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                    <span>
                      <span className="font-bold text-white">{connectedIntegrations}</span>{' '}
                      <span className="text-slate-500">integration{connectedIntegrations === 1 ? '' : 's'} connected</span>
                    </span>
                  </p>
                )}
                {connectedChannels.length === 0 && connectedIntegrations === 0 && !chosenPlan && (
                  <p className="text-xs text-slate-500">
                    You skipped the setup steps. Connect channels and integrations anytime in Settings.
                  </p>
                )}
                {chosenPlan && chosenPlan.aiCreditsMonthly > 0 && (
                  <p className="text-[11px] text-slate-500 border-t border-white/10 pt-3">
                    {chosenPlan.aiCreditsMonthly.toLocaleString()} AI credits/month included. Change or cancel anytime in Settings → Plan.
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={() => finish(chosenMode, chosenPlan)}
                className="px-8 py-3 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white rounded-2xl text-sm font-bold inline-flex items-center gap-2 cursor-pointer shadow-lg shadow-blue-500/25"
              >
                <span>Launch ChatMize</span>
                <ArrowRight className="w-4 h-4" />
              </button>

              {/* Starter bonus: free snapshots for every new account, any plan */}
              <div className="mt-2 w-full max-w-md rounded-2xl border border-emerald-500/25 bg-emerald-500/5 p-4">
                {bonusClaimed ? (
                  <p className="text-xs text-emerald-300 font-bold text-center">
                    Starter bonus claimed: {bonusCount} free items added as drafts.
                  </p>
                ) : (
                  <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                      <Gift className="w-4 h-4 text-emerald-300 shrink-0" />
                      <p className="text-xs text-slate-300">
                        <span className="font-bold text-white">Signup bonus:</span> free starter
                        snapshots land in your account on any plan.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={claimBonus}
                      disabled={claimingBonus}
                      className="px-4 py-2 bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/40 text-emerald-200 rounded-xl text-xs font-bold cursor-pointer disabled:opacity-50 shrink-0"
                    >
                      {claimingBonus ? 'Claiming...' : 'Claim free snapshots'}
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
