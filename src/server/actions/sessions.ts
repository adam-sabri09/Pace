"use server";

import "server-only";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { SessionIdSchema } from "@/lib/validation/sessions";
import { rePlanForUser } from "@/server/actions/plan";
import type { PlanChange, PlanWarning } from "@/server/llm/diff";

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

  revalidatePath("/today");
  revalidatePath("/plan");
  return { ok: true, count: ids.length };
}

export async function markDoneAction(sessionId: string): Promise<DoneResult> {
  const parsed = SessionIdSchema.safeParse({ sessionId });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "You need to be signed in." };

  const { error } = await supabase
    .from("sessions")
    .update({ status: "completed", completed_at: new Date().toISOString() })
    .eq("id", parsed.data.sessionId)
    .eq("user_id", user.id)
    .eq("status", "scheduled");

  if (error) {
    return { ok: false, error: "We couldn't update that session. Try again." };
  }

  revalidatePath("/today");
  revalidatePath("/plan");
  return { ok: true };
}

export async function markMissedAction(
  sessionId: string,
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

  // Mark missed (no-op if already missed — makes retry safe). We ignore the
  // 0-rows case on purpose so a retried replan still runs.
  const { error: updErr } = await supabase
    .from("sessions")
    .update({ status: "missed" })
    .eq("id", parsed.data.sessionId)
    .eq("user_id", user.id)
    .eq("status", "scheduled");
  if (updErr) {
    return { ok: false, error: "We couldn't mark that session missed. Try again." };
  }

  // Adaptive re-plan of the remaining schedule.
  const replan = await rePlanForUser(supabase, user.id);
  if (!replan.ok) return replan;

  revalidatePath("/today");
  revalidatePath("/plan");
  return { ok: true, changes: replan.changes, warnings: replan.warnings };
}
