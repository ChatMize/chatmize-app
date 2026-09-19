import React, { useState } from 'react';
import { 
  AlertTriangle, 
  ArrowRight, 
  BellRing, 
  CheckCircle2, 
  Clock, 
  ExternalLink, 
  FileText, 
  HelpCircle, 
  Info, 
  Lock, 
  MessageCircle, 
  MessageSquare, 
  RefreshCw, 
  Send, 
  ShieldAlert, 
  ShieldCheck, 
  Sparkles, 
  Tag, 
  UserCheck, 
  Workflow, 
  X, 
  Zap 
} from 'lucide-react';
import { FlowNode, FlowConnection } from '../views/FlowBuilder';
import { 
  META_MESSAGING_RULES, 
  validateMessageTagCompliance, 
  MetaMessageTag 
} from '../types/metaMessaging';

interface MetaPolicyModalProps {
  nodes: FlowNode[];
  connections: FlowConnection[];
  onClose: () => void;
  onApplyFix?: (nodeId: string, updates: Partial<FlowNode>) => void;
}

export function MetaPolicyModal({ nodes, connections, onClose, onApplyFix }: MetaPolicyModalProps) {
  const [activeTab, setActiveTab] = useState<'audit' | 'rules' | 'validator'>('audit');
  const [testText, setTestText] = useState('Hey {{first_name}}! Use code SUMMER20 to get 20% off your VIP ticket today!');
  const [testTag, setTestTag] = useState<MetaMessageTag>('CONFIRMED_EVENT_UPDATE');

  // Analyze flow nodes and delays
  const auditResults = (() => {
    const issues: {
      nodeId: string;
      nodeTitle: string;
      severity: 'error' | 'warning' | 'pass';
      message: string;
      recommendation: string;
      suggestedFix?: { tag?: MetaMessageTag };
    }[] = [];

    // Find any delays in the flow
    const delayNodes = nodes.filter(n => n.type === 'delay');
    let hasLongDelay = false;

    delayNodes.forEach(delay => {
      const delayLower = (delay.delayText || delay.content || '').toLowerCase();
      // Check if delay is 24 hours, 1 day, or more
      const isOver24h = delayLower.includes('day') || 
                       delayLower.includes('week') || 
                       delayLower.includes('24h') || 
                       delayLower.includes('48h') ||
                       delayLower.includes('72h') ||
                       (delayLower.includes('hour') && parseInt(delayLower) >= 24);

      if (isOver24h) {
        hasLongDelay = true;
        // Check what follows this delay
        const outgoing = connections.filter(c => c.sourceNodeId === delay.id);
        outgoing.forEach(conn => {
          const targetNode = nodes.find(n => n.id === conn.targetNodeId);
          if (targetNode && targetNode.type === 'message') {
            const hasTag = targetNode.content?.includes('[Tag:') || (targetNode as any).messageTag;
            const hasRN = targetNode.components?.some(c => (c as any).type === 'recurring_notification_optin');
            const hasOTN = targetNode.components?.some(c => (c as any).type === 'one_time_notification_optin');

            if (!hasTag && !hasRN && !hasOTN) {
              issues.push({
                nodeId: targetNode.id,
                nodeTitle: targetNode.title,
                severity: 'error',
                message: `This message node triggers after a delay exceeding 24 hours, but does not have a Meta Message Tag, Recurring Notification opt in, or WhatsApp Template.`,
                recommendation: 'Attach an approved Meta Message Tag (e.g. CONFIRMED_EVENT_UPDATE) for non-promo messages, or request Recurring Notification permission before the delay.',
                suggestedFix: { tag: 'CONFIRMED_EVENT_UPDATE' }
              });
            } else if (hasTag) {
              // Check for promo keywords
              const check = validateMessageTagCompliance(targetNode.content || '', 'CONFIRMED_EVENT_UPDATE');
              if (!check.compliant) {
                issues.push({
                  nodeId: targetNode.id,
                  nodeTitle: targetNode.title,
                  severity: 'error',
                  message: `Message uses a Message Tag outside 24h, but contains promotional keywords: [${check.flaggedWords.join(', ')}]. Meta strictly prohibits promotional content in Message Tags.`,
                  recommendation: 'Remove promo words or switch to Meta Recurring Notifications (Marketing Messages API) which permits promotional follow-ups.'
                });
              } else {
                issues.push({
                  nodeId: targetNode.id,
                  nodeTitle: targetNode.title,
                  severity: 'pass',
                  message: 'Compliant: Node scheduled outside 24h is protected by an approved Meta Message Tag with zero promotional copy.',
                  recommendation: 'Fully compliant with Meta Graph API policies.'
                });
              }
            }
          }
        });
      }
    });

    // Check if initial flow has permission request components
    const hasRNComponent = nodes.some(n => n.components?.some(c => (c as any).type === 'recurring_notification_optin'));
    const hasOTNComponent = nodes.some(n => n.components?.some(c => (c as any).type === 'one_time_notification_optin'));

    return {
      issues,
      hasLongDelay,
      hasRNComponent,
      hasOTNComponent,
      totalNodes: nodes.length,
      compliantScore: issues.filter(i => i.severity === 'error').length === 0 ? 100 : 70
    };
  })();

  const validationResult = validateMessageTagCompliance(testText, testTag);

  return (
    <div 
      data-modal="true"
      className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-5 overflow-y-auto"
      onClick={onClose}
    >
      <div 
        className="bg-slate-900 border border-white/10 rounded-3xl w-full max-w-4xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 sm:p-6 border-b border-white/10 flex items-center justify-between bg-slate-950/70 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-500/20 border border-blue-500/30 flex items-center justify-center text-blue-400">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg sm:text-xl font-bold text-white">Meta 24-Hour Policy & Follow-Up APIs</h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                  Graph API v19.0
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Official rules, permission requirements, and APIs for messaging customers past the standard 24-hour window
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 hover:bg-white/10 rounded-xl text-slate-400 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-2 px-4 sm:px-6 pt-3 border-b border-white/10 bg-slate-950/40 text-xs font-semibold">
          <button
            onClick={() => setActiveTab('audit')}
            className={`pb-3 px-3 flex items-center gap-2 border-b-2 transition-all cursor-pointer ${
              activeTab === 'audit'
                ? 'border-blue-500 text-blue-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Workflow className="w-4 h-4" />
            <span>Flow Compliance Audit</span>
            {auditResults.issues.filter(i => i.severity === 'error').length > 0 && (
              <span className="w-4 h-4 rounded-full bg-red-500 text-white text-[10px] flex items-center justify-center font-black">
                {auditResults.issues.filter(i => i.severity === 'error').length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('rules')}
            className={`pb-3 px-3 flex items-center gap-2 border-b-2 transition-all cursor-pointer ${
              activeTab === 'rules'
                ? 'border-blue-500 text-blue-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <FileText className="w-4 h-4" />
            <span>Meta Official Rules & APIs Guide</span>
          </button>

          <button
            onClick={() => setActiveTab('validator')}
            className={`pb-3 px-3 flex items-center gap-2 border-b-2 transition-all cursor-pointer ${
              activeTab === 'validator'
                ? 'border-blue-500 text-blue-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <ShieldAlert className="w-4 h-4" />
            <span>Policy Copy Validator</span>
          </button>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
          {activeTab === 'audit' && (
            <div className="space-y-6">
              {/* Score Card */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="p-4 rounded-2xl bg-slate-950/80 border border-white/10 flex items-center gap-3">
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center font-black text-lg ${
                    auditResults.compliantScore === 100 
                      ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' 
                      : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                  }`}>
                    {auditResults.compliantScore}%
                  </div>
                  <div>
                    <div className="text-xs text-slate-400">Compliance Health</div>
                    <div className="text-sm font-bold text-white">
                      {auditResults.compliantScore === 100 ? 'Fully Compliant' : 'Needs Optimization'}
                    </div>
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-slate-950/80 border border-white/10 flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-blue-500/20 border border-blue-500/30 flex items-center justify-center text-blue-400">
                    <Clock className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="text-xs text-slate-400">24h Delays Detected</div>
                    <div className="text-sm font-bold text-white">
                      {auditResults.hasLongDelay ? 'Yes (Follow-ups exist)' : 'None (Within 24h)'}
                    </div>
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-slate-950/80 border border-white/10 flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-cyan-500/20 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
                    <BellRing className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="text-xs text-slate-400">RN Permission Opt In</div>
                    <div className="text-sm font-bold text-white">
                      {auditResults.hasRNComponent ? 'Active in Flow' : 'Not Requested Yet'}
                    </div>
                  </div>
                </div>
              </div>

              {/* Audit Findings */}
              <div className="space-y-3">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Workflow className="w-4 h-4 text-blue-400" /> Scan Findings for Current Flow
                </h3>

                {auditResults.issues.length === 0 ? (
                  <div className="p-5 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 flex items-start gap-3">
                    <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0 mt-0.5" />
                    <div className="space-y-1 text-xs">
                      <div className="font-bold text-sm">Flow is 100% Meta Compliant!</div>
                      <p className="opacity-90">
                        All message steps execute within the 24-hour window or adhere to Meta's allowed Message Tag specifications. Your Facebook Page and Instagram accounts are protected against messaging policy strikes.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {auditResults.issues.map((issue, idx) => (
                      <div 
                        key={idx} 
                        className={`p-4 rounded-2xl border text-xs space-y-2.5 ${
                          issue.severity === 'error'
                            ? 'bg-red-500/10 border-red-500/30 text-red-300'
                            : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2 font-bold text-sm">
                            {issue.severity === 'error' ? (
                              <AlertTriangle className="w-4 h-4 text-red-400" />
                            ) : (
                              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                            )}
                            <span>{issue.nodeTitle}</span>
                          </div>
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                            issue.severity === 'error' ? 'bg-red-500/20 text-red-300 border border-red-500/30' : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                          }`}>
                            {issue.severity === 'error' ? 'Policy Risk' : 'Compliant'}
                          </span>
                        </div>

                        <p className="opacity-90">{issue.message}</p>
                        
                        <div className="p-2.5 rounded-xl bg-slate-950/60 border border-white/5 space-y-1.5">
                          <div className="font-semibold text-slate-300 flex items-center gap-1.5">
                            <Sparkles className="w-3.5 h-3.5 text-amber-400" /> Recommendation:
                          </div>
                          <p className="text-slate-400">{issue.recommendation}</p>
                          {issue.suggestedFix && onApplyFix && (
                            <button
                              onClick={() => onApplyFix(issue.nodeId, { content: `[Tag: ${issue.suggestedFix?.tag}]\n` })}
                              className="mt-1 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-medium text-xs flex items-center gap-1.5 transition-all cursor-pointer"
                            >
                              <Tag className="w-3.5 h-3.5" /> Auto-Attach {issue.suggestedFix.tag}
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Best Practice Callout */}
              <div className="p-4 rounded-2xl bg-blue-500/10 border border-blue-500/20 text-xs text-blue-200 space-y-2">
                <div className="font-bold flex items-center gap-2 text-blue-300">
                  <Info className="w-4 h-4" /> Pro Tip: How to legally send marketing follow-ups after 24 hours
                </div>
                <p>
                  Because standard Message Tags strictly ban promotional copy, use **Meta Recurring Notifications (Marketing Messages)** in Step 1 or Step 2 of your flow. When the user taps <em>"Get Updates"</em>, you obtain a recurring token valid for daily (6 months), weekly (9 months), or monthly (12 months) promotional messages!
                </p>
              </div>
            </div>
          )}

          {activeTab === 'rules' && (
            <div className="space-y-6">
              <div className="border border-white/10 rounded-2xl bg-slate-950/60 p-4 space-y-2 text-xs">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Lock className="w-4 h-4 text-amber-400" /> Summary of Meta Messaging Policies
                </h3>
                <p className="text-slate-400 leading-relaxed">
                  Meta enforces strict privacy rules across Facebook Messenger, Instagram Direct, and WhatsApp. Within 24 hours of an inbound user message, businesses can send any response. Past 24 hours, standard messages are blocked by the Graph API unless one of the approved follow-up mechanisms below is utilized.
                </p>
              </div>

              {/* Rules Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {META_MESSAGING_RULES.map((rule) => (
                  <div 
                    key={rule.id}
                    className="p-4 rounded-2xl bg-slate-950/80 border border-white/10 space-y-3 flex flex-col justify-between hover:border-white/25 transition-all"
                  >
                    <div className="space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <h4 className="font-bold text-sm text-white">{rule.name}</h4>
                          <span className="font-mono text-[10px] text-cyan-400">{rule.apiName}</span>
                        </div>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold whitespace-nowrap ${
                          rule.promotionalAllowed 
                            ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30' 
                            : 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                        }`}>
                          {rule.promotionalAllowed ? 'Promo Allowed' : 'Non-Promo Only'}
                        </span>
                      </div>
                      <p className="text-xs text-slate-300 leading-relaxed">{rule.description}</p>
                    </div>

                    <div className="pt-2 border-t border-white/5 space-y-1.5 text-[11px]">
                      <div className="flex items-center justify-between text-slate-400">
                        <span>Window:</span>
                        <span className="font-semibold text-slate-200">{rule.allowedWindow}</span>
                      </div>
                      <div className="flex items-center justify-between text-slate-400">
                        <span>Requires Opt In:</span>
                        <span className="font-semibold text-slate-200">{rule.requiresUserOptIn ? 'Yes (Explicit)' : 'No'}</span>
                      </div>
                      <div className="flex items-center justify-between text-slate-400">
                        <span>Required Permission:</span>
                        <span className="font-mono text-[10px] text-blue-400 truncate max-w-[170px]">{rule.graphPermissionRequired}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'validator' && (
            <div className="space-y-5">
              <div className="border border-white/10 rounded-2xl bg-slate-950/60 p-4 space-y-1 text-xs">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <ShieldAlert className="w-4 h-4 text-cyan-400" /> Meta Message Tag Anti-Promotion Checker
                </h3>
                <p className="text-slate-400">
                  Test your message text before sending outside the 24-hour window under a Message Tag. Meta uses automated NLP to detect promotional language and will strike Pages that abuse tags.
                </p>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">Select Intended Meta Message Tag</label>
                  <select
                    value={testTag}
                    onChange={(e) => setTestTag(e.target.value as MetaMessageTag)}
                    className="w-full bg-slate-950 border border-white/10 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-blue-500"
                  >
                    <option value="CONFIRMED_EVENT_UPDATE">CONFIRMED_EVENT_UPDATE (Webinars, Appointments, Live Events)</option>
                    <option value="POST_PURCHASE_UPDATE">POST_PURCHASE_UPDATE (Receipts, Shipments, Order Tracking)</option>
                    <option value="ACCOUNT_UPDATE">ACCOUNT_UPDATE (Account alerts, Security, Application status)</option>
                    <option value="HUMAN_AGENT">HUMAN_AGENT (7-Day Extended Support Desk)</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">Message Body Copy to Test</label>
                  <textarea
                    rows={4}
                    value={testText}
                    onChange={(e) => setTestText(e.target.value)}
                    className="w-full bg-slate-950 border border-white/10 rounded-xl p-3 text-xs text-white outline-none focus:border-blue-500 leading-relaxed"
                    placeholder="Enter copy..."
                  />
                </div>

                {/* Validation Result Box */}
                <div className={`p-4 rounded-2xl border text-xs space-y-2 ${
                  validationResult.compliant 
                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300' 
                    : 'bg-red-500/10 border-red-500/30 text-red-300'
                }`}>
                  <div className="flex items-center gap-2 font-bold text-sm">
                    {validationResult.compliant ? (
                      <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                    ) : (
                      <AlertTriangle className="w-5 h-5 text-red-400" />
                    )}
                    <span>
                      {validationResult.compliant 
                        ? 'Passed Policy Validation: Compliant for Message Tag' 
                        : 'Failed Policy Validation: Promotional Copy Detected'}
                    </span>
                  </div>

                  {!validationResult.compliant && (
                    <div className="space-y-1.5">
                      <p>{validationResult.message}</p>
                      <div className="flex flex-wrap gap-1 pt-1">
                        <span className="text-slate-400">Flagged words:</span>
                        {validationResult.flaggedWords.map((word, i) => (
                          <span key={i} className="px-2 py-0.5 rounded-md bg-red-500/30 text-red-200 font-mono text-[10px] font-bold">
                            "{word}"
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {validationResult.compliant && (
                    <p className="opacity-90">
                      No banned promotional vocabulary detected. This message copy adheres to Meta's non-promotional policy guidelines for the selected tag.
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-white/10 bg-slate-950/80 flex items-center justify-between text-xs text-slate-400 flex-shrink-0">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
            <span>Meta Graph API Compliance Engine Active</span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-white font-semibold transition-colors cursor-pointer"
          >
            Close Inspector
          </button>
        </div>
      </div>
    </div>
  );
}
