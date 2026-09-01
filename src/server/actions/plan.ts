"use server";

import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { generatePlan } from "@/server/llm/generate";
import type { PlanInput } from "@/server/llm/schema";
import { checkPlanFeasibility } from "@/server/llm/validate";
import { utcToLocalParts } from "@/server/llm/time";
import {
  diffSessionsForOverlay,
  type DiffEntry,
  type PlanChange,
  type PlanWarning,
} from "@/server/llm/diff";
import { scorePersonalization } from "@/lib/personalization/scoring";
import type { PersonalizationAnswers } from "@/lib/personalization/types";
import { logAppError } from "@/lib/errors/log-error";

/**
 * Plan generation + adaptive re-planning.
 *
 * Neither function is a single Postgres transaction — supabase-js goes
 * through PostgREST, one HTTP call per statement (see the header of
 * src/server/actions/onboarding.ts for the recovery model). Each writes in
 * an order chosen so a mid-flow failure leaves a recoverable state.
 */

export type PlanGenerationResult =
  | { ok: true; planId: string; sessionCount: number; warningCount: number }
  | { ok: false; error: string };

export type RePlanResult =
  | { ok: true; changes: PlanChange[]; warnings: PlanWarning[] }
  | { ok: false; error: string };

const SESSION_SELECT =
  "id, starts_at, duration_minutes, instruction, status, topic:topics(name, subject:subjects(name))";

type SessionRow = {
  id: string;
  starts_at: string;
  duration_minutes: number;
  instruction: string;
  status: "scheduled" | "completed" | "missed";
  topic: { name: string; subject: { name: string } | { name: string }[] | null } | { name: string; subject: { name: string } | { name: string }[] | null }[] | null;
};

function subjectTopicOf(row: SessionRow): { subjectName: string; topicName: string } {
  const topic = Array.isArray(row.topic) ? row.topic[0] : row.topic;
  const subject = topic
    ? Array.isArray(topic.subject)
      ? topic.subject[0]
      : topic.subject
    : null;
  return {
    subjectName: subject?.name ?? "Session",
    topicName: topic?.name ?? "Study session",
  };
}

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

/** Format a UTC session start as a "Mon 16:00" slot label in the user's tz. */
function whenLabel(startsAtISO: string, timeZone: string): string {
  const p = utcToLocalParts(new Date(startsAtISO), timeZone);
  return `${WEEKDAYS[p.dayOfWeek]} ${p.timeString}`;
}

function toDiffEntry(
  row: { starts_at: string; instruction: string; subjectName: string; topicName: string },
  timeZone: string,
): DiffEntry {
  return {
    key: `${row.subjectName}|${row.topicName}|${row.instruction}`,
    label: `${row.subjectName} · ${row.topicName}`,
    when: whenLabel(row.starts_at, timeZone),
  };
}

/** Shared: build the LLM PlanInput from the user's persisted data. */
async function buildPlanInput(
  supabase: SupabaseClient,
  userId: string,
  sessionLengthMinutes: 25 | 45 | 60,
  includeCompleted: boolean,
): Promise<{ ok: true; input: PlanInput; timeZone: string } | { ok: false; error: string }> {
  const [profileRes, subjectsRes, availRes, tasksRes] = await Promise.all([
    supabase
      .from("profiles")
      .select(
        "time_zone, age_group, personalization_answers, personalization_completed_at, age_band, study_habits, study_challenges, goal_ranking, memory_score",
      )
      .eq("id", userId)
      .maybeSingle(),
    supabase
      .from("subjects")
      .select("id, name, exam_date, difficulty, confidence_pct, topics(id, name)")
      .eq("user_id", userId),
    supabase
      .from("availability_windows")
      .select("day_of_week, starts_at, ends_at")
      .eq("user_id", userId),
    supabase
      .from("subject_tasks")
      .select("task_type, title, due_date, priority, subject:subjects(name)")
      .eq("user_id", userId)
      .eq("is_completed", false),
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

  let completedSessions: PlanInput["completedSessions"] = undefined;
  if (includeCompleted) {
    const { data: completed } = await supabase
      .from("sessions")
      .select(SESSION_SELECT)
      .eq("user_id", userId)
      .eq("status", "completed");
    completedSessions = ((completed as SessionRow[] | null) ?? []).map((row) => {
      const { subjectName, topicName } = subjectTopicOf(row);
      return {
        subjectName,
        topicName,
        startsAt: row.starts_at,
        durationMinutes: row.duration_minutes,
      };
    });
  }

  // Build personalization profile from any available data (old questionnaire
  // or new wizard fields). Both paths are additive; old questionnaire's
  // topTechnique takes priority over deriving it from study_habits.
  const profileData = profileRes.data;
  let planProfile: PlanInput["profile"] = undefined;

  const ageBand = profileData?.age_band as string | null;
  const studyHabits = profileData?.study_habits as string[] | null;
  const studyChallenges = profileData?.study_challenges as string[] | null;
  const goalRanking = profileData?.goal_ranking as string[] | null;
  const memoryScore = profileData?.memory_score as number | null;

  const subjectIntelligence = subjectsRes.data
    .filter((s) => s.difficulty || s.confidence_pct != null)
    .map((s) => ({
      subjectName: s.name as string,
      difficulty: (s.difficulty as "easy" | "medium" | "hard" | null) ?? undefined,
      confidencePct: (s.confidence_pct as number | null) ?? undefined,
    }));

  let topTechnique: string | undefined;
  let ageGroup: "younger" | "older" | "adult" | undefined;
  if (profileData?.personalization_completed_at && profileData?.personalization_answers) {
    try {
      const answers = profileData.personalization_answers as PersonalizationAnswers;
      const scoring = scorePersonalization(answers);
      topTechnique = scoring.topTechnique;
      ageGroup = profileData.age_group as "younger" | "older" | "adult";
    } catch {
      // Non-fatal — proceed without old questionnaire context.
    }
  }
  if (!topTechnique && studyHabits?.[0]) topTechnique = studyHabits[0];

  const hasPersonalizationData =
    ageBand != null ||
    (studyHabits && studyHabits.length > 0) ||
    topTechnique != null ||
    subjectIntelligence.length > 0;

  if (hasPersonalizationData) {
    const p: NonNullable<PlanInput["profile"]> = {};
    if (ageGroup) p.ageGroup = ageGroup;
    if (ageBand) p.ageBand = ageBand;
    if (topTechnique) p.topTechnique = topTechnique;
    if (studyHabits?.length) p.studyHabits = studyHabits;
    if (studyChallenges?.length) p.studyChallenges = studyChallenges;
    if (goalRanking?.length) p.goalRanking = goalRanking;
    if (memoryScore != null) p.memoryScore = memoryScore;
    if (subjectIntelligence.length > 0) p.subjectIntelligence = subjectIntelligence;
    planProfile = p;
  }

  // Map subject_tasks rows to PlanInput["tasks"] — tasksRes failure is non-fatal.
  type TaskRow = {
    task_type: string;
    title: string | null;
    due_date: string | null;
    priority: string;
    subject: { name: string } | { name: string }[] | null;
  };
  const tasks: PlanInput["tasks"] =
    tasksRes.data && tasksRes.data.length > 0
      ? (tasksRes.data as TaskRow[])
          .filter((t) => t.title)
          .map((t) => {
            const subj = Array.isArray(t.subject) ? t.subject[0] : t.subject;
            return {
              title: t.title as string,
              taskType: t.task_type,
              subjectName: subj?.name ?? "",
              dueDate: t.due_date ?? null,
              priority: (t.priority as "low" | "medium" | "high") ?? "medium",
            };
          })
          .filter((t) => t.subjectName)
      : undefined;

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
      startsAt: (w.starts_at as string).slice(0, 5),
      endsAt: (w.ends_at as string).slice(0, 5),
    })),
    completedSessions,
    tasks,
    profile: planProfile,
  };

  if (input.subjects.length === 0) {
    return { ok: false, error: "You need at least one subject to generate a plan." };
  }

  // Pre-flight feasibility: catch impossible constraints (past/today exam
  // date, or windows shorter than the session length) with a specific,
  // actionable message before spending an LLM call that would return an
  // empty plan.
  const feasible = checkPlanFeasibility(input);
  if (!feasible.ok) return feasible;

  return { ok: true, input, timeZone };
}

// -----------------------------------------------------------------------------
// Initial generation (called from onboarding). Creates the active plan.
// -----------------------------------------------------------------------------

export async function generatePlanForUser(
  supabase: SupabaseClient,
  userId: string,
  sessionLengthMinutes: 25 | 45 | 60,
): Promise<PlanGenerationResult> {
  const built = await buildPlanInput(supabase, userId, sessionLengthMinutes, false);
  if (!built.ok) return built;

  const generated = await generatePlan(built.input);
  if (!generated.ok) return generated;

  const { data: planRow, error: planErr } = await supabase
    .from("plans")
    .insert({ user_id: userId, is_active: true, warnings: generated.warnings })
    .select("id")
    .single();
  if (planErr || !planRow) {
    await logAppError(
      "plan_generation",
      planErr?.message ?? "plans insert returned no data",
      {
        step: "insert_plan",
        code: planErr?.code,
        details: planErr?.details,
        hint: planErr?.hint,
        userId,
      },
      userId,
    );
    return { ok: false, error: "Could not save the generated plan." };
  }
  const planId = planRow.id as string;

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

// -----------------------------------------------------------------------------
// Adaptive re-plan (F7). Reuses the active plan; regenerates only future
// scheduled sessions; preserves completed and missed sessions (D10).
// -----------------------------------------------------------------------------

export async function rePlanForUser(
  supabase: SupabaseClient,
  userId: string,
): Promise<RePlanResult> {
  // 1. Active plan + session length.
  const [{ data: profile }, { data: activePlan }] = await Promise.all([
    supabase
      .from("profiles")
      .select("session_length_minutes")
      .eq("id", userId)
      .maybeSingle(),
    supabase
      .from("plans")
      .select("id")
      .eq("user_id", userId)
      .eq("is_active", true)
      .maybeSingle(),
  ]);
  const sessionLength = profile?.session_length_minutes as 25 | 45 | 60 | null;
  if (sessionLength !== 25 && sessionLength !== 45 && sessionLength !== 60) {
    return { ok: false, error: "Finish onboarding before re-planning." };
  }
  if (!activePlan) {
    return { ok: false, error: "No active plan to update." };
  }
  const planId = activePlan.id as string;

  // 2. Build input (with completed sessions so the LLM won't reschedule them).
  const built = await buildPlanInput(supabase, userId, sessionLength, true);
  if (!built.ok) return built;
  const { input, timeZone } = built;

  // 3. Snapshot the current scheduled sessions for the diff.
  const { data: oldScheduled } = await supabase
    .from("sessions")
    .select(SESSION_SELECT)
    .eq("user_id", userId)
    .eq("status", "scheduled");
  const oldEntries: DiffEntry[] = ((oldScheduled as SessionRow[] | null) ?? []).map(
    (row) => toDiffEntry({ ...subjectTopicOf(row), starts_at: row.starts_at, instruction: row.instruction }, timeZone),
  );

  // 4. Generate the new plan (validated + one retry inside generatePlan).
  const generated = await generatePlan(input);
  if (!generated.ok) return generated;

  // 5. Swap sessions: delete ALL scheduled (past + future), insert the new
  //    future ones under the same plan. Completed and missed stay untouched.
  const { error: delErr } = await supabase
    .from("sessions")
    .delete()
    .eq("user_id", userId)
    .eq("status", "scheduled");
  if (delErr) {
    return { ok: false, error: "Could not update your schedule. Try again." };
  }

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
    const { error: insErr } = await supabase.from("sessions").insert(sessionsPayload);
    if (insErr) {
      return { ok: false, error: "Could not save your updated schedule. Try again." };
    }
  }

  // 6. Update plan metadata (last_replanned_at + persisted warnings, C-i).
  await supabase
    .from("plans")
    .update({
      last_replanned_at: new Date().toISOString(),
      warnings: generated.warnings,
    })
    .eq("id", planId);

  // 7. Build the diff for the overlay.
  const newEntries: DiffEntry[] = generated.sessions.map((s) =>
    toDiffEntry(
      {
        subjectName: s.subjectName,
        topicName: s.topicName,
        instruction: s.instruction,
        starts_at: s.startsAtUTC.toISOString(),
      },
      timeZone,
    ),
  );
  const diff = diffSessionsForOverlay(oldEntries, newEntries);

  return { ok: true, changes: diff.changes, warnings: generated.warnings };
}
