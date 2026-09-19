import React from "react";
import { X, Crown, ArrowUpCircle, PlusCircle } from "lucide-react";

interface UpgradePromptModalProps {
  /** What the user tried to do, e.g. "capture tool". */
  resourceName: string;
  /** The plan limit they hit, e.g. 5. */
  limit: number;
  unit?: string;
  onClose: () => void;
  /** Optional: jump to billing/settings to upgrade. */
  onUpgrade?: () => void;
  /** Optional: buy one more a la carte. */
  onBuyExtra?: () => void;
}

/**
 * Shown when a workspace hits a modular plan limit. Copy has no dashes
 * (Karl's rule) and always offers both paths: upgrade or buy a la carte.
 */
export const UpgradePromptModal: React.FC<UpgradePromptModalProps> = ({
  resourceName,
  limit,
  unit = "",
  onClose,
  onUpgrade,
  onBuyExtra,
}) => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
      <div className="bg-slate-900 border border-white/10 rounded-3xl p-6 w-full max-w-md shadow-2xl">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-amber-500/20 text-amber-300 border border-amber-500/30">
              <Crown className="w-5 h-5" />
            </span>
            <h3 className="text-base font-bold text-white">Plan limit reached</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-white/10 text-slate-400 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <p className="text-sm text-slate-300 mb-1">
          Your plan includes {limit} {resourceName}
          {limit === 1 ? "" : "s"}
          {unit ? ` ${unit}` : ""}, and you are using all of them.
        </p>
        <p className="text-xs text-slate-500 mb-5">
          Upgrade your plan to open up more, or add just what you need a la carte.
        </p>
        <div className="space-y-2">
          {onUpgrade && (
            <button
              onClick={onUpgrade}
              className="w-full px-4 py-2.5 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-sm font-bold flex items-center justify-center gap-2 cursor-pointer"
            >
              <ArrowUpCircle className="w-4 h-4" /> Upgrade plan
            </button>
          )}
          {onBuyExtra && (
            <button
              onClick={onBuyExtra}
              className="w-full px-4 py-2.5 bg-slate-700 hover:bg-slate-600 text-white rounded-xl text-sm font-bold flex items-center justify-center gap-2 cursor-pointer"
            >
              <PlusCircle className="w-4 h-4" /> Add one more {resourceName}
            </button>
          )}
          <button
            onClick={onClose}
            className="w-full px-4 py-2.5 text-slate-400 hover:text-white rounded-xl text-sm font-semibold cursor-pointer"
          >
            Not now
          </button>
        </div>
      </div>
    </div>
  );
};
