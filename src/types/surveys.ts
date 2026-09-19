/**
 * ChatMize Survey Builder types.
 *
 * Surveys are built from question elements, placed in popups / slide ins
 * (via the Website Overlays SDK) or shared as standalone links, and each
 * answer can land in a named contact variable so BotMaps flows can
 * personalize on survey answers. Variable names reuse the BotMaps reserved
 * name rules (see src/lib/flowVariables.ts).
 */

export type SurveyQuestionType =
  | 'multiple_choice'
  | 'checkboxes'
  | 'rating'
  | 'nps'
  | 'short_text'
  | 'long_text'
  | 'date'
  | 'dropdown';

export interface SurveyQuestionTypeInfo {
  v: SurveyQuestionType;
  label: string;
  hint: string;
  needsOptions: boolean;
}

export const SURVEY_QUESTION_TYPES: SurveyQuestionTypeInfo[] = [
  { v: 'multiple_choice', label: 'Multiple choice', hint: 'Pick one answer', needsOptions: true },
  { v: 'checkboxes', label: 'Checkboxes', hint: 'Pick any that apply', needsOptions: true },
  { v: 'rating', label: 'Star rating', hint: '1 to 5 stars', needsOptions: false },
  { v: 'nps', label: 'NPS score', hint: '0 to 10 likelihood', needsOptions: false },
  { v: 'short_text', label: 'Short text', hint: 'One line answer', needsOptions: false },
  { v: 'long_text', label: 'Long text', hint: 'Paragraph answer', needsOptions: false },
  { v: 'date', label: 'Date', hint: 'Calendar date', needsOptions: false },
  { v: 'dropdown', label: 'Dropdown', hint: 'Pick one from a list', needsOptions: true },
];

export interface SurveyQuestion {
  id: string;
  type: SurveyQuestionType;
  /** The question shown to the visitor. */
  label: string;
  description?: string;
  required: boolean;
  /** Options for multiple_choice / checkboxes / dropdown. */
  options?: string[];
  /** Contact variable this answer saves into. Sanitized + reserved-checked. */
  variableName: string;
  /** Rating scale max (default 5). */
  scaleMax?: number;
}

export type SurveyStatus = 'draft' | 'active' | 'closed';

export interface Survey {
  id: string;
  workspaceId: string;
  title: string;
  description?: string;
  status: SurveyStatus;
  questions: SurveyQuestion[];
  /** Ask for email at the end so answers attach to a contact. */
  collectEmail: boolean;
  /** Ask for phone at the end so answers attach to a contact. */
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
  /** Single value, or array for checkboxes. */
  value: string | string[];
}

export interface SurveyResponse {
  id: string;
  workspaceId: string;
  surveyId: string;
  contactId?: string;
  email?: string;
  phone?: string;
  answers: SurveyAnswer[];
  completedAt: string;
}

/** Per-question aggregate for the results view. */
export interface SurveyQuestionAggregate {
  questionId: string;
  label: string;
  type: SurveyQuestionType;
  responseCount: number;
  /** Choice questions: count per option label. */
  optionCounts?: Record<string, number>;
  /** Rating / NPS: average and total counted. */
  average?: number;
  /** Latest text answers (long text capped server-side). */
  samples?: string[];
}

export interface SurveyResults {
  survey: Survey;
  totalResponses: number;
  aggregates: SurveyQuestionAggregate[];
  responses: SurveyResponse[];
}

export function newSurveyQuestion(type: SurveyQuestionType): SurveyQuestion {
  return {
    id: `q_${Math.random().toString(36).slice(2, 10)}`,
    type,
    label: '',
    required: false,
    options: ['Option 1', 'Option 2'],
    variableName: '',
    scaleMax: type === 'rating' ? 5 : undefined,
  };
}

export function newSurvey(workspaceId: string): Survey {
  const now = new Date().toISOString();
  return {
    id: `survey_${Math.random().toString(36).slice(2, 10)}`,
    workspaceId,
    title: 'Untitled survey',
    description: '',
    status: 'draft',
    questions: [],
    collectEmail: true,
    collectPhone: false,
    thankYouMessage: 'Thanks for sharing your answers!',
    counters: { views: 0, responses: 0 },
    createdAt: now,
    updatedAt: now,
  };
}
