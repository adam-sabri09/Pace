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

  return {
    ok: false,
    error: "We couldn't build a valid plan. Please try again.",
  };
}
