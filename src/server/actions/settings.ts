"use server";

import "server-only";

import { createClient } from "@/lib/supabase/server";
import {
  AvailabilityWindowSchema,
  hasOverlappingWindows,
  SESSION_LENGTHS,
  type SessionLength,
} from "@/lib/validation/onboarding";
import { rePlanForUser } from "@/server/actions/plan";

export type SaveSettingsResult =
  | { ok: true; replanned: boolean }
  | { ok: false; error: string };

export type AvailabilityWindowInput = {
  dayOfWeek: number;
  startsAt: string;
  endsAt: string;
};

export async function saveAvailabilityAction(
  windows: AvailabilityWindowInput[],
): Promise<SaveSettingsResult> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not authenticated." };

  if (windows.length === 0) {
    return { ok: false, error: "Add at least one availability window." };
  }

  for (const w of windows) {
    const parsed = AvailabilityWindowSchema.safeParse(w);
    if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  }

  if (hasOverlappingWindows(windows)) {
    return { ok: false, error: "Availability windows overlap on the same day." };
  }

  const { error: delErr } = await supabase
    .from("availability_windows")
    .delete()
    .eq("user_id", user.id);
  if (delErr) return { ok: false, error: "Could not update availability." };

  const { error: insErr } = await supabase.from("availability_windows").insert(
    windows.map((w) => ({
      user_id: user.id,
      day_of_week: w.dayOfWeek,
      starts_at: w.startsAt + ":00",
      ends_at: w.endsAt + ":00",
    })),
  );
  if (insErr) return { ok: false, error: "Could not save availability." };

  // Trigger a re-plan so the new windows take effect immediately.
  const replan = await rePlanForUser(supabase, user.id);
  return { ok: true, replanned: replan.ok };
}

export async function saveSessionLengthAction(
  minutes: number,
): Promise<SaveSettingsResult> {
  if (!SESSION_LENGTHS.includes(minutes as SessionLength)) {
    return { ok: false, error: "Session length must be 25, 45, or 60 minutes." };
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not authenticated." };

  const { error } = await supabase
    .from("profiles")
    .update({ session_length_minutes: minutes })
    .eq("id", user.id);
  if (error) return { ok: false, error: "Could not save session length." };

  const replan = await rePlanForUser(supabase, user.id);
  return { ok: true, replanned: replan.ok };
}
