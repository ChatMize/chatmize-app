/**
 * ChatMize Survey Builder (backend).
 *
 * Folded into EXISTING Cloud Functions (proxy blocks new function creation):
 * - Admin actions ride the `metaOAuthStatus` callable via `action` params
 *   (same fold-in pattern as contests and overlays). Auth + workspace
 *   membership are enforced by the host before this router runs.
 * - The public (unauthenticated) API rides the `metaWebhook` onRequest
 *   function at path /survey-api (hosting rewrite -> metaWebhook).
 *
 * Collections (top-level, every doc carries workspaceId):
 *   surveys/{surveyId}                   config + counters
 *   survey_responses/{responseId}        one doc per completed survey
 *   survey_rate_limits/{key}             submit rate-limit counters
 *
 * Answer capture: each question names a contact variable. When the taker
 * gives an email or phone, we upsert a deterministic web contact and save
 * every answer into its variables/customFields maps via
 * saveVariableToContact (the same maps the {{tag}} resolver reads), so
 * BotMaps flows can personalize on survey answers. Reserved contact field
 * names are rejected at save time by assertVariableNameAllowed.
 *
 * No-dash rule: all user-facing copy avoids em dashes and hyphenated
 * compounds.
 */
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { HttpsError } from "firebase-functions/v2/https";
import { logger } from "firebase-functions";
import { createHash } from "crypto";
import {
  sanitizeVariableName,
  assertVariableNameAllowed,
} from "./flowVariables.js";
import { saveVariableToContact } from "./flowVariables.js";

const db = () => getFirestore("chatmize-prod");

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type SurveyQuestionType =
  | "multiple_choice"
  | "checkboxes"
  | "rating"
  | "nps"
  | "short_text"
  | "long_text"
  | "date"
  | "dropdown";

export type SurveyStatus = "draft" | "active" | "closed";

export interface SurveyQuestion {
  id: string;
  type: SurveyQuestionType;
  label: string;
  description?: string;
  required: boolean;
  options?: string[];
  variableName: string;
  scaleMax?: number;
}

export interface Survey {
  id: string;
  workspaceId: string;
  title: string;
  description?: string;
  status: SurveyStatus;
  questions: SurveyQuestion[];
  collectEmail: boolean;
  collectPhone: boolean;
  thankYouMessage: string;
  counters: { views: number; responses: number };
  createdAt: string;
  updatedAt: string;
}

export interface SurveyAnswer {
  questionId: string;
  type: SurveyQuestionType;
  variableName: string;
  value: string | string[];
}

const QUESTION_TYPES: SurveyQuestionType[] = [
  "multiple_choice",
  "checkboxes",
  "rating",
  "nps",
  "short_text",
  "long_text",
  "date",
  "dropdown",
];

const CHOICE_TYPES: SurveyQuestionType[] = [
  "multiple_choice",
  "checkboxes",
  "dropdown",
];

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

function cleanId(raw: unknown): string {
  return String(raw ?? "")
    .trim()
    .replace(/[^A-Za-z0-9_-]/g, "")
    .slice(0, 64);
}

function validateQuestions(input: unknown): SurveyQuestion[] {
  if (!Array.isArray(input)) throw new HttpsError("invalid-argument", "questions must be a list.");
  if (input.length > 50) throw new HttpsError("invalid-argument", "A survey can hold at most 50 questions.");
  const seenVars = new Set<string>();
  return input.map((rawQ, i) => {
    const q = (rawQ ?? {}) as Record<string, unknown>;
    const type = q.type as SurveyQuestionType;
    if (!QUESTION_TYPES.includes(type)) {
      throw new HttpsError("invalid-argument", `Question ${i + 1} has an unknown type.`);
    }
    const label = String(q.label ?? "").trim().slice(0, 300);
    if (!label) throw new HttpsError("invalid-argument", `Question ${i + 1} needs a label.`);
    let options: string[] | undefined;
    if (CHOICE_TYPES.includes(type)) {
      const raw = Array.isArray(q.options) ? q.options : [];
      options = raw
        .map((o) => String(o ?? "").trim().slice(0, 120))
        .filter(Boolean)
        .slice(0, 30);
      if (options.length < 2) {
        throw new HttpsError("invalid-argument", `Question "${label}" needs at least 2 options.`);
      }
    }
    let variableName: string;
    try {
      variableName = assertVariableNameAllowed(String(q.variableName ?? ""));
    } catch (e) {
      throw new HttpsError("invalid-argument", `Question "${label}": ${(e as Error).message}`);
    }
    if (seenVars.has(variableName)) {
      throw new HttpsError(
        "invalid-argument",
        `Question "${label}": the variable name "${variableName}" is already used by another question.`,
      );
    }
    seenVars.add(variableName);
    const scaleMax =
      type === "rating"
        ? Math.min(10, Math.max(2, Math.floor(Number(q.scaleMax) || 5)))
        : undefined;
    return {
      id: cleanId(q.id) || `q_${i}`,
      type,
      label,
      description: String(q.description ?? "").trim().slice(0, 500) || undefined,
      required: q.required === true,
      options,
      variableName,
      scaleMax,
    };
  });
}

function validateSurveyInput(workspaceId: string, input: Record<string, unknown>, surveyId: string): Survey {
  const title = String(input.title ?? "").trim().slice(0, 120) || "Untitled survey";
  const status = input.status as SurveyStatus;
  if (status && !["draft", "active", "closed"].includes(status)) {
    throw new HttpsError("invalid-argument", "status must be draft, active, or closed.");
  }
  const now = new Date().toISOString();
  return {
    id: surveyId,
    workspaceId,
    title,
    description: String(input.description ?? "").trim().slice(0, 1000) || undefined,
    status: status || "draft",
    questions: validateQuestions(input.questions),
    collectEmail: input.collectEmail !== false,
    collectPhone: input.collectPhone === true,
    thankYouMessage: String(input.thankYouMessage ?? "").trim().slice(0, 500) || "Thanks for sharing your answers!",
    counters: { views: 0, responses: 0 },
    createdAt: now,
    updatedAt: now,
  };
}

/** Public shape: strip internals before sending to anonymous takers. */
function sanitizeSurveyPublic(survey: Survey): Record<string, unknown> {
  return {
    id: survey.id,
    title: survey.title,
    description: survey.description ?? "",
    status: survey.status,
    questions: survey.questions.map((q) => ({
      id: q.id,
      type: q.type,
      label: q.label,
      description: q.description ?? "",
      required: q.required,
      options: q.options ?? [],
      scaleMax: q.scaleMax ?? 5,
    })),
    collectEmail: survey.collectEmail,
    collectPhone: survey.collectPhone,
    thankYouMessage: survey.thankYouMessage,
  };
}

async function getSurveyOrThrow(surveyId: string): Promise<{ id: string; data: Survey }> {
  const snap = await db().collection("surveys").doc(surveyId).get();
  if (!snap.exists) throw new HttpsError("not-found", "Survey not found.");
  return { id: snap.id, data: snap.data() as Survey };
}

function clientIpHash(req: { ip?: string; headers: Record<string, string | string[] | undefined> }): string {
  const raw =
    req.ip ||
    (Array.isArray(req.headers["x-forwarded-for"])
      ? req.headers["x-forwarded-for"][0]
      : req.headers["x-forwarded-for"]) ||
    "unknown";
  return createHash("sha256").update(String(raw)).digest("hex").slice(0, 24);
}

async function checkSubmitRateLimit(surveyId: string, ipHash: string): Promise<void> {
  const key = `${surveyId}_${ipHash}`;
  const ref = db().collection("survey_rate_limits").doc(key);
  const now = Date.now();
  const windowMs = 60 * 60 * 1000;
  const maxPerWindow = 20;
  await db().runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const cur = snap.exists ? (snap.data() as { count?: number; windowStart?: number }) : {};
    const start = cur.windowStart ?? now;
    if (now - start > windowMs) {
      tx.set(ref, { count: 1, windowStart: now });
      return;
    }
    const count = (cur.count ?? 0) + 1;
    if (count > maxPerWindow) {
      throw new HttpsError("resource-exhausted", "Too many submissions. Please try again later.");
    }
    tx.set(ref, { count, windowStart: start }, { merge: true });
  });
}

function normalizeEmail(raw: string): string {
  return raw.trim().toLowerCase();
}

function isValidEmail(em: string): boolean {
  return /^\S+@\S+\.\S+$/.test(em);
}

/** Deterministic web contact per identity so repeat takers update one record. */
function webContactId(identity: string): string {
  const hash = createHash("sha256").update(identity).digest("hex").slice(0, 24);
  return `contact_web_${hash}`;
}

function normalizeAnswerValue(type: SurveyQuestionType, raw: unknown): string | string[] | null {
  if (type === "checkboxes") {
    const arr = Array.isArray(raw) ? raw : raw == null ? [] : [raw];
    const vals = arr.map((v) => String(v ?? "").trim().slice(0, 500)).filter(Boolean);
    return vals;
  }
  const v = String(raw ?? "").trim().slice(0, 2000);
  if (type === "rating" || type === "nps") {
    const n = Number(v);
    if (!Number.isFinite(n)) return null;
    return String(Math.round(n));
  }
  if (type === "date") {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return null;
    return v;
  }
  return v;
}

// ---------------------------------------------------------------------------
// Admin actions (via metaOAuthStatus callable)
// ---------------------------------------------------------------------------

export async function handleSurveyAdminAction(
  action: string,
  data: Record<string, unknown>,
  uid: string,
): Promise<unknown> {
  const workspaceId = data.workspaceId as string | undefined;
  if (!workspaceId) throw new HttpsError("invalid-argument", "workspaceId is required.");

  switch (action) {
    case "surveyList": {
      const snap = await db()
        .collection("surveys")
        .where("workspaceId", "==", workspaceId)
        .orderBy("updatedAt", "desc")
        .limit(100)
        .get();
      return {
        surveys: snap.docs.map((d) => {
          const data = d.data() as Survey;
          return { ...data, id: d.id };
        }),
      };
    }

    case "surveySave": {
      const input = (data.survey ?? {}) as Record<string, unknown>;
      const surveyId = cleanId(input.id) || `survey_${createHash("sha256").update(`${workspaceId}${uid}${Date.now()}`).digest("hex").slice(0, 12)}`;
      const survey = validateSurveyInput(workspaceId, input, surveyId);
      const ref = db().collection("surveys").doc(surveyId);
      const existing = await ref.get();
      if (existing.exists) {
        const prev = existing.data() as Survey;
        if (prev.workspaceId !== workspaceId) {
          throw new HttpsError("permission-denied", "That survey belongs to another workspace.");
        }
        survey.counters = prev.counters ?? { views: 0, responses: 0 };
        survey.createdAt = prev.createdAt;
      }
      await ref.set({ ...survey, updatedAt: new Date().toISOString() });
      return { survey: { ...survey, id: surveyId } };
    }

    case "surveyDelete": {
      const surveyId = cleanId(data.surveyId);
      if (!surveyId) throw new HttpsError("invalid-argument", "surveyId is required.");
      const { data: survey } = await getSurveyOrThrow(surveyId);
      if (survey.workspaceId !== workspaceId) {
        throw new HttpsError("permission-denied", "That survey belongs to another workspace.");
      }
      // Delete responses in small batches (surveys are low volume).
      const respSnap = await db()
        .collection("survey_responses")
        .where("surveyId", "==", surveyId)
        .limit(200)
        .get();
      const batch = db().batch();
      respSnap.docs.forEach((d) => batch.delete(d.ref));
      batch.delete(db().collection("surveys").doc(surveyId));
      await batch.commit();
      return { ok: true, deletedResponses: respSnap.size };
    }

    case "surveySetStatus": {
      const surveyId = cleanId(data.surveyId);
      const status = data.status as SurveyStatus;
      if (!surveyId) throw new HttpsError("invalid-argument", "surveyId is required.");
      if (!["draft", "active", "closed"].includes(status)) {
        throw new HttpsError("invalid-argument", "status must be draft, active, or closed.");
      }
      const { data: survey } = await getSurveyOrThrow(surveyId);
      if (survey.workspaceId !== workspaceId) {
        throw new HttpsError("permission-denied", "That survey belongs to another workspace.");
      }
      await db().collection("surveys").doc(surveyId).update({
        status,
        updatedAt: new Date().toISOString(),
      });
      return { ok: true, status };
    }

    case "surveyResults": {
      const surveyId = cleanId(data.surveyId);
      if (!surveyId) throw new HttpsError("invalid-argument", "surveyId is required.");
      const { data: survey } = await getSurveyOrThrow(surveyId);
      if (survey.workspaceId !== workspaceId) {
        throw new HttpsError("permission-denied", "That survey belongs to another workspace.");
      }
      const respSnap = await db()
        .collection("survey_responses")
        .where("workspaceId", "==", workspaceId)
        .where("surveyId", "==", surveyId)
        .orderBy("completedAt", "desc")
        .limit(500)
        .get();
      const responses: Array<Record<string, unknown>> = respSnap.docs.map((d) => ({ ...(d.data() as Record<string, unknown>), id: d.id }));
      const aggregates = survey.questions.map((q) => {
        const agg: Record<string, unknown> = {
          questionId: q.id,
          label: q.label,
          type: q.type,
          responseCount: 0,
        };
        let count = 0;
        if (["multiple_choice", "checkboxes", "dropdown"].includes(q.type)) {
          const optionCounts: Record<string, number> = {};
          (q.options ?? []).forEach((o) => (optionCounts[o] = 0));
          responses.forEach((r) => {
            const ans = (r.answers as SurveyAnswer[] | undefined)?.find((a) => a.questionId === q.id);
            if (!ans) return;
            const vals = Array.isArray(ans.value) ? ans.value : [ans.value];
            vals.forEach((v) => {
              if (v && v in optionCounts) {
                optionCounts[v] += 1;
                count += 1;
              }
            });
          });
          agg.optionCounts = optionCounts;
        } else if (q.type === "rating" || q.type === "nps") {
          let sum = 0;
          let n = 0;
          responses.forEach((r) => {
            const ans = (r.answers as SurveyAnswer[] | undefined)?.find((a) => a.questionId === q.id);
            if (!ans) return;
            const num = Number(ans.value);
            if (Number.isFinite(num)) {
              sum += num;
              n += 1;
            }
          });
          count = n;
          if (n > 0) agg.average = Math.round((sum / n) * 10) / 10;
        } else {
          const samples: string[] = [];
          responses.forEach((r) => {
            const ans = (r.answers as SurveyAnswer[] | undefined)?.find((a) => a.questionId === q.id);
            if (!ans || samples.length >= 10) return;
            const v = String(ans.value ?? "").trim();
            if (v) {
              samples.push(v.slice(0, 300));
              count += 1;
            }
          });
          agg.samples = samples;
        }
        agg.responseCount = count;
        return agg;
      });
      return { survey: { ...survey, id: surveyId }, totalResponses: responses.length, aggregates, responses };
    }

    default:
      throw new HttpsError("invalid-argument", `Unknown survey action: ${action}`);
  }
}

// ---------------------------------------------------------------------------
// Public API (via metaWebhook at /survey-api)
// ---------------------------------------------------------------------------

export async function handleSurveyPublicRequest(
  req: { body?: unknown; ip?: string; headers: Record<string, string | string[] | undefined> },
  res: { status: (code: number) => { json: (body: unknown) => void } },
): Promise<void> {
  const send = (code: number, body: unknown) => res.status(code).json(body);
  try {
    const body = (req.body ?? {}) as Record<string, unknown>;
    const action = body.action as string | undefined;
    const surveyId = cleanId(body.surveyId);

    if (action === "get") {
      if (!surveyId) return send(400, { error: "surveyId is required" });
      const { data: survey } = await getSurveyOrThrow(surveyId);
      if (survey.status !== "active") {
        return send(200, { survey: null, reason: survey.status });
      }
      await db()
        .collection("surveys")
        .doc(surveyId)
        .update({ "counters.views": FieldValue.increment(1) })
        .catch(() => {});
      return send(200, { survey: sanitizeSurveyPublic(survey) });
    }

    if (action === "submit") {
      if (!surveyId) return send(400, { error: "surveyId is required" });
      const { data: survey } = await getSurveyOrThrow(surveyId);
      if (survey.status !== "active") {
        return send(400, { error: "This survey is not accepting answers right now." });
      }
      await checkSubmitRateLimit(surveyId, clientIpHash(req));

      const rawAnswers = (body.answers ?? {}) as Record<string, unknown>;
      const email = normalizeEmail(String(body.email ?? ""));
      const phone = String(body.phone ?? "").trim().slice(0, 40);
      if (survey.collectEmail && !email) {
        return send(400, { error: "Email is required to finish this survey." });
      }
      if (email && !isValidEmail(email)) return send(400, { error: "That email does not look valid." });
      if (survey.collectPhone && !phone) {
        return send(400, { error: "Phone is required to finish this survey." });
      }

      const answers: SurveyAnswer[] = [];
      for (const q of survey.questions) {
        const norm = normalizeAnswerValue(q.type, rawAnswers[q.id]);
        const empty =
          norm === null || (Array.isArray(norm) ? norm.length === 0 : !String(norm).trim());
        if (empty) {
          if (q.required) {
            return send(400, { error: `Please answer: ${q.label}` });
          }
          continue;
        }
        if (["multiple_choice", "dropdown"].includes(q.type) && !q.options!.includes(String(norm))) {
          return send(400, { error: `Invalid choice for: ${q.label}` });
        }
        if (q.type === "checkboxes") {
          const bad = (norm as string[]).filter((v) => !q.options!.includes(v));
          if (bad.length > 0) return send(400, { error: `Invalid choice for: ${q.label}` });
        }
        if (q.type === "rating") {
          const n = Number(norm);
          const max = q.scaleMax ?? 5;
          if (n < 1 || n > max) return send(400, { error: `Invalid rating for: ${q.label}` });
        }
        if (q.type === "nps") {
          const n = Number(norm);
          if (n < 0 || n > 10) return send(400, { error: `Invalid score for: ${q.label}` });
        }
        answers.push({
          questionId: q.id,
          type: q.type,
          variableName: sanitizeVariableName(q.variableName),
          value: norm as string | string[],
        });
      }

      // Upsert a deterministic web contact so answers attach to someone.
      let contactId: string | undefined;
      if (email || phone) {
        const identity = email || phone;
        contactId = webContactId(`${survey.workspaceId}:${identity}`);
        await db()
          .collection("contacts")
          .doc(contactId)
          .set(
            {
              id: contactId,
              workspaceId: survey.workspaceId,
              name: email ? email.split("@")[0] : phone,
              channel: "web",
              email: email || null,
              phone: phone || null,
              lastInteractionAt: FieldValue.serverTimestamp(),
              updatedAt: FieldValue.serverTimestamp(),
            },
            { merge: true },
          );
        // Save each answer into the contact's variable maps.
        for (const a of answers) {
          const v = Array.isArray(a.value) ? a.value.join(", ") : a.value;
          try {
            await saveVariableToContact(contactId, a.variableName, v);
          } catch (e) {
            logger.warn("Survey answer variable save failed", {
              surveyId,
              variable: a.variableName,
              error: (e as Error).message,
            });
          }
        }
      }

      const responseId = `sr_${createHash("sha256").update(`${surveyId}${Date.now()}${Math.random()}`).digest("hex").slice(0, 16)}`;
      await db()
        .collection("survey_responses")
        .doc(responseId)
        .set({
          id: responseId,
          eventType: "survey_completed",
          workspaceId: survey.workspaceId,
          surveyId,
          surveyName: survey.title || null,
          contactId: contactId ?? null,
          email: email || null,
          phone: phone || null,
          answers,
          completedAt: new Date().toISOString(),
        });
      await db()
        .collection("surveys")
        .doc(surveyId)
        .update({ "counters.responses": FieldValue.increment(1) })
        .catch(() => {});
      logger.info("Survey response submitted", { surveyId, workspaceId: survey.workspaceId, answerCount: answers.length });
      return send(200, { ok: true, thankYouMessage: survey.thankYouMessage });
    }

    return send(400, { error: "Unknown action." });
  } catch (e) {
    if (e instanceof HttpsError) {
      return send(e.code === "resource-exhausted" ? 429 : 400, { error: e.message });
    }
    logger.error("Survey public API error", { error: (e as Error).message });
    return send(500, { error: "Something went wrong. Please try again." });
  }
}
