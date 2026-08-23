"use server";

import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { generatePlan } from "@/server/llm/generate";
import type { PlanInput } from "@/server/llm/schema";

/**
 * Loads the user's onboarding-persisted data, calls the LLM, and inserts
 * plans + sessions.
 *
 * Not truly atomic — see the header of src/server/actions/onboarding.ts for
 * the recovery model. This function inserts plans first (with is_active =
 * true, guarded by the partial unique index), then sessions. On any failure
 * after plan insert, it best-effort deletes the plan (cascades to any
 * inserted sessions).
 */
export type PlanGenerationResult =
  | { ok: true; planId: string; sessionCount: number; warningCount: number }
  | { ok: false; error: string };

export async function generatePlanForUser(
  supabase: SupabaseClient,
  userId: string,
  sessionLengthMinutes: 25 | 45 | 60,
): Promise<PlanGenerationResult> {
  // 1. Gather inputs. sessionLengthMinutes is passed in explicitly rather
  //    than read from profiles because onboarding sets it LAST — after the
  //    plan is safely saved — as its "onboarded" flag.
  const [profileRes, subjectsRes, availRes] = await Promise.all([
    supabase
      .from("profiles")
      .select("time_zone")
      .eq("id", userId)
      .maybeSingle(),
    supabase
      .from("subjects")
      .select("id, name, exam_date, topics(id, name)")
      .eq("user_id", userId),
    supabase
      .from("availability_windows")
      .select("day_of_week, starts_at, ends_at")
      .eq("user_id", userId),
  ]);
  if (profileRes.error || !profileRes.data) {
    return { ok: false, error: "Could not read profile for plan generation." };
  }
  if (subjectsRes.error || !subjectsRes.data) {
    return { ok: false, error: "Could not read subjects for plan generation." };
  }
  if (availRes.error || !availRes.data) {
    return { ok: false, error: "Could not read availability for plan generation." };
  }

  const timeZone = profileRes.data.time_zone ?? "UTC";

  const input: PlanInput = {
    timeZone,
    now: new Date(),
    sessionLengthMinutes,
    subjects: subjectsRes.data.map((s) => ({
      id: s.id as string,
      name: s.name as string,
      examDate: (s.exam_date as string | null) ?? null,
      topics: ((s.topics as Array<{ id: string; name: string }> | null) ?? []).map(
        (t) => ({ id: t.id, name: t.name }),
      ),
    })),
    availability: availRes.data.map((w) => ({
      dayOfWeek: w.day_of_week as number,
      // Supabase returns TIME as "HH:MM:SS"; the schema expects HH:MM.
      startsAt: (w.starts_at as string).slice(0, 5),
      endsAt: (w.ends_at as string).slice(0, 5),
    })),
  };

  if (input.subjects.length === 0) {
    return { ok: false, error: "You need at least one subject to generate a plan." };
  }

  // 2. Call the LLM (with server-side validation + one retry inside generatePlan).
  const generated = await generatePlan(input);
  if (!generated.ok) return generated;

  // 3. Insert an active plan (partial unique index enforces one active per user).
  const { data: planRow, error: planErr } = await supabase
    .from("plans")
    .insert({ user_id: userId, is_active: true })
    .select("id")
    .single();
  if (planErr || !planRow) {
    return { ok: false, error: "Could not save the generated plan." };
  }
  const planId = planRow.id as string;

  // 4. Insert sessions in a single bulk call. If it fails, remove the plan
  //    row so we don't leak an empty active plan and block the next attempt.
  const sessionsPayload = generated.sessions.map((s) => ({
    plan_id: planId,
    user_id: userId,
    topic_id: s.topicId,
    starts_at: s.startsAtUTC.toISOString(),
    duration_minutes: s.durationMinutes,
    instruction: s.instruction,
    status: "scheduled" as const,
  }));

  if (sessionsPayload.length > 0) {
    const { error: sessionsErr } = await supabase
      .from("sessions")
      .insert(sessionsPayload);
    if (sessionsErr) {
      await supabase.from("plans").delete().eq("id", planId);
      return { ok: false, error: "Could not save your study sessions." };
    }
  }

  return {
    ok: true,
    planId,
    sessionCount: generated.sessions.length,
    warningCount: generated.warnings.length,
  };
}
