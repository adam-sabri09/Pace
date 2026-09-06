import { redirect } from "next/navigation";
import Link from "next/link";

import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { SessionCard, type SessionStatus } from "@/components/session-card";
import { localWallClockToUTC, utcToLocalParts } from "@/server/llm/time";
import { detectAndMarkMissedAction } from "@/server/actions/sessions";
import { buildTodayRecommendation, type SubjectIntelligenceWithTopics } from "@/lib/personalization/recommender";
import { scorePersonalization, scoreFromNewProfile } from "@/lib/personalization/scoring";
import { getRecommendationPresentation } from "@/lib/personalization/recommendation-presentation";
import type { PersonalizationAnswers, TechniqueKey } from "@/lib/personalization/types";
import { selectTechnique, type HybridTechniqueResult } from "@/lib/ml/hybrid";
import type { TrainingExample } from "@/lib/ml/features";
import { encodeFeatures } from "@/lib/ml/features";
import { getAgeBandUI } from "@/lib/personalization/age-band";

function computeStudyStreak(completedLocalDates: string[], todayString: string): number {
  const studyDates = new Set(completedLocalDates);
  let streak = 0;
  // Start from today if studied today, otherwise yesterday.
  let cursor = new Date(`${todayString}T12:00:00Z`);
  if (!studyDates.has(todayString)) {
    cursor = new Date(cursor.getTime() - 24 * 60 * 60 * 1000);
  }
  for (let i = 0; i < 91; i++) {
    const dateStr = cursor.toISOString().slice(0, 10);
    if (!studyDates.has(dateStr)) break;
    streak++;
    cursor = new Date(cursor.getTime() - 24 * 60 * 60 * 1000);
  }
  return streak;
}

function buildSessionRationale(
  subjectName: string,
  topicId: string | null,
  subjects: Array<{ name: string; exam_date: string | null; confidence_pct: number | null }>,
  masteryMap: Map<string, number>,
  todayString: string,
): string | null {
  const subject = subjects.find((s) => s.name === subjectName);
  if (!subject) return null;

  const examDate = subject.exam_date;
  const daysToExam = examDate
    ? Math.round(
        (new Date(`${examDate}T00:00:00Z`).getTime() -
          new Date(`${todayString}T00:00:00Z`).getTime()) /
          (24 * 60 * 60 * 1000),
      )
    : null;
  const topicMastery = topicId ? (masteryMap.get(topicId) ?? null) : null;

  if (daysToExam === 0) return "Your exam is today — you've got this.";
  if (daysToExam !== null && daysToExam >= 0 && daysToExam <= 7)
    return `Exam in ${daysToExam} day${daysToExam === 1 ? "" : "s"} — final preparation.`;
  if (topicMastery !== null && topicMastery < 40)
    return "This topic needs more practice — you're building it up.";
  if (subject.confidence_pct !== null && subject.confidence_pct < 40)
    return "You rated this as one of your tougher subjects. Steady progress counts.";
  if (daysToExam !== null && daysToExam >= 0 && daysToExam <= 21)
    return `Exam in ${daysToExam} days — keep the momentum going.`;
  return null;
}

/**
 * /today — dashboard for the current local day.
 */
export default async function TodayPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select(
      "first_name, session_length_minutes, time_zone, personalization_completed_at, personalization_answers, age_band, study_habits, biggest_challenge, study_challenges, goal_ranking, memory_score",
    )
    .eq("id", user.id)
    .maybeSingle();

  if (profile?.session_length_minutes == null) redirect("/onboarding");

  const timeZone = profile?.time_zone ?? "UTC";
  const greetingName = profile?.first_name?.trim() || "friend";
  const ageBandUI = getAgeBandUI(profile?.age_band as string | null);

  const now = new Date();
  const localNow = utcToLocalParts(now, timeZone);
  const dayStartUTC = localWallClockToUTC(
    `${localNow.dateString}T00:00`,
    timeZone,
  ).toISOString();
  const dayEndUTC = localWallClockToUTC(
    `${localNow.dateString}T23:59`,
    timeZone,
  ).toISOString();

  // Silently mark sessions from before today as missed. Idempotent — if none
  // remain scheduled from past days, this returns immediately with count 0.
  await detectAndMarkMissedAction(dayStartUTC);

  const ninetyDaysAgoUTC = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();

  const [examRes, sessionsRes, subjectsRes, tasksRes, masteryRes, courseworkReadyRes, streakSessionsRes, activePlanRes] = await Promise.all([
    supabase
      .from("subjects")
      .select("name, exam_date")
      .eq("user_id", user.id)
      .not("exam_date", "is", null)
      .gte("exam_date", localNow.dateString)
      .order("exam_date", { ascending: true })
      .limit(1),
    supabase
      .from("sessions")
      .select(
        "id, starts_at, duration_minutes, instruction, status, topic_id, topic:topics(name, subject:subjects(name))",
      )
      .eq("user_id", user.id)
      .gte("starts_at", dayStartUTC)
      .lte("starts_at", dayEndUTC)
      .order("starts_at", { ascending: true }),
    supabase
      .from("subjects")
      .select("id, name, exam_date, difficulty, confidence_pct, topics(id, name)")
      .eq("user_id", user.id),
    supabase
      .from("subject_tasks")
      .select("id, task_type, title, due_date, priority, subject:subjects(name)")
      .eq("user_id", user.id)
      .eq("is_completed", false)
      .order("due_date", { ascending: true, nullsFirst: false })
      .limit(8),
    supabase
      .from("topic_mastery")
      .select("topic_id, mastery_pct")
      .eq("user_id", user.id),
    supabase
      .from("coursework_items")
      .select("id, title, subject_name")
      .eq("user_id", user.id)
      .eq("status", "ready")
      .order("created_at", { ascending: false })
      .limit(1),
    supabase
      .from("sessions")
      .select("starts_at")
      .eq("user_id", user.id)
      .eq("status", "completed")
      .gte("starts_at", ninetyDaysAgoUTC),
    supabase
      .from("plans")
      .select("generated_at")
      .eq("user_id", user.id)
      .eq("is_active", true)
      .maybeSingle(),
  ]);

  const nextExam = examRes.data?.[0] ?? null;
  const daysToExam = nextExam
    ? Math.round(
        (new Date(`${nextExam.exam_date}T00:00:00Z`).getTime() -
          new Date(`${localNow.dateString}T00:00:00Z`).getTime()) /
          (24 * 60 * 60 * 1000),
      )
    : null;

  const topicMasteryMap = new Map<string, number>(
    (masteryRes.data ?? []).map((m) => [m.topic_id as string, m.mastery_pct as number]),
  );

  const subjectsFlat = (subjectsRes.data ?? []).map((s) => ({
    name: s.name as string,
    exam_date: s.exam_date as string | null,
    confidence_pct: s.confidence_pct as number | null,
  }));

  const cards = (sessionsRes.data ?? []).map((s) => {
    const topic = Array.isArray(s.topic) ? s.topic[0] : s.topic;
    const subject = topic
      ? Array.isArray(topic.subject)
        ? topic.subject[0]
        : topic.subject
      : null;
    const start = utcToLocalParts(new Date(s.starts_at as string), timeZone);
    const end = utcToLocalParts(
      new Date(
        new Date(s.starts_at as string).getTime() +
          (s.duration_minutes as number) * 60_000,
      ),
      timeZone,
    );
    const subjectName = (subject?.name as string | undefined) ?? "Session";
    const topicId = (s.topic_id as string | null) ?? null;
    const rationale =
      s.status === "scheduled"
        ? buildSessionRationale(subjectName, topicId, subjectsFlat, topicMasteryMap, localNow.dateString)
        : null;
    return {
      id: s.id as string,
      status: s.status as SessionStatus,
      subjectName,
      topicName: (topic?.name as string | undefined) ?? "Study session",
      timeRange: `${start.timeString} – ${end.timeString}`,
      durationMinutes: s.duration_minutes as number,
      instruction: s.instruction as string,
      topicId,
      rationale,
    };
  });

  // Study streak: consecutive days ending today (or yesterday) with ≥1 completed session.
  const completedLocalDates = (streakSessionsRes.data ?? []).map((s) =>
    utcToLocalParts(new Date(s.starts_at as string), timeZone).dateString,
  );
  const studyStreak = computeStudyStreak(completedLocalDates, localNow.dateString);

  const allDone = cards.length > 0 && cards.every((c) => c.status === "completed");
  const hasSubjects = (subjectsRes.data ?? []).length > 0;
  const sessionsError = sessionsRes.error != null;
  const topGoal = (profile?.goal_ranking as string[] | null)?.[0] ?? null;
  const isFirstPlan =
    studyStreak === 0 &&
    activePlanRes?.data?.generated_at != null &&
    Date.now() - new Date(activePlanRes.data.generated_at as string).getTime() < 24 * 60 * 60 * 1000;

  const dateLabel = new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    timeZone,
  }).format(now);

  // -------------------------------------------------------------------------
  // Personalization — shown for all onboarded users.
  // Priority: (1) new onboarding fields, (2) old questionnaire, (3) sensible defaults.
  // Technique selection: hybrid rule-based + KNN (when >= 10 other users).
  // -------------------------------------------------------------------------
  let recommendation = null;
  let recommendationPresentation = getRecommendationPresentation("low");
  let mlSource: "ml" | "rules" = "rules";

  try {
    const subjectIntelligence: SubjectIntelligenceWithTopics[] = (subjectsRes.data ?? []).map((s) => ({
      subjectId: s.id as string,
      subjectName: s.name as string,
      difficulty: (s.difficulty as "easy" | "medium" | "hard" | null) ?? null,
      confidencePct: (s.confidence_pct as number | null) ?? null,
      examDate: (s.exam_date as string | null) ?? null,
      topics: ((s.topics as Array<{ id: string; name: string }> | null) ?? []).map(
        (t) => ({ id: t.id, name: t.name }),
      ),
    }));

    let rulesTopTechnique: TechniqueKey = "active_recall";
    let rulesConfidence = 0;
    let confidenceLevel: "high" | "medium" | "low" = "low";

    if (profile?.personalization_answers) {
      const scoring = scorePersonalization(profile.personalization_answers as PersonalizationAnswers);
      rulesTopTechnique = scoring.topTechnique as TechniqueKey;
      rulesConfidence = scoring.confidence;
      confidenceLevel = scoring.confidenceLevel;
    } else if (
      (profile?.study_habits && (profile.study_habits as string[]).length > 0) ||
      (profile?.goal_ranking && (profile.goal_ranking as string[]).length > 0) ||
      profile?.age_band
    ) {
      const scoring = scoreFromNewProfile({
        ageBand: profile.age_band as string | null,
        studyHabits: (profile.study_habits as string[]) ?? [],
        biggestChallenge: profile.biggest_challenge as string | null,
        studyChallenges: (profile.study_challenges as string[] | null) ?? [],
        goalRanking: (profile.goal_ranking as string[]) ?? [],
        memoryScore: profile.memory_score as number | null,
        sessionLengthMinutes: profile.session_length_minutes as number,
      });
      rulesTopTechnique = scoring.topTechnique as TechniqueKey;
      rulesConfidence = scoring.confidence;
      confidenceLevel = scoring.confidenceLevel;
    }

    // Compute this user's session completion rate for ML features.
    const [allSessionsRes] = await Promise.all([
      supabase
        .from("sessions")
        .select("status")
        .eq("user_id", user.id)
        .in("status", ["completed", "missed"]),
    ]);
    const allSessions = allSessionsRes.data ?? [];
    const completedCount = allSessions.filter((s) => s.status === "completed").length;
    const completionRate = allSessions.length > 0 ? completedCount / allSessions.length : null;
    const avgConfidence =
      subjectIntelligence.length > 0
        ? subjectIntelligence.reduce((s, si) => s + (si.confidencePct ?? 50), 0) /
          subjectIntelligence.length
        : null;

    // Fetch KNN training examples using service role (bypasses RLS to read other users).
    const trainingExamples: TrainingExample[] = [];
    try {
      const svc = createServiceClient();
      const { data: otherProfiles } = await svc
        .from("profiles")
        .select("id, age_band, memory_score, study_habits, personalization_answers")
        .neq("id", user.id)
        .not("personalization_answers", "is", null)
        .limit(200);

      if (otherProfiles && otherProfiles.length > 0) {
        // For each other user, compute their technique label from their answers.
        const otherUserIds = otherProfiles.map((p) => p.id as string);

        // Get completion rates per user (single query).
        const { data: otherSessions } = await svc
          .from("sessions")
          .select("user_id, status")
          .in("user_id", otherUserIds)
          .in("status", ["completed", "missed"]);

        const completionByUser = new Map<string, { done: number; total: number }>();
        for (const s of (otherSessions ?? [])) {
          const uid = s.user_id as string;
          const cur = completionByUser.get(uid) ?? { done: 0, total: 0 };
          cur.total++;
          if (s.status === "completed") cur.done++;
          completionByUser.set(uid, cur);
        }

        // Get avg confidence per user.
        const { data: otherSubjects } = await svc
          .from("subjects")
          .select("user_id, confidence_pct")
          .in("user_id", otherUserIds)
          .not("confidence_pct", "is", null);

        const confByUser = new Map<string, number[]>();
        for (const s of (otherSubjects ?? [])) {
          const uid = s.user_id as string;
          const cur = confByUser.get(uid) ?? [];
          cur.push(s.confidence_pct as number);
          confByUser.set(uid, cur);
        }

        for (const p of otherProfiles) {
          try {
            const uid = p.id as string;
            const cr = completionByUser.get(uid);
            const crVal = cr && cr.total > 0 ? cr.done / cr.total : null;
            const confArr = confByUser.get(uid) ?? [];
            const avgConf = confArr.length > 0
              ? confArr.reduce((a, b) => a + b, 0) / confArr.length
              : null;

            const scoring = scorePersonalization(
              p.personalization_answers as PersonalizationAnswers,
            );
            trainingExamples.push({
              features: encodeFeatures({
                ageBand: p.age_band as string | null,
                memoryScore: p.memory_score as number | null,
                studyHabits: (p.study_habits as string[]) ?? [],
                completionRate: crVal,
                avgConfidence: avgConf,
              }),
              technique: scoring.topTechnique as TechniqueKey,
            });
          } catch {
            // Skip malformed rows.
          }
        }
      }
    } catch {
      // Service role unavailable (local dev without .env) — silently skip KNN.
    }

    // Hybrid technique selection.
    const hybrid: HybridTechniqueResult = selectTechnique({
      target: {
        ageBand: profile?.age_band as string | null,
        memoryScore: profile?.memory_score as number | null,
        studyHabits: (profile?.study_habits as string[]) ?? [],
        completionRate,
        avgConfidence,
      },
      examples: trainingExamples,
      rulesTopTechnique,
      rulesConfidence,
    });

    mlSource = hybrid.source;
    const finalTechnique = hybrid.technique;
    // Translate ML system confidence to UI presentation confidence level.
    const mlConfidenceLevel: "high" | "medium" | "low" =
      hybrid.systemConfidence >= 60 ? "high" : hybrid.systemConfidence >= 35 ? "medium" : "low";
    const finalConfidenceLevel =
      hybrid.source === "ml" ? mlConfidenceLevel : confidenceLevel;

    recommendationPresentation = getRecommendationPresentation(finalConfidenceLevel);
    recommendation = buildTodayRecommendation(
      subjectIntelligence,
      finalTechnique,
      profile?.session_length_minutes as number,
      localNow.dateString,
      topicMasteryMap,
    );
  } catch {
    // Non-fatal — recommendation is optional
  }

  // Practice recommendation: show when there's ready coursework AND at least one weak topic.
  const hasWeakTopic = (masteryRes.data ?? []).some((m) => (m.mastery_pct as number) < 50);
  const topReadyCoursework = (courseworkReadyRes.data ?? [])[0] ?? null;
  const showPracticeCard = topReadyCoursework !== null && hasWeakTopic;

  type TaskRow = {
    id: string;
    task_type: string;
    title: string | null;
    due_date: string | null;
    priority: string;
    subject: { name: string } | { name: string }[] | null;
  };

  const upcomingTasks = ((tasksRes.data ?? []) as TaskRow[])
    .filter((t) => t.title)
    .map((t) => {
      const subj = Array.isArray(t.subject) ? t.subject[0] : t.subject;
      const dueDays = t.due_date
        ? Math.round(
            (new Date(`${t.due_date}T00:00:00Z`).getTime() -
              new Date(`${localNow.dateString}T00:00:00Z`).getTime()) /
              86_400_000,
          )
        : null;
      return {
        id: t.id,
        taskType: t.task_type,
        title: t.title as string,
        subjectName: (subj?.name as string | undefined) ?? "",
        dueDate: t.due_date,
        dueDays,
        priority: t.priority as "low" | "medium" | "high",
      };
    });

  return (
    <main className="w-full max-w-3xl mx-auto px-container-margin py-stack-lg flex flex-col gap-stack-md">
      <header className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 border-b border-outline-variant pb-stack-sm">
        <div>
          <h1 className="font-headline-lg-mobile md:font-headline-lg text-headline-lg-mobile md:text-headline-lg text-primary">
            {ageBandUI.greeting(greetingName)}
          </h1>
          <div className="flex items-center gap-3 mt-1 flex-wrap">
            <p className="font-body-lg text-body-lg text-on-surface-variant">
              {dateLabel}
            </p>
            {studyStreak >= 2 && (
              <span
                className="font-label-sm text-label-sm bg-secondary/10 text-secondary border border-secondary/20 rounded-full px-2 py-0.5"
                title={`${studyStreak}-day study streak`}
              >
                {studyStreak} day streak
              </span>
            )}
          </div>
          {topGoal && (
            <p className="font-label-sm text-label-sm text-on-surface-variant mt-1">
              Studying towards: {topGoal}
            </p>
          )}
        </div>
        {nextExam && daysToExam !== null && (
          <div className="bg-surface-container-lowest border border-outline-variant rounded-lg px-4 py-2 flex items-center gap-3 self-start md:self-auto shadow-sm">
            <span
              className="material-symbols-outlined text-secondary"
              style={{ fontVariationSettings: "'FILL' 1" }}
              aria-hidden="true"
            >
              timer
            </span>
            <div>
              <p className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider">
                Upcoming exam
              </p>
              <p className="font-headline-md text-headline-md text-primary">
                {daysToExam === 0
                  ? `${nextExam.name} — today!`
                  : daysToExam === 1
                  ? `${nextExam.name} — tomorrow`
                  : `${nextExam.name} in ${daysToExam} days`}
              </p>
            </div>
          </div>
        )}
      </header>

      {recommendation && (
        <section className="border border-outline-variant rounded-xl p-4 bg-surface-container-lowest">
          <div className="flex items-center justify-between mb-2">
            <p className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider">
              {recommendationPresentation.eyebrow}
            </p>
            {mlSource === "ml" && (
              <span className="font-label-sm text-label-sm text-secondary bg-secondary/10 border border-secondary/20 rounded-full px-2 py-0.5">
                Personalised
              </span>
            )}
          </div>
          <div className="flex items-start justify-between gap-3 mb-1">
            <p className="font-headline-md text-headline-md text-on-surface">
              {recommendation.subjectName}
              {recommendation.topicName && (
                <span className="text-on-surface-variant"> · {recommendation.topicName}</span>
              )}
              {" — "}{recommendation.techniqueLabel}
            </p>
            <span className="font-label-sm text-label-sm text-on-surface-variant shrink-0 mt-1">
              {recommendation.durationMinutes} min
            </span>
          </div>
          <p className={
            ageBandUI.uiDensity === "simple"
              ? "font-body-lg text-body-lg text-on-surface-variant mb-3"
              : "font-body-md text-body-md text-on-surface-variant mb-3"
          }>
            {recommendation.rationale}
          </p>
          <p className="font-label-md text-label-md text-primary border border-primary/30 bg-primary/5 rounded-lg px-3 py-2 inline-block">
            {recommendation.sessionInstruction}
          </p>
          {recommendationPresentation.note && (
            <p className="font-body-sm text-body-sm text-on-surface-variant mt-3 pt-3 border-t border-outline-variant">
              {recommendationPresentation.note}
            </p>
          )}
        </section>
      )}

      {showPracticeCard && topReadyCoursework && (
        <section className="border border-primary/30 bg-primary/5 rounded-xl p-4 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="font-label-sm text-label-sm text-primary uppercase tracking-wider mb-1">
              Practice from your notes
            </p>
            <p className="font-headline-md text-headline-md text-on-surface">
              {(topReadyCoursework.subject_name as string | null) ?? topReadyCoursework.title as string}
            </p>
            <p className="font-body-sm text-body-sm text-on-surface-variant mt-0.5">
              You have topics where practice would help — use your uploaded material.
            </p>
          </div>
          <Link
            href={`/coursework/${topReadyCoursework.id as string}`}
            className="shrink-0 bg-primary text-on-primary font-label-md text-label-md px-4 py-2 rounded-full"
          >
            Start
          </Link>
        </section>
      )}

      {isFirstPlan && (
        <div className="rounded-xl border border-secondary/25 bg-secondary/5 px-5 py-4 flex flex-col gap-1">
          <p className="font-headline-md text-headline-md text-on-surface">Your plan is ready.</p>
          <p className="font-body-md text-body-md text-on-surface-variant">Pace has built your first study schedule. Sessions below are your starting point — they&rsquo;ll adapt as you go.</p>
        </div>
      )}

      {sessionsError ? (
        <div className="w-full bg-error/5 border border-error/20 rounded-xl p-stack-lg flex flex-col items-center gap-stack-sm text-center">
          <span
            className="material-symbols-outlined text-3xl text-error"
            aria-hidden="true"
          >
            error_outline
          </span>
          <h2 className="font-headline-md text-headline-md text-on-surface">
            Couldn&rsquo;t load today&rsquo;s sessions
          </h2>
          <p className="font-body-md text-body-md text-on-surface-variant max-w-sm">
            Something went wrong. Try refreshing the page.
          </p>
        </div>
      ) : cards.length > 0 ? (
        <section className="flex flex-col gap-3">
          <h2 className="font-headline-md text-headline-md text-on-surface">
            Study sessions
          </h2>
          {allDone && (
            <div className="rounded-xl border border-primary/25 bg-primary/5 px-5 py-4 flex flex-col gap-1">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-primary" style={{ fontVariationSettings: "'FILL' 1" }} aria-hidden="true">check_circle</span>
                <p className="font-headline-md text-headline-md text-primary">That&rsquo;s today done.</p>
              </div>
              <p className="font-body-md text-body-md text-on-surface-variant">Every session completed. Tomorrow&rsquo;s plan is ready when you need it.</p>
            </div>
          )}
          {cards.map((c) => {
            const { rationale, topicId: _topicId, ...cardProps } = c;
            return (
              <div key={c.id} className="flex flex-col gap-1">
                <SessionCard {...cardProps} />
                {rationale && (
                  <p className="font-body-sm text-body-sm text-on-surface-variant px-1">
                    {rationale}
                  </p>
                )}
              </div>
            );
          })}
        </section>
      ) : hasSubjects ? (
        <div className="w-full bg-surface-container-lowest border border-outline-variant rounded-xl p-stack-lg flex flex-col items-center gap-stack-sm text-center">
          <div className="w-16 h-16 rounded-full bg-surface-container-low flex items-center justify-center">
            <span
              className="material-symbols-outlined text-3xl text-secondary"
              style={{ fontVariationSettings: "'wght' 300" }}
              aria-hidden="true"
            >
              wb_sunny
            </span>
          </div>
          <h2 className="font-headline-md text-headline-md text-on-surface">
            Free day
          </h2>
          <p className="font-body-md text-body-md text-on-surface-variant max-w-sm">
            {recommendation
              ? "No sessions scheduled today. Rest up, or try the suggestion above."
              : "No sessions scheduled today. Rest up — you've earned it."}
          </p>
        </div>
      ) : (
        <div className="w-full bg-surface-container-lowest border border-outline-variant rounded-xl p-stack-lg flex flex-col items-center gap-stack-sm text-center">
          <div className="w-16 h-16 rounded-full bg-surface-container-low flex items-center justify-center">
            <span
              className="material-symbols-outlined text-3xl text-secondary"
              style={{ fontVariationSettings: "'wght' 300" }}
              aria-hidden="true"
            >
              edit_calendar
            </span>
          </div>
          <h2 className="font-headline-md text-headline-md text-on-surface">
            No study plan yet
          </h2>
          <p className="font-body-md text-body-md text-on-surface-variant max-w-sm">
            Add your subjects and exam dates to generate your first plan.
          </p>
          <Link
            href="/subjects"
            className="font-label-md text-label-md bg-primary text-on-primary px-5 py-2 rounded-full mt-2"
          >
            Add subjects
          </Link>
        </div>
      )}

      {upcomingTasks.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="font-headline-md text-headline-md text-on-surface">
            Upcoming tasks
          </h2>
          <div className="flex flex-col gap-2">
            {upcomingTasks.map((t) => {
              const dueBadge =
                t.dueDays === null
                  ? null
                  : t.dueDays < 0
                  ? { label: "overdue", cls: "text-error bg-error/10 border-error/30" }
                  : t.dueDays === 0
                  ? { label: "due today", cls: "text-error bg-error/10 border-error/30" }
                  : t.dueDays === 1
                  ? { label: "due tomorrow", cls: "text-tertiary bg-tertiary/10 border-tertiary/30" }
                  : t.dueDays <= 7
                  ? { label: `${t.dueDays}d`, cls: "text-tertiary bg-tertiary/10 border-tertiary/30" }
                  : { label: `${t.dueDays}d`, cls: "text-on-surface-variant bg-surface-container border-outline-variant" };
              const typeLabel = t.taskType.replace(/_/g, " ");
              return (
                <div
                  key={t.id}
                  className="flex items-center justify-between gap-3 border border-outline-variant rounded-lg px-4 py-3 bg-surface-container-lowest"
                >
                  <div className="flex flex-col gap-0.5 min-w-0">
                    <span className="font-body-md text-body-md text-on-surface truncate">
                      {t.title}
                    </span>
                    <span className="font-label-sm text-label-sm text-on-surface-variant capitalize">
                      {t.subjectName} · {typeLabel}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {t.priority === "high" && (
                      <span
                        className="material-symbols-outlined text-base text-error"
                        style={{ fontVariationSettings: "'FILL' 1" }}
                        aria-label="High priority"
                      >
                        priority_high
                      </span>
                    )}
                    {dueBadge && (
                      <span
                        className={`font-label-sm text-label-sm border rounded-full px-2 py-0.5 ${dueBadge.cls}`}
                      >
                        {dueBadge.label}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}
    </main>
  );
}
