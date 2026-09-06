import "server-only";

import { google } from "@ai-sdk/google";
import { generateObject } from "ai";

import { PlanOutputSchema, type PlanInput, type PlanOutput } from "./schema";
import { buildPrompt } from "./prompt";
import {
  sanitizeWarnings,
  validatePlanOutput,
  type ValidatedSession,
} from "./validate";
import { generateFallbackPlan } from "./fallback";
import { utcToLocalParts } from "./time";

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

// Surfaced when the model returns a valid but EMPTY plan. The feasibility
// pre-check in validate.ts catches the common cases; this is the backstop.
const NO_FEASIBLE_SESSIONS =
  "We couldn't fit any study sessions in your available time. Try adding more availability or choosing a shorter session length.";

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
  // Only use future exam dates — a past exam must not constrain future sessions.
  const todayDateStr = utcToLocalParts(input.now, input.timeZone).dateString;
  const latestExam =
    input.subjects
      .map((s) => s.examDate)
      .filter((d): d is string => d != null && d > todayDateStr)
      .sort()
      .pop() ?? null;

  const attempt = async (prompt: string): Promise<GenerateResult> => {
    let raw: PlanOutput;
    try {
      const { object } = await generateObject({
        model,
        schema: PlanOutputSchema,
        prompt,
        abortSignal: AbortSignal.timeout(30_000),
      });
      raw = object;
    } catch (err) {
      if (err instanceof Error && err.name === "TimeoutError") {
        return { ok: false, error: "Plan generation timed out. Please try again." };
      }
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

  // Both LLM attempts failed. Fall back to the deterministic planner rather
  // than surfacing an error — the feasibility pre-check already confirmed at
  // least one slot fits, so the fallback always produces ≥ 1 session.
  // Common failure modes the fallback avoids: subject/topic name casing
  // divergence, window-boundary arithmetic errors, and minor time drift.
  const fallbackSessions = generateFallbackPlan(input);
  if (fallbackSessions.length > 0) {
    return {
      ok: true,
      sessions: fallbackSessions,
      // Carry over any warnings from the last failed LLM attempt if it returned some
      warnings: [],
    };
  }

  // Only reach here if feasibility somehow lied (should not happen in practice).
  if (second.error === NO_FEASIBLE_SESSIONS || first.error === NO_FEASIBLE_SESSIONS) {
    return { ok: false, error: NO_FEASIBLE_SESSIONS };
  }
  return {
    ok: false,
    error:
      "We couldn't build a plan that fits your available time. Try adding more availability or choosing a shorter session length.",
  };
}
