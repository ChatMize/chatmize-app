import { defineSecret } from "firebase-functions/params";
import { logger } from "firebase-functions";
import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";
import { GoogleGenerativeAI } from "@google/generative-ai";
import LlamaAPIClient from "llama-api-client";
import { spendCredits, CreditReason } from "../credits";

// ---------------------------------------------------------------------------
// Secrets (one per provider; set in Secret Manager per environment)
// ---------------------------------------------------------------------------
export const ANTHROPIC_API_KEY = defineSecret("ANTHROPIC_API_KEY");
export const OPENAI_API_KEY = defineSecret("OPENAI_API_KEY");
export const GEMINI_API_KEY = defineSecret("GEMINI_API_KEY");
export const META_API_KEY = defineSecret("META_API_KEY");
export const AI_SECRETS = [ANTHROPIC_API_KEY, OPENAI_API_KEY, GEMINI_API_KEY, META_API_KEY];

// ---------------------------------------------------------------------------
// Model catalog: the single source of truth for routing AND credit costs.
// Prices are USD per 1M tokens. Verify against provider pricing pages and
// edit here; the credit ledger prices everything off this table.
// ---------------------------------------------------------------------------
export type ModelTier = "fast" | "balanced" | "smart";
export type Provider = "google" | "anthropic" | "openai" | "meta";

export interface ModelSpec {
  id: string;
  provider: Provider;
  model: string;
  tier: ModelTier;
  inputPerMtok: number;
  outputPerMtok: number;
}

export const MODEL_CATALOG: ModelSpec[] = [
  // fast: classification, intent detection, short replies, extraction
  { id: "gemini-flash", provider: "google", model: "gemini-2.5-flash", tier: "fast", inputPerMtok: 0.3, outputPerMtok: 2.5 },
  { id: "gpt-mini", provider: "openai", model: "gpt-4o-mini", tier: "fast", inputPerMtok: 0.15, outputPerMtok: 0.6 },
  // balanced: message drafting, lead qualification, summaries
  { id: "claude-sonnet", provider: "anthropic", model: "claude-sonnet-4-5", tier: "balanced", inputPerMtok: 3.0, outputPerMtok: 15.0 },
  { id: "gpt-4o", provider: "openai", model: "gpt-4o", tier: "balanced", inputPerMtok: 2.5, outputPerMtok: 10.0 },
  { id: "gemini-pro", provider: "google", model: "gemini-2.5-pro", tier: "balanced", inputPerMtok: 1.25, outputPerMtok: 10.0 },
  // smart: Copilot flow building, complex reasoning, strategy
  { id: "claude-opus", provider: "anthropic", model: "claude-opus-4-1", tier: "smart", inputPerMtok: 15.0, outputPerMtok: 75.0 },
  { id: "gpt-5", provider: "openai", model: "gpt-5", tier: "smart", inputPerMtok: 5.0, outputPerMtok: 20.0 },
  // meta: Llama 4 on Meta's hosted API. Confirm the exact model IDs in the
  // Meta developer console; costs below are TBD until Meta's pricing is set.
  { id: "llama-scout", provider: "meta", model: "Llama-4-Scout-17B-16E-Instruct-FP8", tier: "fast", inputPerMtok: 0, outputPerMtok: 0 },
  { id: "llama-maverick", provider: "meta", model: "Llama-4-Maverick-17B-128E-Instruct-FP8", tier: "balanced", inputPerMtok: 0, outputPerMtok: 0 },
];

/** Routing chains: primary first, then fallbacks if a provider errors. */
const ROUTES: Record<ModelTier, string[]> = {
  fast: ["gemini-flash", "gpt-mini", "llama-scout"],
  balanced: ["claude-sonnet", "llama-maverick", "gpt-4o", "gemini-pro"],
  smart: ["claude-opus", "gpt-5", "gemini-pro"],
};

// ---------------------------------------------------------------------------
// Credit pricing. 1 credit = $0.001 of raw model cost (face value).
// Margin lives on the PURCHASE side, not the spend side:
//   - plan allowances are valued at 3x cost (generous, baked into the plan)
//   - à la carte top-ups sell at 4x cost
// so a plan subscriber pays 3/4 per credit: a 25% saving vs à la carte.
// The ledger records model + tokens behind every charge, keeping true
// margin auditable in a Super Admin report.
// ---------------------------------------------------------------------------
export const CREDIT_PRICING = {
  usdPerCreditFace: 0.001,
  planMargin: 3,
  alacarteMargin: 4,
} as const;

/** Retail price of a top-up pack: 4x raw cost. */
export function alacartePriceForCredits(credits: number): number {
  return credits * CREDIT_PRICING.usdPerCreditFace * CREDIT_PRICING.alacarteMargin;
}

/** Implied retail value of a plan's monthly allowance: 3x raw cost. */
export function planValueForCredits(credits: number): number {
  return credits * CREDIT_PRICING.usdPerCreditFace * CREDIT_PRICING.planMargin;
}

/** Suggested top-up packs (credits -> retail $). */
export const TOPUP_PACKS = [
  { credits: 2500, priceUsd: 10 },
  { credits: 5000, priceUsd: 20 },
  { credits: 25000, priceUsd: 100 },
] as const;

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface RouteResult {
  text: string;
  model: string;
  provider: Provider;
  tier: ModelTier;
  tokensIn: number;
  tokensOut: number;
  costUsd: number;
  creditsCharged: number;
}

interface ProviderResult {
  text: string;
  tokensIn: number;
  tokensOut: number;
}

function splitSystem(messages: ChatMessage[]): { system?: string; rest: { role: "user" | "assistant"; content: string }[] } {
  const system = messages.find((m) => m.role === "system")?.content;
  const rest = messages
    .filter((m) => m.role !== "system")
    .map((m) => ({ role: m.role as "user" | "assistant", content: m.content }));
  return { system, rest };
}

async function callGoogle(spec: ModelSpec, messages: ChatMessage[], maxOutputTokens: number): Promise<ProviderResult> {
  const client = new GoogleGenerativeAI(GEMINI_API_KEY.value());
  const { system, rest } = splitSystem(messages);
  const model = client.getGenerativeModel({ model: spec.model, systemInstruction: system });
  const history = rest.slice(0, -1).map((m) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content }],
  }));
  const last = rest[rest.length - 1];
  const chat = model.startChat({ history });
  const res = await chat.sendMessage(last.content, { generationConfig: { maxOutputTokens } } as never);
  const usage = res.response.usageMetadata;
  return {
    text: res.response.text(),
    tokensIn: usage?.promptTokenCount ?? 0,
    tokensOut: usage?.candidatesTokenCount ?? 0,
  };
}

async function callAnthropic(spec: ModelSpec, messages: ChatMessage[], maxOutputTokens: number): Promise<ProviderResult> {
  const client = new Anthropic({ apiKey: ANTHROPIC_API_KEY.value() });
  const { system, rest } = splitSystem(messages);
  const res = await client.messages.create({
    model: spec.model,
    max_tokens: maxOutputTokens,
    system,
    messages: rest,
  });
  const text = res.content
    .filter((b) => b.type === "text")
    .map((b) => (b as { text: string }).text)
    .join("");
  return { text, tokensIn: res.usage.input_tokens, tokensOut: res.usage.output_tokens };
}

async function callOpenAI(
  spec: ModelSpec,
  messages: ChatMessage[],
  maxOutputTokens: number,
): Promise<ProviderResult> {
  const client = new OpenAI({ apiKey: OPENAI_API_KEY.value() });
  const res = await client.chat.completions.create({
    model: spec.model,
    max_tokens: maxOutputTokens,
    messages: messages.map((m) => ({ role: m.role, content: m.content })),
  });
  return {
    text: res.choices[0]?.message?.content ?? "",
    tokensIn: res.usage?.prompt_tokens ?? 0,
    tokensOut: res.usage?.completion_tokens ?? 0,
  };
}

/**
 * Meta's hosted Llama API via the official client. Token usage comes back
 * in the response `metrics` array; names are matched defensively since Meta
 * does not publish stable metric keys in the SDK types.
 */
async function callMeta(
  spec: ModelSpec,
  messages: ChatMessage[],
  maxOutputTokens: number,
): Promise<ProviderResult> {
  const client = new LlamaAPIClient({ apiKey: META_API_KEY.value() });
  const res = await client.chat.completions.create({
    model: spec.model,
    max_completion_tokens: maxOutputTokens,
    messages: messages.map((m) => ({ role: m.role, content: m.content })),
  });
  const content = res.completion_message.content;
  const text = typeof content === "string" ? content : (content?.text ?? "");
  let tokensIn = 0;
  let tokensOut = 0;
  for (const m of res.metrics ?? []) {
    const name = m.metric.toLowerCase();
    if (/prompt|input/.test(name)) tokensIn = m.value;
    else if (/completion|output|generated/.test(name)) tokensOut = m.value;
  }
  if (tokensIn === 0 && tokensOut === 0) {
    logger.warn("callMeta: no token metrics returned, metering as zero", { model: spec.model });
  }
  return { text, tokensIn, tokensOut };
}

async function callProvider(
  spec: ModelSpec,
  messages: ChatMessage[],
  maxOutputTokens: number,
): Promise<ProviderResult> {
  switch (spec.provider) {
    case "google":
      return callGoogle(spec, messages, maxOutputTokens);
    case "anthropic":
      return callAnthropic(spec, messages, maxOutputTokens);
    case "openai":
      return callOpenAI(spec, messages, maxOutputTokens);
    case "meta":
      return callMeta(spec, messages, maxOutputTokens);
  }
}

export interface CompleteOptions {
  workspaceId: string;
  tier: ModelTier;
  messages: ChatMessage[];
  /** What the credits are spent on (copilot_session, ai_reply, ai_content). */
  reason: Extract<CreditReason, "copilot_session" | "ai_reply" | "ai_content">;
  maxOutputTokens?: number;
  note?: string;
  /** When true, runs the model call but skips the ledger charge (key tests, cost previews). */
  dryRun?: boolean;
}

/**
 * Route a completion to the cheapest capable model for the tier, with
 * automatic fallback across providers. Meters the real token cost through
 * the workspace's credit ledger at (cost x margin).
 */
export async function aiComplete(opts: CompleteOptions): Promise<RouteResult> {
  const chain = ROUTES[opts.tier]
    .map((id) => MODEL_CATALOG.find((m) => m.id === id))
    .filter((m): m is ModelSpec => !!m);
  if (chain.length === 0) throw new Error(`no models configured for tier ${opts.tier}`);

  const maxOutputTokens = opts.maxOutputTokens ?? 1024;
  let lastError: unknown = null;

  for (const spec of chain) {
    try {
      const out = await callProvider(spec, opts.messages, maxOutputTokens);
      const costUsd =
        (out.tokensIn / 1_000_000) * spec.inputPerMtok +
        (out.tokensOut / 1_000_000) * spec.outputPerMtok;
      // Spend at face value; margin was captured when the credits were
      // purchased (3x in-plan, 4x à la carte).
      const creditsCharged = Math.max(
        1,
        Math.ceil(costUsd / CREDIT_PRICING.usdPerCreditFace),
      );
      const ledgerNote = [opts.note, `${spec.provider}/${spec.model}`, `${out.tokensIn}in/${out.tokensOut}out`]
        .filter(Boolean)
        .join(" | ");
      if (!opts.dryRun) {
        await spendCredits(opts.workspaceId, creditsCharged, opts.reason, ledgerNote);
      }
      logger.info("aiComplete routed", {
        workspaceId: opts.workspaceId,
        tier: opts.tier,
        model: spec.model,
        tokensIn: out.tokensIn,
        tokensOut: out.tokensOut,
        costUsd: Number(costUsd.toFixed(6)),
        creditsCharged,
        dryRun: opts.dryRun ?? false,
      });
      return {
        text: out.text,
        model: spec.model,
        provider: spec.provider,
        tier: opts.tier,
        tokensIn: out.tokensIn,
        tokensOut: out.tokensOut,
        costUsd,
        creditsCharged,
      };
    } catch (e) {
      lastError = e;
      logger.warn("aiComplete provider failed, trying fallback", {
        tier: opts.tier,
        model: spec.model,
        error: e instanceof Error ? e.message : String(e),
      });
    }
  }
  throw new Error(
    `all providers failed for tier ${opts.tier}: ${lastError instanceof Error ? lastError.message : String(lastError)}`,
  );
}
