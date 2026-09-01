"use server";

import "server-only";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { SessionIdSchema } from "@/lib/validation/sessions";
import { rePlanForUser } from "@/server/actions/plan";
import type { PlanChange, PlanWarning } from "@/server/llm/diff";
import { computeNewMastery } from "@/lib/mastery/update";

/**
 * Session mutations for the /today dashboard.
 *
 * markDoneAction (F6.1): mark completed, no replan.
 * markMissedAction (F6.2 + F7): mark missed, then adaptively re-plan the
 *   remaining schedule and return the diff + warnings for the overlay.
 *
 * Both are Zod-validated, auth-checked, and idempotent in the F6.3 sense:
 * the status transition only fires for a `scheduled` row, but markMissed
 * always runs the replan afterwards so a retry (row already `missed`) still
 * regenerates the plan.
 */

export type SessionActionState =
  | { ok: true }
  | { ok: false; error: string };

export type DoneResult = { ok: true } | { ok: false; error: string };

export type MissedResult =
  | { ok: true; changes: PlanChange[]; warnings: PlanWarning[] }
  | { ok: false; error: string };

export type DetectMissedResult =
  | { ok: true; count: number }
  | { ok: false; error: string };

/**
 * detectAndMarkMissedAction (auto-detection)
 *
 * Marks all `scheduled` sessions whose starts_at is before dayStartUtc as
 * `missed`. Called silently on page load — no replan, no overlay. Idempotent:
 * subsequent calls find 0 past-scheduled rows and return count 0.
 */
export async function detectAndMarkMissedAction(
  dayStartUtc: string,
): Promise<DetectMissedResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "You need to be signed in." };

  const { data: past, error: selErr } = await supabase
    .from("sessions")
    .select("id")
    .eq("user_id", user.id)
    .eq("status", "scheduled")
    .lt("starts_at", dayStartUtc);

  if (selErr) return { ok: false, error: "Could not check for missed sessions." };
  if (!past || past.length === 0) return { ok: true, count: 0 };

  const ids = past.map((s) => s.id as string);
  const { error: updErr } = await supabase
    .from("sessions")
    .update({ status: "missed" })
    .in("id", ids)
    .eq("user_id", user.id);

  if (updErr) return { ok: false, error: "Could not mark missed sessions." };

  // No revalidatePath here: this function is called during the /today render,
  // where revalidatePath is forbidden. The page reads fresh session data in
  // the Promise.all that follows, so no revalidation is needed.
  return { ok: true, count: ids.length };
}

export async function markDoneAction(
  sessionId: string,
  focusLossCount = 0,
  elapsedSeconds = 0,
): Promise<DoneResult> {
  const parsed = SessionIdSchema.safeParse({ sessionId });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "You need to be signed in." };

  // Fetch the session's topic_id so we can update mastery.
  const { data: sessionRow } = await supabase
    .from("sessions")
    .select("topic_id, duration_minutes")
    .eq("id", parsed.data.sessionId)
    .eq("user_id", user.id)
    .maybeSingle();

  const { error } = await supabase
    .from("sessions")
    .update({ status: "completed", completed_at: new Date().toISOString() })
    .eq("id", parsed.data.sessionId)
    .eq("user_id", user.id)
    .eq("status", "scheduled");

  if (error) {
    return { ok: false, error: "We couldn't update that session. Try again." };
  }

  // Record session event (fire-and-forget; failure is non-fatal).
  void supabase.from("session_events").insert({
    user_id: user.id,
    study_session_id: parsed.data.sessionId,
    event_type: "completed",
    metadata: { elapsed_seconds: elapsedSeconds, focus_loss_count: focusLossCount },
  });

  // Update topic mastery via UPSERT.
  if (sessionRow?.topic_id) {
    const topicId = sessionRow.topic_id as string;
    const { data: existing } = await supabase
      .from("topic_mastery")
      .select("mastery_pct, sessions_completed, sessions_total")
      .eq("user_id", user.id)
      .eq("topic_id", topicId)
      .maybeSingle();

    const oldMastery = (existing?.mastery_pct as number | null) ?? 0;
    const newMastery = computeNewMastery(oldMastery, true);
    const sessionsCompleted = ((existing?.sessions_completed as number | null) ?? 0) + 1;
    const sessionsTotal = ((existing?.sessions_total as number | null) ?? 0) + 1;

    void supabase.from("topic_mastery").upsert({
      user_id: user.id,
      topic_id: topicId,
      mastery_pct: newMastery,
      sessions_completed: sessionsCompleted,
      sessions_total: sessionsTotal,
      last_session_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }, { onConflict: "user_id,topic_id" });
  }

  // Write analytics event (fire-and-forget).
  void supabase.from("analytics_events").insert({
    user_id: user.id,
    event_type: "session_completed",
    metadata: {
      session_id: parsed.data.sessionId,
      elapsed_seconds: elapsedSeconds,
      focus_loss_count: focusLossCount,
    },
  });

  revalidatePath("/today");
  revalidatePath("/plan");
  return { ok: true };
}

export async function markMissedAction(
  sessionId: string,
  elapsedSeconds = 0,
): Promise<MissedResult> {
  const parsed = SessionIdSchema.safeParse({ sessionId });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "You need to be signed in." };

  // Fetch topic for mastery update.
  const { data: sessionRow } = await supabase
    .from("sessions")
    .select("topic_id")
    .eq("id", parsed.data.sessionId)
    .eq("user_id", user.id)
    .maybeSingle();

  // Mark missed (no-op if already missed — makes retry safe).
  const { error: updErr } = await supabase
    .from("sessions")
    .update({ status: "missed" })
    .eq("id", parsed.data.sessionId)
    .eq("user_id", user.id)
    .eq("status", "scheduled");
  if (updErr) {
    return { ok: false, error: "We couldn't mark that session missed. Try again." };
  }

  // Record event + update mastery (fire-and-forget).
  void supabase.from("session_events").insert({
    user_id: user.id,
    study_session_id: parsed.data.sessionId,
    event_type: "abandoned",
    metadata: { elapsed_seconds: elapsedSeconds },
  });

  if (sessionRow?.topic_id) {
    const topicId = sessionRow.topic_id as string;
    const { data: existing } = await supabase
      .from("topic_mastery")
      .select("mastery_pct, sessions_completed, sessions_total")
      .eq("user_id", user.id)
      .eq("topic_id", topicId)
      .maybeSingle();

    const oldMastery = (existing?.mastery_pct as number | null) ?? 0;
    const newMastery = computeNewMastery(oldMastery, false);
    const sessionsTotal = ((existing?.sessions_total as number | null) ?? 0) + 1;

    void supabase.from("topic_mastery").upsert({
      user_id: user.id,
      topic_id: topicId,
      mastery_pct: newMastery,
      sessions_completed: (existing?.sessions_completed as number | null) ?? 0,
      sessions_total: sessionsTotal,
      last_session_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }, { onConflict: "user_id,topic_id" });
  }

  void supabase.from("analytics_events").insert({
    user_id: user.id,
    event_type: "session_abandoned",
    metadata: { session_id: parsed.data.sessionId, elapsed_seconds: elapsedSeconds },
  });

  // Adaptive re-plan of the remaining schedule.
  const replan = await rePlanForUser(supabase, user.id);
  if (!replan.ok) return replan;

  revalidatePath("/today");
  revalidatePath("/plan");
  return { ok: true, changes: replan.changes, warnings: replan.warnings };
}
