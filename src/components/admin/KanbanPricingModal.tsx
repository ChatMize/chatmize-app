import React, { useState } from 'react';
import { 
  Calculator, 
  X, 
  Sliders, 
  Sparkles, 
  DollarSign, 
  TrendingUp, 
  CheckCircle2, 
  AlertTriangle,
  Layers,
  ArrowRight
} from 'lucide-react';

interface KanbanPricingModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const KanbanPricingModal: React.FC<KanbanPricingModalProps> = ({
  isOpen,
  onClose
}) => {
  const [simPagesCount, setSimPagesCount] = useState<number>(8);
  const [simAvgContacts, setSimAvgContacts] = useState<number>(3500);
  const [simAgencyClientFee, setSimAgencyClientFee] = useState<number>(99);

  if (!isOpen) return null;

  // Approximate Per-Page Tiered Model calculations
  // Free: 500 contacts ($0)
  // Standard Tiered: ~ $15 (up to 500) | $25 (2.5k) | $45 (5k) | $65 (10k) | $145 (25k) per page
  const calcPerPagedCost = (contacts: number) => {
    if (contacts <= 500) return 15;
    if (contacts <= 2500) return 25;
    if (contacts <= 5000) return 45;
    if (contacts <= 10000) return 65;
    if (contacts <= 25000) return 145;
    return 145 + Math.ceil((contacts - 25000) / 1000) * 5;
  };

  const perPageCostUnit = calcPerPagedCost(simAvgContacts);
  const perPageTotalCost = simPagesCount * perPageCostUnit;
  const flatAgencyUnlimitedCost = 299; // Flat agency unlimited pages membership
  const agencyClientRevenue = simPagesCount * simAgencyClientFee;
  const perPageMargin = agencyClientRevenue - perPageTotalCost;
  const flatUnlimitedMargin = agencyClientRevenue - flatAgencyUnlimitedCost;
  const monthlySavingsWithFlat = perPageTotalCost - flatAgencyUnlimitedCost;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 overflow-hidden">
      <div className="bg-slate-900 border border-cyan-500/30 rounded-2xl max-w-3xl w-full max-h-[92vh] flex flex-col shadow-2xl text-xs text-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Sticky Header */}
        <div className="flex-shrink-0 flex items-center justify-between px-5 sm:px-6 py-4 border-b border-slate-800 bg-slate-900/95 backdrop-blur-sm z-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center text-white shadow-lg shadow-cyan-500/20">
              <Calculator className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-bold text-white">Commercial Architecture &amp; Pricing Strategy Matrix</h3>
              <p className="text-xs text-slate-400">Interactive economic model to plan ChatMize's business silo and page billing architecture.</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white cursor-pointer transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="flex-1 min-h-0 overflow-y-auto px-5 sm:px-6 py-5 space-y-6">
          {/* Model Comparison Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Flat Agency Model Box */}
          <div className="p-4 rounded-xl bg-slate-950 border border-indigo-500/30 space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-bold text-indigo-300 text-sm">Agency Flat Unlimited Model</span>
              <span className="px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 text-[10px] font-mono font-bold">
                Flat $299/mo Agency Fee
              </span>
            </div>
            <p className="text-slate-400 leading-relaxed">
              Agencies can connect <strong className="text-white">unlimited Facebook Pages</strong> at one flat agency subscription price ($199–$299/mo). Each FB page acts as its own isolated workspace silo.
            </p>
            <div className="space-y-1.5 text-[11px] text-slate-300">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
                <span>High appeal to marketing agencies managing 5–20+ local client accounts</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
                <span>Predictable recurring software overhead for the business owner</span>
              </div>
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
                <span>High infrastructure usage risk if an agency connects 50+ viral broadcast pages</span>
              </div>
            </div>
          </div>

          {/* Standard Per-Page Tiered Box */}
          <div className="p-4 rounded-xl bg-slate-950 border border-cyan-500/30 space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-bold text-cyan-300 text-sm">Standard Tiered Model</span>
              <span className="px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-300 text-[10px] font-mono font-bold">
                Per-Page + Free Light Tier
              </span>
            </div>
            <p className="text-slate-400 leading-relaxed">
              Every Facebook Page requires an <strong className="text-white">independent paid subscription</strong> (starting at $15/mo scaling by contacts). Includes an entry <strong className="text-white">Free Light Account</strong> (500 contacts limit).
            </p>
            <div className="space-y-1.5 text-[11px] text-slate-300">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
                <span>Free Light tier provides viral top-of-funnel onboarding and self-service growth</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
                <span>Direct margin protection (more contacts/pages = direct revenue expansion)</span>
              </div>
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-3.5 h-3.5 text-rose-400 flex-shrink-0" />
                <span>Extremely cost-prohibitive for boutique agencies with 10+ modest client pages</span>
              </div>
            </div>
          </div>
        </div>

        {/* Interactive Simulation Sliders */}
        <div className="p-5 rounded-xl bg-slate-950 border border-slate-800 space-y-4">
          <h4 className="font-bold text-sm text-white flex items-center gap-2">
            <Sliders className="w-4 h-4 text-cyan-400" />
            Live Agency Economic Simulator
          </h4>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <div>
              <div className="flex items-center justify-between text-xs text-slate-300 mb-1.5">
                <span>Active Client Pages (Silos):</span>
                <span className="font-mono font-bold text-cyan-400">{simPagesCount} Pages</span>
              </div>
              <input
                type="range"
                min="1"
                max="30"
                value={simPagesCount}
                onChange={(e) => setSimPagesCount(parseInt(e.target.value))}
                className="w-full accent-cyan-400 cursor-pointer"
              />
            </div>

            <div>
              <div className="flex items-center justify-between text-xs text-slate-300 mb-1.5">
                <span>Avg Contacts per Silo:</span>
                <span className="font-mono font-bold text-indigo-400">{simAvgContacts.toLocaleString()}</span>
              </div>
              <input
                type="range"
                min="500"
                max="25000"
                step="500"
                value={simAvgContacts}
                onChange={(e) => setSimAvgContacts(parseInt(e.target.value))}
                className="w-full accent-indigo-400 cursor-pointer"
              />
            </div>

            <div>
              <div className="flex items-center justify-between text-xs text-slate-300 mb-1.5">
                <span>Agency Charges Client / mo:</span>
                <span className="font-mono font-bold text-emerald-400">${simAgencyClientFee}</span>
              </div>
              <input
                type="range"
                min="49"
                max="299"
                step="10"
                value={simAgencyClientFee}
                onChange={(e) => setSimAgencyClientFee(parseInt(e.target.value))}
                className="w-full accent-emerald-400 cursor-pointer"
              />
            </div>
          </div>

          {/* Side-by-Side Results Matrix */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-3 border-t border-slate-900 text-xs">
            <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 text-center">
              <span className="text-[11px] text-slate-400 block mb-1">Agency Client Revenue</span>
              <span className="text-xl font-bold text-emerald-400 font-mono">
                ${agencyClientRevenue.toLocaleString()}/mo
              </span>
              <span className="text-[10px] text-slate-500 block mt-1">{simPagesCount} clients @ ${simAgencyClientFee}/mo</span>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 text-center">
              <span className="text-[11px] text-slate-400 block mb-1">Cost under Per-Page Tiered</span>
              <span className="text-xl font-bold text-cyan-400 font-mono">
                ${perPageTotalCost.toLocaleString()}/mo
              </span>
              <span className="text-[10px] text-slate-400 block mt-1">
                Margin: <strong className="text-white">${perPageMargin.toLocaleString()}</strong>/mo
              </span>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-900 border border-indigo-500/30 text-center">
              <span className="text-[11px] text-slate-400 block mb-1">Cost under Agency Flat Unlimited</span>
              <span className="text-xl font-bold text-indigo-400 font-mono">
                ${flatAgencyUnlimitedCost}/mo
              </span>
              <span className="text-[10px] text-emerald-400 font-semibold block mt-1">
                Margin: <strong>${flatUnlimitedMargin.toLocaleString()}</strong>/mo
              </span>
            </div>
          </div>

          {/* Savings Highlight */}
          {monthlySavingsWithFlat > 0 && (
            <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-between text-xs">
              <span className="text-emerald-300 font-medium">
                Agency savings with Flat Unlimited membership at {simPagesCount} pages:
              </span>
              <span className="font-mono font-bold text-emerald-400 text-sm">
                +${monthlySavingsWithFlat.toLocaleString()}/month
              </span>
            </div>
          )}
        </div>

        {/* Recommended Strategic Hybrid Model */}
        <div className="p-4 rounded-xl bg-gradient-to-r from-cyan-950/40 via-indigo-950/40 to-slate-900 border border-cyan-500/30 text-xs space-y-2">
          <span className="font-bold text-cyan-300 uppercase tracking-wider flex items-center gap-1.5">
            <Sparkles className="w-4 h-4 text-cyan-400" />
            ChatMize Strategic Recommendation: The Hybrid Model
          </span>
          <div className="text-slate-300 space-y-2 leading-relaxed">
            <p>
              1. <strong className="text-white">Single Business Silo (Tiered Model):</strong> Free Light tier ($0 up to 500 contacts, watermark enforced). Upgrades to Standard ($49/mo) for 1 FB Page + 1 IG + 1 WhatsApp + SMS.
            </p>
            <p>
              2. <strong className="text-white">Agency Multi-Silo Pack (Flat Unlimited Style):</strong> $299/mo bundle including <strong className="text-white">up to 10 isolated business silos</strong> with full Whitelabel Client Portal. Additional silos available as add-ons for $19/mo per page.
            </p>
          </div>
        </div>
      </div>

      {/* Sticky Footer */}
      <div className="flex-shrink-0 flex justify-end px-5 sm:px-6 py-3.5 border-t border-slate-800 bg-slate-900/95 backdrop-blur-sm z-10">
        <button
          onClick={onClose}
          className="px-5 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs cursor-pointer transition-all shadow-md shadow-cyan-500/20"
        >
          Done Reviewing Strategy
        </button>
      </div>
    </div>
  </div>
);
};
