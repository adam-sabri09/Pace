"use server";

import "server-only";

import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { logAppError } from "@/lib/errors/log-error";
import {
  OnboardingSchema,
  type OnboardingInput,
} from "@/lib/validation/onboarding";
import { generatePlanForUser } from "./plan";

/**
 * commitOnboarding — persist a full wizard result and mark the user as onboarded.
 *
 * NOT a single Postgres transaction. supabase-js goes through PostgREST, which
 * cannot span multiple HTTP calls in one transaction. We do the writes in
 * dependency order and best-effort clean up on failure. The design choices
 * that mitigate partial-state risk:
 *
 *   1. Every write is scoped to the current user via RLS.
 *   2. Order: (a) wipe prior data, (b) subjects, (c) topics, (d)
 *      availability_windows, (e) profiles.*. The last write is the
 *      "onboarded" flag (session_length_minutes) — until it is set, /today
 *      redirects back to /onboarding, which wipes any partial state on retry.
 *   3. On any mid-flow error we attempt to delete the rows this call
 *      inserted. If cleanup fails the redirect heuristic still recovers.
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
  //    - subjects → topics → sessions (cascade via FK)
  //    - plans must be explicitly deleted; a leftover active plan causes a
  //      unique-constraint failure (plans_one_active_per_user_idx) on re-submit
  const [{ error: delSubj }, { error: delAvail }, { error: delPlans }] =
    await Promise.all([
      supabase.from("subjects").delete().eq("user_id", user.id),
      supabase.from("availability_windows").delete().eq("user_id", user.id),
      supabase.from("plans").delete().eq("user_id", user.id),
    ]);
  if (delSubj || delAvail || delPlans) {
    const firstErr = delSubj ?? delAvail ?? delPlans;
    await logAppError(
      "onboarding",
      firstErr?.message ?? "cleanup delete failed",
      { step: "wipe_previous_state", delSubj: !!delSubj, delAvail: !!delAvail, delPlans: !!delPlans },
      user.id,
    );
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
        difficulty: subject.difficulty ?? null,
        confidence_pct: subject.confidencePct ?? null,
      })
      .select("id")
      .single();
    if (error || !data) {
      await logAppError(
        "onboarding",
        error?.message ?? "no data returned",
        { step: "insert_subject", name: subject.name },
        user.id,
      );
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
      await logAppError("onboarding", error.message, { step: "insert_topics" }, user.id);
      await supabase.from("subjects").delete().eq("user_id", user.id);
      return { ok: false, error: "We couldn't save your topics." };
    }
  }

  // 6. Workload items (best-effort — subject_tasks may not exist yet).
  const workloadPayload = input.subjects.flatMap((s, i) =>
    (s.workloadItems ?? []).map((w) => ({
      user_id: user.id,
      subject_id: subjectIds[i],
      task_type: w.taskType,
      due_date: w.dueDate ?? null,
      frequency: w.frequency ?? null,
      priority: w.priority ?? "medium",
    })),
  );
  if (workloadPayload.length > 0) {
    const { error: taskError } = await supabase.from("subject_tasks").insert(workloadPayload);
    if (taskError) {
      // Non-fatal: table may not exist yet in this environment.
      await logAppError("onboarding", taskError.message, { step: "insert_subject_tasks" }, user.id);
    }
  }

  // 8. Availability windows.
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
      await logAppError("onboarding", error.message, { step: "insert_availability" }, user.id);
      await supabase
        .from("availability_windows")
        .delete()
        .eq("user_id", user.id);
      await supabase.from("subjects").delete().eq("user_id", user.id);
      return { ok: false, error: "We couldn't save your availability." };
    }
  }

  // 9. Generate the plan via Gemini. This runs BEFORE we set the "onboarded"
  //    flag — if it fails, the user's session_length_minutes stays NULL and
  //    /onboarding is still reachable, so a retry starts fresh from the top.
  const planResult = await generatePlanForUser(
    supabase,
    user.id,
    input.sessionLengthMinutes,
  );
  if (!planResult.ok) {
    await logAppError("plan_generation", planResult.error, { trigger: "onboarding" }, user.id);
    await supabase
      .from("availability_windows")
      .delete()
      .eq("user_id", user.id);
    await supabase.from("subjects").delete().eq("user_id", user.id);
    return { ok: false, error: planResult.error };
  }

  // 10. Mark onboarded LAST. Only reached after the plan is safely saved.
  //    Also persist the extended onboarding data collected in the new steps.
  const profileUpdate: Record<string, unknown> = {
    session_length_minutes: input.sessionLengthMinutes,
  };
  if (input.ageBand != null) profileUpdate.age_band = input.ageBand;
  if (input.studyHabits != null && input.studyHabits.length > 0)
    profileUpdate.study_habits = input.studyHabits;
  if (input.biggestChallenge != null)
    profileUpdate.biggest_challenge = input.biggestChallenge;
  if (input.studyChallenges != null && input.studyChallenges.length > 0)
    profileUpdate.study_challenges = input.studyChallenges;
  if (input.goalRanking != null && input.goalRanking.length > 0)
    profileUpdate.goal_ranking = input.goalRanking;
  if (input.memoryScore != null)
    profileUpdate.memory_score = input.memoryScore;

  const { error: profileError } = await supabase
    .from("profiles")
    .update(profileUpdate)
    .eq("id", user.id);
  if (profileError) {
    await logAppError("onboarding", profileError.message, { step: "update_profile" }, user.id);
    // Best-effort: drop the plan since the profile update was the commit point.
    await supabase.from("plans").delete().eq("user_id", user.id);
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

  // 11. Analytics — best-effort, non-fatal.
  try {
    await supabase.from("analytics_events").insert({
      user_id: user.id,
      event_type: "onboarding_completed",
      metadata: {
        subject_count: input.subjects.length,
        age_band: input.ageBand ?? null,
        session_length: input.sessionLengthMinutes,
        has_study_habits: (input.studyHabits?.length ?? 0) > 0,
        has_goal_ranking: (input.goalRanking?.length ?? 0) > 0,
        memory_score: input.memoryScore ?? null,
      },
    });
  } catch {
    // Non-fatal: table may not exist yet in this environment.
  }

  redirect("/today");
}
