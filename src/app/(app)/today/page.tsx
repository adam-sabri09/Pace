import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { SessionCard, type SessionStatus } from "@/components/session-card";
import { localWallClockToUTC, utcToLocalParts } from "@/server/llm/time";
import { PersonalizationCta } from "@/components/personalization-cta";
import { buildTodayRecommendation } from "@/lib/personalization/recommender";
import { scorePersonalization } from "@/lib/personalization/scoring";
import { getRecommendationPresentation } from "@/lib/personalization/recommendation-presentation";
import type { PersonalizationAnswers, SubjectIntelligence, TechniqueKey } from "@/lib/personalization/types";

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
      "first_name, session_length_minutes, time_zone, personalization_completed_at, personalization_skipped, personalization_answers, age_group",
    )
    .eq("id", user.id)
    .maybeSingle();

  if (profile?.session_length_minutes == null) redirect("/onboarding");

  const timeZone = profile?.time_zone ?? "UTC";
  const greetingName = profile?.first_name?.trim() || "friend";

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

  const [examRes, sessionsRes, subjectsRes] = await Promise.all([
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
        "id, starts_at, duration_minutes, instruction, status, topic:topics(name, subject:subjects(name))",
      )
      .eq("user_id", user.id)
      .gte("starts_at", dayStartUTC)
      .lte("starts_at", dayEndUTC)
      .order("starts_at", { ascending: true }),
    supabase
      .from("subjects")
      .select("id, name, exam_date, difficulty, confidence_pct")
      .eq("user_id", user.id),
  ]);

  const nextExam = examRes.data?.[0] ?? null;
  const daysToExam = nextExam
    ? Math.max(
        1,
        Math.round(
          (new Date(`${nextExam.exam_date}T00:00:00Z`).getTime() -
            new Date(`${localNow.dateString}T00:00:00Z`).getTime()) /
            (24 * 60 * 60 * 1000),
        ),
      )
    : null;

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
    return {
      id: s.id as string,
      status: s.status as SessionStatus,
      subjectName: (subject?.name as string | undefined) ?? "Session",
      topicName: (topic?.name as string | undefined) ?? "Study session",
      timeRange: `${start.timeString} – ${end.timeString}`,
      durationMinutes: s.duration_minutes as number,
      instruction: s.instruction as string,
    };
  });

  const dateLabel = new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    timeZone,
  }).format(now);

  // -------------------------------------------------------------------------
  // Personalization
  // -------------------------------------------------------------------------
  const isPersonalized = !!profile?.personalization_completed_at;
  const isSkipped = !!profile?.personalization_skipped;
  const showCta = !isPersonalized && !isSkipped;

  let recommendation = null;
  let recommendationPresentation = getRecommendationPresentation("low");
  if (isPersonalized && profile?.personalization_answers) {
    try {
      const answers = profile.personalization_answers as PersonalizationAnswers;
      const scoring = scorePersonalization(answers);
      recommendationPresentation = getRecommendationPresentation(scoring.confidenceLevel);
      const subjectIntelligence: SubjectIntelligence[] = (subjectsRes.data ?? []).map((s) => ({
        subjectId: s.id as string,
        subjectName: s.name as string,
        difficulty: (s.difficulty as "easy" | "medium" | "hard" | null) ?? null,
        confidencePct: (s.confidence_pct as number | null) ?? null,
        examDate: (s.exam_date as string | null) ?? null,
      }));
      recommendation = buildTodayRecommendation(
        subjectIntelligence,
        scoring.topTechnique as TechniqueKey,
        profile.session_length_minutes as number,
        localNow.dateString,
      );
    } catch {
      // Non-fatal — recommendation is optional
    }
  }

  return (
    <main className="w-full max-w-3xl mx-auto px-container-margin py-stack-lg flex flex-col gap-stack-md">
      <header className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 border-b border-outline-variant pb-stack-sm">
        <div>
          <h1 className="font-headline-lg-mobile md:font-headline-lg text-headline-lg-mobile md:text-headline-lg text-primary">
            Good day, {greetingName}.
          </h1>
          <p className="font-body-lg text-body-lg text-on-surface-variant mt-1">
            {dateLabel}
          </p>
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
                {nextExam.name} in {daysToExam} day{daysToExam === 1 ? "" : "s"}
              </p>
            </div>
          </div>
        )}
      </header>

      {showCta && <PersonalizationCta />}

      {recommendation && (
        <section className="border border-outline-variant rounded-xl p-4 bg-surface-container-lowest">
          <p className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider mb-2">
            {recommendationPresentation.eyebrow}
          </p>
          <div className="flex items-start justify-between gap-3 mb-1">
            <p className="font-headline-md text-headline-md text-on-surface">
              {recommendation.subjectName} — {recommendation.techniqueLabel}
            </p>
            <span className="font-label-sm text-label-sm text-on-surface-variant shrink-0 mt-1">
              {recommendation.durationMinutes} min
            </span>
          </div>
          <p className="font-body-md text-body-md text-on-surface-variant mb-3">
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

      {cards.length > 0 ? (
        <section className="flex flex-col gap-3">
          <h2 className="font-headline-md text-headline-md text-on-surface">
            Study sessions
          </h2>
          {cards.map((c) => (
            <SessionCard key={c.id} {...c} />
          ))}
        </section>
      ) : (
        <div className="w-full bg-surface-container-lowest border border-outline-variant rounded-xl p-stack-lg flex flex-col items-center gap-stack-sm text-center">
          <div className="w-16 h-16 rounded-full bg-surface-container-low flex items-center justify-center">
            <span
              className="material-symbols-outlined text-3xl text-secondary"
              style={{ fontVariationSettings: "'wght' 300" }}
              aria-hidden="true"
            >
              check_circle
            </span>
          </div>
          <h2 className="font-headline-md text-headline-md text-on-surface">
            You&rsquo;re all clear today
          </h2>
          <p className="font-body-md text-body-md text-on-surface-variant max-w-sm">
            No sessions scheduled. Rest up, review, or plan ahead.
          </p>
        </div>
      )}
    </main>
  );
}
