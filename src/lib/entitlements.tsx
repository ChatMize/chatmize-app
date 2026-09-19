import React, { useEffect, useState } from "react";
import {
  Plan,
  PlanFeature,
  DEFAULT_PLANS,
  subscribeToPlans,
  ensureDefaultPlans,
} from "./billing";

/**
 * The single entitlement gate. Every feature in the app checks access through
 * hasFeature() or the <PlanGate> component. Nothing hardcodes plan names.
 */
export function hasFeature(plan: Plan | null | undefined, feature: PlanFeature): boolean {
  if (!plan) return false;
  return plan.features.includes(feature);
}

/** Live plans from Firestore, falling back to defaults (seeded when empty). */
export function usePlans(): { plans: Plan[]; loading: boolean } {
  const [plans, setPlans] = useState<Plan[]>(DEFAULT_PLANS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    // Subscribe to the live plans immediately. The one-time seed used to gate
    // the subscription, so a slow/stalled seed round-trip left the Plans tab
    // stuck on "Loading plans..." with no tier cards (the header renders
    // regardless). The seed now runs in the background and can never block
    // the tier cards.
    const unsub = subscribeToPlans(
      (data) => {
        if (cancelled) return;
        setPlans(data.length > 0 ? data : DEFAULT_PLANS);
        setLoading(false);
      },
      () => {
        if (!cancelled) setLoading(false);
      },
    );
    ensureDefaultPlans().catch((e) =>
      console.warn("Could not ensure default plans:", e),
    );
    // Safety net: never leave the UI stuck in the loading state. If Firestore
    // never answers, fall back to the bundled default tiers so the cards
    // always render.
    const timer = setTimeout(() => {
      if (!cancelled) setLoading(false);
    }, 15000);
    return () => {
      cancelled = true;
      clearTimeout(timer);
      unsub();
    };
  }, []);

  return { plans, loading };
}

/** Resolve a plan by id from the live list. */
export function usePlan(planId?: string): Plan | null {
  const { plans } = usePlans();
  if (!planId) return null;
  return plans.find((p) => p.id === planId) ?? null;
}

interface PlanGateProps {
  plan: Plan | null | undefined;
  feature: PlanFeature;
  /** Rendered when the plan lacks the feature. Defaults to nothing. */
  fallback?: React.ReactNode;
  children: React.ReactNode;
}

/** Render children only when the plan unlocks the feature. */
export const PlanGate: React.FC<PlanGateProps> = ({ plan, feature, fallback = null, children }) => {
  return <>{hasFeature(plan, feature) ? children : fallback}</>;
}
