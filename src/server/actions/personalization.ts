"use server";

import "server-only";

import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { PersonalizationAnswersSchema } from "@/lib/validation/personalization";
import type { PersonalizationAnswers } from "@/lib/personalization/types";

export type PersonalizationActionState = { ok: false; error: string } | null;

export async function savePersonalizationAction(
  _prev: PersonalizationActionState,
  raw: unknown,
): Promise<PersonalizationActionState> {
  const parsed = PersonalizationAnswersSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message };
  }
  const answers: PersonalizationAnswers = parsed.data;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "You need to be signed in." };

  const { error } = await supabase
    .from("profiles")
    .update({
      age_group: answers.ageGroup,
      personalization_answers: answers,
      personalization_skipped: false,
      personalization_completed_at: new Date().toISOString(),
    })
    .eq("id", user.id);

  if (error) {
    return { ok: false, error: "Could not save your preferences. Try again." };
  }

  redirect("/today");
}

export async function skipPersonalizationAction(): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  await supabase
    .from("profiles")
    .update({ personalization_skipped: true })
    .eq("id", user.id);
}
