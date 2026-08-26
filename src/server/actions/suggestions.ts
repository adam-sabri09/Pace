"use server";
import "server-only";

import { z } from "zod";
import { google } from "@ai-sdk/google";
import { generateObject } from "ai";

import { createClient } from "@/lib/supabase/server";

const InputSchema = z
  .array(z.string().trim().min(1).max(100))
  .min(1)
  .max(20);

const SuggestionsOutputSchema = z.object({
  suggestions: z.array(
    z.object({
      subjectName: z.string(),
      topics: z.array(z.string()),
    }),
  ),
});

/**
 * Ask Gemini for 4–6 topic suggestions per subject. Returns {} on any failure
 * so onboarding is never blocked if the AI call errors.
 *
 * Auth-gated to prevent unauthenticated callers from burning API quota.
 */
export async function suggestTopicsAction(
  subjectNames: string[],
): Promise<Record<string, string[]>> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return {};

  const parsed = InputSchema.safeParse(subjectNames);
  if (!parsed.success) return {};

  const names = parsed.data;

  try {
    const model = google("gemini-3.6-flash");
    const { object } = await generateObject({
      model,
      schema: SuggestionsOutputSchema,
      prompt: buildPrompt(names),
    });

    const result: Record<string, string[]> = {};
    for (const item of object.suggestions) {
      const match = names.find(
        (n) => n.toLowerCase() === item.subjectName.toLowerCase(),
      );
      if (match) result[match] = item.topics.slice(0, 6);
    }
    return result;
  } catch {
    return {};
  }
}

function buildPrompt(subjectNames: string[]): string {
  const list = subjectNames.map((n) => `- ${n}`).join("\n");
  return `You are helping a high school student (age 14–18) build a study plan.

For each subject below, suggest 4–6 specific, exam-focused topics a student would typically need to study.
Keep suggestions concise (2–5 words each), practical, and appropriate for high school level.
Return exactly one entry per subject using the exact subject name provided.

Subjects:
${list}`;
}
