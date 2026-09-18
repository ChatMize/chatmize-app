/**
 * Client-side BotMaps flow runner.
 *
 * Executes a published BotMap (nodes + connections) for webchat visitors and
 * the in-app widget simulator. Shared by src/components/growth/SupportChatView
 * and the standalone visitor widget (src/widget/widget.ts), so the preview
 * and the live widget behave identically.
 *
 * Quick replies route into the real flow: a tapped chip follows the matching
 * button connection (btn-N handle); typed text matches trigger keywords,
 * pending button labels, or condition rules. There are no canned demo
 * replies — when nothing in the flow matches, the turn hands off to an agent.
 *
 * AI nodes cannot execute client-side (no member-accessible AI callable
 * exists); they set aiDeferred so the backend worker can pick them up, and
 * the visitor gets an honest handoff message instead of a fake AI reply.
 */

export interface RunnerFlowNode {
  id: string;
  type: 'trigger' | 'action' | 'message' | 'ai' | 'delay' | 'condition';
  title?: string;
  content?: string;
  buttons?: string[];
  quickReplies?: string[];
  triggerKeywords?: string[];
  conditionText?: string;
  delayText?: string;
  actionTags?: string[];
}

export interface RunnerFlowConnection {
  sourceNodeId: string;
  sourceHandleId?: string;
  targetNodeId: string;
}

export interface BotQuickReply {
  label: string;
  payload: string;
}

export interface BotTurnResult {
  /** Bot messages to display, in order. */
  texts: string[];
  /** Quick-reply chips to show after the texts. */
  quickReplies: BotQuickReply[];
  /** True when the flow ended, hit an AI step, or had no matching route. */
  handoffToAgent: boolean;
  /** True when an AI node was reached (backend worker owns AI execution). */
  aiDeferred: boolean;
  /** Action tags applied during this turn. */
  tags: string[];
  /** True when the walk reached a node with no outgoing connection. */
  endOfFlow: boolean;
}

const MAX_STEPS_PER_TURN = 25;

function normalize(s: string): string {
  return (s || '')
    .toLowerCase()
    .replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{FE0F}]/gu, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function toPayload(label: string): string {
  return (label || '')
    .replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{FE0F}]/gu, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

export function buttonPayload(label: string): string {
  return toPayload(label);
}

const AI_HANDOFF_TEXT =
  'Let me bring in a teammate who can help with that right away. If you leave your email, we will follow up with full details.';

export class SupportBotSession {
  private nodes: Map<string, RunnerFlowNode>;
  private connections: RunnerFlowConnection[];
  private currentNodeId: string | null = null;
  private pendingReplies: BotQuickReply[] = [];
  private pendingHandles: string[] = [];
  private lastUserText = '';
  private started = false;

  constructor(nodes: RunnerFlowNode[], connections: RunnerFlowConnection[]) {
    this.nodes = new Map((nodes || []).map((n) => [n.id, n]));
    this.connections = connections || [];
  }

  hasFlow(): boolean {
    return this.nodes.size > 0;
  }

  getPendingReplies(): BotQuickReply[] {
    return this.pendingReplies;
  }

  /** Run the flow from its trigger node (first visitor message / widget open). */
  start(): BotTurnResult {
    const trigger = [...this.nodes.values()].find((n) => n.type === 'trigger');
    if (!trigger) {
      return this.handoff('Thanks for reaching out! A teammate will reply here shortly.');
    }
    this.started = true;
    return this.walk(trigger.id, 'output', new Set());
  }

  /** Route a typed visitor message through the flow. */
  handleText(text: string): BotTurnResult {
    this.lastUserText = text || '';
    const norm = normalize(text);

    // 1. Pending button match (visitor answered the last question).
    const pendingIdx = this.pendingReplies.findIndex(
      (r) => normalize(r.label) === norm || normalize(r.payload) === norm || toPayload(r.label) === toPayload(text)
    );
    if (pendingIdx >= 0 && this.currentNodeId) {
      const handle = this.pendingHandles[pendingIdx] || `btn-${pendingIdx}`;
      this.pendingReplies = [];
      this.pendingHandles = [];
      return this.walk(this.currentNodeId, handle, new Set());
    }

    // 2. Trigger keyword match anywhere in the flow.
    for (const node of this.nodes.values()) {
      if (node.type !== 'trigger' || !node.triggerKeywords?.length) continue;
      if (node.triggerKeywords.some((k) => norm.includes(normalize(k)))) {
        return this.walk(node.id, 'output', new Set());
      }
    }

    // 3. Deep link: any message node's button label matches the text.
    for (const node of this.nodes.values()) {
      const buttons = node.buttons || [];
      const idx = buttons.findIndex((b) => normalize(b) === norm);
      if (idx >= 0) {
        const target = this.follow(node.id, `btn-${idx}`);
        if (target) return this.walk(target, 'output', new Set());
      }
    }

    // 4. If we are mid-flow at a node awaiting free text, continue its output.
    if (this.started && this.currentNodeId && this.pendingReplies.length === 0) {
      const target = this.follow(this.currentNodeId, 'output');
      if (target) return this.walk(target, 'output', new Set());
    }

    // 5. Nothing matched: honest handoff, never a fake canned reply.
    return this.handoff(AI_HANDOFF_TEXT);
  }

  /** Route a quick-reply chip tap (payload from the widget config or flow). */
  handlePayload(payload: string, label?: string): BotTurnResult {
    const normPayload = toPayload(payload || '');
    const normLabel = normalize(label || '');

    // 1. Match against pending replies first.
    if (this.currentNodeId && this.pendingReplies.length > 0) {
      const idx = this.pendingReplies.findIndex(
        (r) => toPayload(r.payload) === normPayload || toPayload(r.label) === normPayload || normalize(r.label) === normLabel
      );
      if (idx >= 0) {
        const handle = this.pendingHandles[idx] || `btn-${idx}`;
        this.pendingReplies = [];
        this.pendingHandles = [];
        return this.walk(this.currentNodeId, handle, new Set());
      }
    }

    // 2. Deep link: find any flow button whose payload matches.
    for (const node of this.nodes.values()) {
      const buttons = node.buttons || node.quickReplies || [];
      const idx = buttons.findIndex((b) => toPayload(b) === normPayload);
      if (idx >= 0) {
        const target = this.follow(node.id, `btn-${idx}`);
        if (target) return this.walk(target, 'output', new Set());
      }
    }

    // 3. Match by label text as a last resort.
    if (normLabel) return this.handleText(label || '');

    return this.handoff(AI_HANDOFF_TEXT);
  }

  private follow(sourceNodeId: string, handleId: string): string | null {
    const conn =
      this.connections.find((c) => c.sourceNodeId === sourceNodeId && (c.sourceHandleId || 'output') === handleId) ||
      (handleId !== 'output'
        ? this.connections.find((c) => c.sourceNodeId === sourceNodeId && (c.sourceHandleId || 'output') === 'output')
        : undefined);
    return conn ? conn.targetNodeId : null;
  }

  private handoff(text: string): BotTurnResult {
    return {
      texts: [text],
      quickReplies: [],
      handoffToAgent: true,
      aiDeferred: false,
      tags: [],
      endOfFlow: true,
    };
  }

  private walk(startNodeId: string, handleId: string, visited: Set<string>): BotTurnResult {
    const result: BotTurnResult = {
      texts: [],
      quickReplies: [],
      handoffToAgent: false,
      aiDeferred: false,
      tags: [],
      endOfFlow: false,
    };

    let nextId: string | null = this.follow(startNodeId, handleId);
    if (!nextId) {
      // startNodeId itself may be the entry (e.g. start() on trigger with no
      // output yet, or a deep-linked node).
      nextId = this.nodes.has(startNodeId) && handleId === 'output' ? startNodeId : nextId;
    }

    let steps = 0;
    while (nextId && steps < MAX_STEPS_PER_TURN) {
      steps += 1;
      if (visited.has(nextId)) break;
      visited.add(nextId);

      const node = this.nodes.get(nextId);
      if (!node) break;
      this.currentNodeId = node.id;

      if (node.type === 'message') {
        if (node.content) result.texts.push(node.content);
        const buttons = node.buttons || node.quickReplies || [];
        if (buttons.length > 0) {
          // Buttons wait for the visitor — pause the walk here.
          this.pendingReplies = buttons.map((b) => ({ label: b, payload: toPayload(b) }));
          this.pendingHandles = buttons.map((_, i) => `btn-${i}`);
          result.quickReplies = this.pendingReplies;
          return result;
        }
        nextId = this.follow(node.id, 'output');
        if (!nextId) {
          result.endOfFlow = true;
          break;
        }
        continue;
      }

      if (node.type === 'ai') {
        // No client-side AI execution path exists; the backend worker owns
        // AI steps. Hand off honestly instead of faking a reply.
        result.aiDeferred = true;
        result.handoffToAgent = true;
        result.texts.push(AI_HANDOFF_TEXT);
        result.endOfFlow = true;
        break;
      }

      if (node.type === 'delay') {
        if (node.delayText || node.content) result.texts.push(node.delayText || node.content || '');
        nextId = this.follow(node.id, 'output');
        if (!nextId) {
          result.endOfFlow = true;
          break;
        }
        continue;
      }

      if (node.type === 'action') {
        const tags = node.actionTags || [];
        result.tags.push(...tags);
        nextId = this.follow(node.id, 'output');
        if (!nextId) {
          result.endOfFlow = true;
          break;
        }
        continue;
      }

      if (node.type === 'condition') {
        const decision = this.evaluateCondition(node.conditionText || '');
        const buttons = node.buttons?.length ? node.buttons : ['Yes', 'No'];
        if (decision === 'undecided') {
          // Let the visitor decide — real routing, not a guess.
          this.pendingReplies = buttons.map((b) => ({ label: b, payload: toPayload(b) }));
          this.pendingHandles = buttons.map((_, i) => `btn-${i}`);
          result.quickReplies = this.pendingReplies;
          if (node.conditionText) result.texts.push(node.conditionText);
          return result;
        }
        nextId = this.follow(node.id, decision === 'match' ? 'btn-0' : 'btn-1');
        if (!nextId) {
          result.endOfFlow = true;
          break;
        }
        continue;
      }

      // trigger node (mid-walk): follow output.
      nextId = this.follow(node.id, 'output');
      if (!nextId) {
        result.endOfFlow = true;
        break;
      }
    }

    if (result.texts.length === 0 && result.quickReplies.length === 0) {
      result.handoffToAgent = true;
      result.endOfFlow = true;
    }
    return result;
  }

  private evaluateCondition(conditionText: string): 'match' | 'no-match' | 'undecided' {
    const text = (conditionText || '').toLowerCase();
    const user = normalize(this.lastUserText);
    // Quoted phrases in the condition are treated as keywords.
    const quoted = [...text.matchAll(/"([^"]+)"/g)].map((m) => normalize(m[1])).filter(Boolean);
    if (quoted.length > 0 && user) {
      return quoted.some((q) => user.includes(q)) ? 'match' : 'no-match';
    }
    const m = text.match(/contains\s+([a-z0-9 ]+)/);
    if (m && user) {
      return user.includes(normalize(m[1])) ? 'match' : 'no-match';
    }
    // Tag-based conditions ("Contact has tag X") cannot be evaluated
    // client-side — ask the visitor instead of guessing.
    return 'undecided';
  }
}

/** Convenience: build a session from a FlowBuilder-style bot map object. */
export function createSessionFromBotMap(botMap: {
  nodes?: Array<Record<string, unknown>>;
  connections?: Array<Record<string, unknown>>;
} | null): SupportBotSession | null {
  if (!botMap || !Array.isArray(botMap.nodes) || botMap.nodes.length === 0) return null;
  const nodes: RunnerFlowNode[] = botMap.nodes.map((n) => ({
    id: String(n.id),
    type: n.type as RunnerFlowNode['type'],
    title: n.title as string | undefined,
    content: n.content as string | undefined,
    buttons: n.buttons as string[] | undefined,
    quickReplies: n.quickReplies as string[] | undefined,
    triggerKeywords: n.triggerKeywords as string[] | undefined,
    conditionText: n.conditionText as string | undefined,
    delayText: n.delayText as string | undefined,
    actionTags: n.actionTags as string[] | undefined,
  }));
  const connections: RunnerFlowConnection[] = (botMap.connections || []).map((c) => ({
    sourceNodeId: String(c.sourceNodeId),
    sourceHandleId: (c.sourceHandleId as string) || 'output',
    targetNodeId: String(c.targetNodeId),
  }));
  return new SupportBotSession(nodes, connections);
}
