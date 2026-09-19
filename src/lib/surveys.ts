import { getApp } from "firebase/app";
import { getFunctions, httpsCallable } from "firebase/functions";
import type { Survey, SurveyResults } from "../types/surveys";

const functions = getFunctions(getApp(), "us-west2");

/**
 * Survey builder backend calls.
 *
 * Admin actions ride the existing `metaOAuthStatus` callable (creating new
 * functions fails through the egress proxy), routed by the `action` param.
 */

interface SurveyListResult {
  surveys: Survey[];
}

interface SurveySaveResult {
  survey: Survey;
}

export async function fetchSurveys(workspaceId: string): Promise<Survey[]> {
  const fn = httpsCallable<{ workspaceId: string; action: string }, SurveyListResult>(
    functions,
    "metaOAuthStatus"
  );
  const res = await fn({ workspaceId, action: "surveyList" });
  return res.data.surveys ?? [];
}

export async function saveSurvey(workspaceId: string, survey: Survey): Promise<Survey> {
  const fn = httpsCallable<{ workspaceId: string; action: string; survey: Survey }, SurveySaveResult>(
    functions,
    "metaOAuthStatus"
  );
  const res = await fn({ workspaceId, action: "surveySave", survey });
  return res.data.survey;
}

export async function deleteSurvey(workspaceId: string, surveyId: string): Promise<void> {
  const fn = httpsCallable<{ workspaceId: string; action: string; surveyId: string }, { ok: boolean }>(
    functions,
    "metaOAuthStatus"
  );
  await fn({ workspaceId, action: "surveyDelete", surveyId });
}

export async function setSurveyStatus(
  workspaceId: string,
  surveyId: string,
  status: "draft" | "active" | "closed"
): Promise<void> {
  const fn = httpsCallable<
    { workspaceId: string; action: string; surveyId: string; status: string },
    { ok: boolean }
  >(functions, "metaOAuthStatus");
  await fn({ workspaceId, action: "surveySetStatus", surveyId, status });
}

export async function fetchSurveyResults(
  workspaceId: string,
  surveyId: string
): Promise<SurveyResults> {
  const fn = httpsCallable<{ workspaceId: string; action: string; surveyId: string }, SurveyResults>(
    functions,
    "metaOAuthStatus"
  );
  const res = await fn({ workspaceId, action: "surveyResults", surveyId });
  return res.data;
}

/** Standalone shareable link for a survey. */
export function surveyPageUrl(surveyId: string): string {
  return `${window.location.origin}/survey/${surveyId}`;
}

/** Public (unauthenticated) survey API used by the shareable link page. */
const SURVEY_API = "/survey-api";

export interface PublicSurveyQuestion {
  id: string;
  type: string;
  label: string;
  description: string;
  required: boolean;
  options: string[];
  scaleMax: number;
}

export interface PublicSurvey {
  id: string;
  title: string;
  description: string;
  status: string;
  questions: PublicSurveyQuestion[];
  collectEmail: boolean;
  collectPhone: boolean;
  thankYouMessage: string;
}

export async function getPublicSurvey(surveyId: string): Promise<{ survey: PublicSurvey | null; reason?: string }> {
  const res = await fetch(SURVEY_API, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "get", surveyId }),
  });
  if (!res.ok) throw new Error("Could not load this survey.");
  return res.json();
}

export async function submitSurveyResponse(
  surveyId: string,
  answers: Record<string, string | string[]>,
  identity: { email?: string; phone?: string }
): Promise<{ ok: boolean; thankYouMessage?: string }> {
  const res = await fetch(SURVEY_API, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "submit", surveyId, answers, email: identity.email, phone: identity.phone }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { error?: string }).error || "Could not submit your answers.");
  return data as { ok: boolean; thankYouMessage?: string };
}
