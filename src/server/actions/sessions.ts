"use server";

import "server-only";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { SessionIdSchema } from "@/lib/validation/sessions";

/**
 * Session mutations for the /today dashboard.
 *
 * Both actions are:
 *   * Zod-validated at the boundary.
 *   * Auth-checked (RLS still applies, but we short-circuit for a
 *     clearer error).
 *   * Idempotent in the F6.3 sense — only sessions currently in
 *     `scheduled` transition; anything else is a no-op success.
 *
 * F6.2's replan side-effect is deferred to Step 7. In Step 6 Missed
 * simply marks the row so the card renders in its muted state.
 */

export type SessionActionState =
  | { ok: true }
  | { ok: false; error: string };

async function transitionSession(
  sessionId: string,
  next: "completed" | "missed",
): Promise<SessionActionState> {
  const parsed = SessionIdSchema.safeParse({ sessionId });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "You need to be signed in." };

  // Only transition from scheduled → next. UPDATE with an eq filter on status
  // makes this atomic per-row; a race with another tab leaves the second call
  // as a no-op (0 rows affected), which we treat as success per F6.3.
  const patch =
    next === "completed"
      ? { status: "completed" as const, completed_at: new Date().toISOString() }
      : { status: "missed" as const };

  const { error } = await supabase
    .from("sessions")
    .update(patch)
    .eq("id", parsed.data.sessionId)
    .eq("user_id", user.id)
    .eq("status", "scheduled");

  if (error) {
    return { ok: false, error: "We couldn't update that session. Try again." };
  }

  // Refresh any page that renders sessions.
  revalidatePath("/today");
  revalidatePath("/plan");
  return { ok: true };
}

export async function markDoneAction(
  sessionId: string,
): Promise<SessionActionState> {
  return transitionSession(sessionId, "completed");
}

export async function markMissedAction(
  sessionId: string,
): Promise<SessionActionState> {
  return transitionSession(sessionId, "missed");
}
