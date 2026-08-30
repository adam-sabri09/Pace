"use server";

import "server-only";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { AddSubjectSchema } from "@/lib/validation/subjects";

export type AddSubjectResult = { ok: true } | { ok: false; error: string };

export async function addSubjectAction(raw: unknown): Promise<AddSubjectResult> {
  const parsed = AddSubjectSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message };
  }
  const { name, examDate, topics, difficulty, confidencePct } = parsed.data;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "You need to be signed in." };

  const { data: subject, error: subjectError } = await supabase
    .from("subjects")
    .insert({
      user_id: user.id,
      name,
      exam_date: examDate,
      difficulty,
      confidence_pct: confidencePct,
    })
    .select("id")
    .single();

  if (subjectError || !subject) {
    return { ok: false, error: "Could not save the subject. Try again." };
  }

  if (topics.length > 0) {
    const { error: topicsError } = await supabase.from("topics").insert(
      topics.map((t) => ({
        user_id: user.id,
        subject_id: subject.id as string,
        name: t,
      })),
    );
    if (topicsError) {
      await supabase
        .from("subjects")
        .delete()
        .eq("id", subject.id as string)
        .eq("user_id", user.id);
      return { ok: false, error: "Could not save the topics. Try again." };
    }
  }

  revalidatePath("/subjects");
  return { ok: true };
}
