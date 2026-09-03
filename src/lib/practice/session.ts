import type { ClientQuestion } from "@/server/actions/practice";

export type SessionResolution = "complete" | "continue" | "generation_failed";

/**
 * Determines how the UI should respond after a successful answer submission.
 *
 * "complete"          — server confirmed the session is finished (10 questions answered)
 * "continue"          — next question is ready; move to the next question
 * "generation_failed" — server answered OK but Gemini failed to produce the next question;
 *                       the session is still active, do NOT show the completion screen
 */
export function resolveSessionEnd(result: {
  sessionComplete: boolean;
  nextQuestion: ClientQuestion | null;
}): SessionResolution {
  if (result.sessionComplete) return "complete";
  if (!result.nextQuestion) return "generation_failed";
  return "continue";
}
