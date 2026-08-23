"use server";

import "server-only";

import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import {
  OnboardingSchema,
  type OnboardingInput,
} from "@/lib/validation/onboarding";

/**
 * commitOnboarding — persist a full wizard result and mark the user as onboarded.
 *
 * NOT a single Postgres transaction. supabase-js goes through PostgREST, which
 * cannot span multiple HTTP calls in one transaction. We do the writes in
 * dependency order and best-effort clean up on failure. The design choices
 * that mitigate partial-state risk:
 *
 *   1. Every write is scoped to the current user via RLS (TO authenticated,
 *      user_id = auth.uid()). A leaked auth token would still only be able to
 *      touch its own rows.
 *   2. Order is: (a) wipe prior data, (b) subjects, (c) topics, (d)
 *      availability_windows, (e) profiles.session_length_minutes. The last
 *      write is the "onboarded" flag — until it is set, /today redirects
 *      the user back to /onboarding, which begins by wiping any partial
 *      state on the next attempt.
 *   3. On any mid-flow error we attempt to delete the rows this call
 *      inserted. If that cleanup itself fails, the redirect heuristic in
 *      step (2) still recovers — the user sees an error, retries, and the
 *      next attempt starts from a clean slate.
 *
 * If we later need strict atomicity, the migration path is a single
 * server-side Postgres function invoked with .rpc() — that runs in a real
 * transaction. Not needed for the prototype.
 */

export type OnboardingActionState = { ok: false; error: string } | null;

export async function commitOnboardingAction(
  _prev: OnboardingActionState,
  raw: unknown,
): Promise<OnboardingActionState> {
  // 1. Validate the whole payload up front.
  const parsed = OnboardingSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message };
  }
  const input: OnboardingInput = parsed.data;

  // 2. Auth check.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "You need to be signed in." };

  // 3. Wipe any previous partial state for this user.
  //    topics cascade from subjects (see 0001_init.sql).
  const [{ error: delSubj }, { error: delAvail }] = await Promise.all([
    supabase.from("subjects").delete().eq("user_id", user.id),
    supabase.from("availability_windows").delete().eq("user_id", user.id),
  ]);
  if (delSubj || delAvail) {
    return {
      ok: false,
      error: "We couldn't reset your previous data. Try again.",
    };
  }

  // 4. Insert subjects one at a time so the returned id lines up with the
  //    input order without depending on PostgREST's bulk-insert ordering.
  const subjectIds: string[] = [];
  for (const subject of input.subjects) {
    const { data, error } = await supabase
      .from("subjects")
      .insert({
        user_id: user.id,
        name: subject.name,
        exam_date: subject.examDate,
      })
      .select("id")
      .single();
    if (error || !data) {
      await supabase.from("subjects").delete().eq("user_id", user.id);
      return { ok: false, error: "We couldn't save your subjects." };
    }
    subjectIds.push(data.id);
  }

  // 5. Topics — flatten with parent id from step 4.
  const topicsPayload = input.subjects.flatMap((s, i) =>
    s.topics.map((t) => ({
      user_id: user.id,
      subject_id: subjectIds[i],
      name: t.name,
    })),
  );
  if (topicsPayload.length > 0) {
    const { error } = await supabase.from("topics").insert(topicsPayload);
    if (error) {
      // Delete subjects → cascades to any topics that did land.
      await supabase.from("subjects").delete().eq("user_id", user.id);
      return { ok: false, error: "We couldn't save your topics." };
    }
  }

  // 6. Availability windows.
  const availabilityPayload = input.availability.map((w) => ({
    user_id: user.id,
    day_of_week: w.dayOfWeek,
    starts_at: w.startsAt,
    ends_at: w.endsAt,
  }));
  {
    const { error } = await supabase
      .from("availability_windows")
      .insert(availabilityPayload);
    if (error) {
      await supabase
        .from("availability_windows")
        .delete()
        .eq("user_id", user.id);
      await supabase.from("subjects").delete().eq("user_id", user.id);
      return { ok: false, error: "We couldn't save your availability." };
    }
  }

  // 7. Mark onboarded LAST. Anything above this line is recoverable via the
  //    /today → /onboarding redirect heuristic.
  const { error: profileError } = await supabase
    .from("profiles")
    .update({ session_length_minutes: input.sessionLengthMinutes })
    .eq("id", user.id);
  if (profileError) {
    await supabase
      .from("availability_windows")
      .delete()
      .eq("user_id", user.id);
    await supabase.from("subjects").delete().eq("user_id", user.id);
    return {
      ok: false,
      error: "We couldn't finish setting up your account. Try again.",
    };
  }

  redirect("/today");
}
