import "server-only";

import { google } from "@ai-sdk/google";
import { generateObject } from "ai";

import { PlanOutputSchema, type PlanInput, type PlanOutput } from "./schema";
import { buildPrompt } from "./prompt";
import {
  latestExamDateOf,
  sanitizeWarnings,
  validatePlanOutput,
  type ValidatedSession,
} from "./validate";

/**
 * Call Gemini to generate a plan, then server-validate. If the LLM output
 * fails EITHER schema validation OR our stricter business validation, retry
 * once with a corrective addendum. If it still fails, return the error;
 * the caller surfaces it to the user (API.md).
 *
 * The @ai-sdk/google provider defaults to reading GOOGLE_GENERATIVE_AI_API_KEY
 * from process.env. Do not log the key or the prompt (may contain PII like
 * exam dates + first name via completedSessions in future).
 */

// Google's own deprecation message directs new users to gemini-3.6-flash
// over gemini-2.5-flash. Same free-tier eligibility, same structured-output
// quality; single-line swap if a future deprecation moves us again.
const MODEL_ID = "gemini-3.6-flash";

// Surfaced when the model returns a valid but EMPTY plan — i.e. the
// constraints leave no room for any session before the exam (e.g. all
// availability falls after the exam date). The feasibility pre-check in
// validate.ts catches the common cases earlier with more specific text; this
// is the backstop for residual infeasible inputs.
const NO_FEASIBLE_SESSIONS =
  "We couldn't fit any study sessions before your exam date. Add more available time, or move your exam date further out.";

export type GenerateResult =
  | {
      ok: true;
      sessions: ValidatedSession[];
      warnings: PlanOutput["warnings"];
    }
  | { ok: false; error: string };

export async function generatePlan(input: PlanInput): Promise<GenerateResult> {
  const model = google(MODEL_ID);
  const basePrompt = buildPrompt(input);
  const latestExam = latestExamDateOf(input);

  const attempt = async (prompt: string): Promise<GenerateResult> => {
    let raw: PlanOutput;
    try {
      const { object } = await generateObject({
        model,
        schema: PlanOutputSchema,
        prompt,
      });
      raw = object;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return {
        ok: false,
        error: `The plan generator returned invalid data: ${msg.slice(0, 200)}`,
      };
    }

    const validated = validatePlanOutput(input, raw, latestExam);
    if (!validated.ok) return validated;
    // A valid but empty plan means the constraints left no room. Treat it as a
    // failed attempt (so it retries once) carrying an actionable message.
    if (validated.sessions.length === 0) {
      return { ok: false, error: NO_FEASIBLE_SESSIONS };
    }
    return {
      ok: true,
      sessions: validated.sessions,
      warnings: sanitizeWarnings(input, validated.warnings),
    };
  };

  const first = await attempt(basePrompt);
  if (first.ok) return first;

  const addendum = `\n\nYour previous attempt failed validation with:\n"${first.error}"\nProduce a corrected plan that satisfies every rule above.`;
  const second = await attempt(basePrompt + addendum);
  if (second.ok) return second;

  // Surface the real reason rather than an opaque generic. If the model kept
  // returning an empty plan, that specific message is the most useful; any
  // other residual validation failure gets an actionable fallback.
  if (second.error === NO_FEASIBLE_SESSIONS || first.error === NO_FEASIBLE_SESSIONS) {
    return { ok: false, error: NO_FEASIBLE_SESSIONS };
  }
  return { ok: false, error: first.error };
}
