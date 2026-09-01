"use server";

import "server-only";

import { createClient } from "@/lib/supabase/server";

export type EventType = "started" | "paused" | "resumed" | "completed" | "abandoned";

export type RecordEventResult = { ok: true } | { ok: false; error: string };

/**
 * Record a session lifecycle event.
 * Called from the study session client component.
 * metadata: arbitrary JSON (elapsed_seconds, focus_loss_count, etc.)
 */
export async function recordSessionEventAction(
  sessionId: string,
  eventType: EventType,
  metadata: Record<string, unknown> = {},
): Promise<RecordEventResult> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not authenticated." };

  // Verify the session belongs to this user before inserting the event.
  const { data: session } = await supabase
    .from("sessions")
    .select("id")
    .eq("id", sessionId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!session) return { ok: false, error: "Session not found." };

  const { error } = await supabase.from("session_events").insert({
    user_id: user.id,
    study_session_id: sessionId,
    event_type: eventType,
    metadata,
  });

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

