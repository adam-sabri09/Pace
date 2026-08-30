"use server";

import "server-only";

import { z } from "zod";

import { createClient } from "@/lib/supabase/server";

const Schema = z.object({
  subjectId: z.string().uuid(),
  difficulty: z.enum(["easy", "medium", "hard"]).nullable(),
  confidencePct: z.number().int().min(0).max(100).nullable(),
});

export type SubjectIntelligenceResult = { ok: true } | { ok: false; error: string };

export async function updateSubjectIntelligenceAction(
  subjectId: string,
  difficulty: "easy" | "medium" | "hard" | null,
  confidencePct: number | null,
): Promise<SubjectIntelligenceResult> {
  const parsed = Schema.safeParse({ subjectId, difficulty, confidencePct });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "You need to be signed in." };

  const { error } = await supabase
    .from("subjects")
    .update({
      difficulty: parsed.data.difficulty,
      confidence_pct: parsed.data.confidencePct,
    })
    .eq("id", parsed.data.subjectId)
    .eq("user_id", user.id);

  if (error) return { ok: false, error: "Could not update subject. Try again." };
  return { ok: true };
}
