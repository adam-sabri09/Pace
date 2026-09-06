"use server";

import "server-only";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { AddSubjectSchema } from "@/lib/validation/subjects";

// ---------------------------------------------------------------------------
// Delete past exams
// ---------------------------------------------------------------------------

export type DeletePassedExamsResult =
  | { ok: true; count: number }
  | { ok: false; error: string };

/**
 * Clears exam_date on subjects whose exam date has already passed.
 * Does NOT delete the subject, topics, or session history — only removes the
 * exam date so these subjects no longer appear in the "Your subjects" progress
 * section on /plan.
 */
export async function deletePassedExamsAction(): Promise<DeletePassedExamsResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "You need to be signed in." };

  const { data: profile } = await supabase
    .from("profiles")
    .select("time_zone")
    .eq("id", user.id)
    .maybeSingle();

  const timeZone = (profile?.time_zone as string | null) ?? "UTC";
  const today = new Date().toLocaleDateString("en-CA", { timeZone }); // YYYY-MM-DD

  // Count affected subjects before clearing so we can report the number.
  const { data: passedSubjects, error: fetchError } = await supabase
    .from("subjects")
    .select("id")
    .eq("user_id", user.id)
    .not("exam_date", "is", null)
    .lt("exam_date", today);

  if (fetchError) return { ok: false, error: "Could not fetch past exams." };
  if (!passedSubjects || passedSubjects.length === 0) return { ok: true, count: 0 };

  const passedSubjectIds = passedSubjects.map((s) => s.id as string);

  // Delete missed sessions for topics belonging to the cleared subjects.
  // Only deletes sessions that have already started (status=missed, starts_at < now).
  // Completed sessions and scheduled future sessions are preserved.
  const { data: affectedTopics, error: topicsError } = await supabase
    .from("topics")
    .select("id")
    .in("subject_id", passedSubjectIds)
    .eq("user_id", user.id);

  if (topicsError) return { ok: false, error: "Could not fetch topics for past exams." };

  const topicIds = (affectedTopics ?? []).map((t) => t.id as string);

  if (topicIds.length > 0) {
    const nowISO = new Date().toISOString();
    const { error: sessionsError } = await supabase
      .from("sessions")
      .delete()
      .eq("user_id", user.id)
      .in("status", ["missed", "scheduled"])
      .lt("starts_at", nowISO)
      .in("topic_id", topicIds);

    if (sessionsError) return { ok: false, error: "Could not remove missed sessions. Try again." };
  }

  const { error: updateError } = await supabase
    .from("subjects")
    .update({ exam_date: null })
    .eq("user_id", user.id)
    .not("exam_date", "is", null)
    .lt("exam_date", today);

  if (updateError) return { ok: false, error: "Could not clear past exams. Try again." };

  revalidatePath("/plan");
  revalidatePath("/today");

  return { ok: true, count: passedSubjects.length };
}

export type DeleteSubjectResult = { ok: true } | { ok: false; error: string };

/**
 * Permanently deletes a subject and all cascaded data (topics, sessions,
 * practice history tied to those topics). This is irreversible — the caller
 * must show a confirmation with a data-loss warning before invoking.
 */
export async function deleteSubjectAction(subjectId: string): Promise<DeleteSubjectResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "You need to be signed in." };

  const { error } = await supabase
    .from("subjects")
    .delete()
    .eq("id", subjectId)
    .eq("user_id", user.id);

  if (error) return { ok: false, error: "Could not delete the subject. Try again." };

  revalidatePath("/subjects");
  revalidatePath("/plan");
  revalidatePath("/today");
  return { ok: true };
}

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
  revalidatePath("/plan");
  revalidatePath("/today");
  return { ok: true };
}
