import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { utcToLocalParts } from "@/server/llm/time";
import {
  computeSubjectProgress,
  type SubjectProgressData,
} from "@/lib/progress";
import { ClearPastExamsButton } from "@/components/plan/clear-past-exams-button";

/**
 * /plan — full timeline grouped by day (DESIGN-SPEC §3.8).
 *
 * Shows a "Your subjects" progress section (per-subject exam countdown +
 * session completion) above the existing day-by-day session timeline.
 */
export default async function PlanPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("session_length_minutes, time_zone")
    .eq("id", user.id)
    .maybeSingle();

  if (profile?.session_length_minutes == null) redirect("/onboarding");
  const timeZone = profile?.time_zone ?? "UTC";

  const now = new Date();
  const today = utcToLocalParts(now, timeZone).dateString;

  // Run all data queries in parallel.
  const [
    { data: sessions },
    { data: rawSubjects },
    { count: passedExamCount },
    { data: activePlan },
  ] = await Promise.all([
    supabase
      .from("sessions")
      .select(
        "id, starts_at, duration_minutes, instruction, status, topic:topics(name, subject:subjects(name))",
      )
      .eq("user_id", user.id)
      .order("starts_at", { ascending: true }),
    // Subjects with exam dates: nested topics → sessions so we can count progress.
    supabase
      .from("subjects")
      .select("id, name, exam_date, topics(sessions(status))")
      .eq("user_id", user.id)
      .not("exam_date", "is", null)
      .order("exam_date", { ascending: true }),
    // Count subjects with exam dates in the past (for the "Clear past exams" button).
    supabase
      .from("subjects")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .not("exam_date", "is", null)
      .lt("exam_date", today),
    // Active plan warnings are stored as JSONB on the plan row.
    supabase
      .from("plans")
      .select("warnings")
      .eq("user_id", user.id)
      .eq("is_active", true)
      .maybeSingle(),
  ]);

  // Transform raw Supabase rows (untyped) into the shape computeSubjectProgress expects.
  const warnings = (
    activePlan?.warnings as
      | Array<{ subjectName: string; topicName: string; message: string }>
      | null
  ) ?? [];

  const subjectsForProgress = (rawSubjects ?? []).map((s) => ({
    id: s.id as string,
    name: s.name as string,
    examDate: s.exam_date as string,
    topics: (
      (s.topics as Array<{
        sessions: Array<{ status: string }>;
      }> | null) ?? []
    ).map((t) => ({
      sessions: (t.sessions as Array<{ status: string }> | null) ?? [],
    })),
  }));

  const subjectProgress = computeSubjectProgress(
    subjectsForProgress,
    warnings,
    today,
  );

  // Group sessions by local date for the timeline.
  const groups = new Map<
    string,
    Array<{
      id: string;
      status: "scheduled" | "completed" | "missed";
      subjectName: string;
      topicName: string;
      timeRange: string;
      durationMinutes: number;
      instruction: string;
    }>
  >();
  for (const s of sessions ?? []) {
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
    const date = start.dateString;
    if (!groups.has(date)) groups.set(date, []);
    groups.get(date)!.push({
      id: s.id as string,
      status: s.status as "scheduled" | "completed" | "missed",
      subjectName: (subject?.name as string | undefined) ?? "Session",
      topicName: (topic?.name as string | undefined) ?? "Study session",
      timeRange: `${start.timeString} – ${end.timeString}`,
      durationMinutes: s.duration_minutes as number,
      instruction: s.instruction as string,
    });
  }

  const dateFormatter = new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
    timeZone,
  });
  const dateLabel = (date: string): string => {
    if (date === today) return "Today";
    const parsed = new Date(`${date}T12:00:00Z`);
    return dateFormatter.format(parsed);
  };

  const sortedDates = [...groups.keys()].sort();
  const hasAny = sortedDates.length > 0;

  return (
    <main className="w-full max-w-3xl mx-auto px-container-margin py-stack-lg flex flex-col gap-stack-md">
      <header className="border-b border-outline-variant pb-stack-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="font-headline-lg-mobile md:font-headline-lg text-headline-lg-mobile md:text-headline-lg text-on-surface">
              Study Plan
            </h1>
            <p className="font-body-md text-body-md text-on-surface-variant mt-1">
              Your schedule, grouped by day.
            </p>
          </div>
          <ClearPastExamsButton passedCount={passedExamCount ?? 0} />
        </div>
      </header>

      {/* Subject progress section */}
      <SubjectProgressSection subjects={subjectProgress} />

      {/* Day-by-day timeline */}
      {hasAny ? (
        <div className="flex flex-col gap-stack-lg">
          {sortedDates.map((date) => {
            const past = date < today;
            return (
              <section key={date}>
                <h2
                  className={
                    "font-headline-md text-headline-md mb-stack-sm border-b border-outline-variant pb-2 " +
                    (past ? "text-on-surface-variant" : "text-on-surface")
                  }
                >
                  {dateLabel(date)}
                </h2>
                <ul className="flex flex-col gap-3">
                  {groups.get(date)!.map((s) => {
                    const muted = s.status !== "scheduled" || past;
                    return (
                      <li
                        key={s.id}
                        className={
                          "relative pl-6 " + (muted ? "opacity-70" : "")
                        }
                      >
                        <span
                          className="absolute left-0 top-4 bottom-4 w-px bg-outline-variant"
                          aria-hidden="true"
                        />
                        <span
                          className="absolute left-[-5px] top-4 w-3 h-3 rounded-full bg-surface border-2 border-outline-variant"
                          aria-hidden="true"
                        />
                        <div className="bg-surface-container-lowest border border-outline-variant rounded-lg p-4">
                          <div className="flex justify-between items-start mb-1 gap-3">
                            <div className="font-label-sm text-label-sm text-on-surface-variant">
                              {s.timeRange} · {s.durationMinutes} min
                            </div>
                            <span className="font-label-sm text-label-sm bg-secondary-container text-on-secondary-container px-2 py-1 rounded shrink-0">
                              {s.subjectName}
                            </span>
                          </div>
                          <h3
                            className={
                              "font-headline-md text-headline-md text-on-surface " +
                              (s.status === "completed" || s.status === "missed"
                                ? "line-through"
                                : "")
                            }
                          >
                            {s.topicName}
                          </h3>
                          <p className="font-body-md text-body-md text-on-surface-variant mt-1">
                            {s.instruction}
                          </p>
                          {s.status !== "scheduled" && (
                            <p className="font-label-sm text-label-sm mt-1 tracking-wider uppercase text-outline">
                              {s.status === "completed"
                                ? "Completed"
                                : "Missed"}
                            </p>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </section>
            );
          })}
        </div>
      ) : (
        <div className="w-full bg-surface-container-lowest border border-outline-variant rounded-xl p-stack-lg flex flex-col items-center gap-stack-sm text-center">
          <h2 className="font-headline-md text-headline-md text-on-surface">
            No plan yet
          </h2>
          <p className="font-body-md text-body-md text-on-surface-variant max-w-sm">
            Finish onboarding to generate your plan.
          </p>
        </div>
      )}
    </main>
  );
}

// ---------------------------------------------------------------------------
// Subject progress section
// ---------------------------------------------------------------------------

function SubjectProgressSection({
  subjects,
}: {
  subjects: SubjectProgressData[];
}) {
  if (subjects.length === 0) return null;

  return (
    <section aria-labelledby="subject-progress-heading">
      <h2
        id="subject-progress-heading"
        className="font-headline-md text-headline-md text-on-surface mb-stack-sm"
      >
        Your subjects
      </h2>
      <ul className="flex flex-col gap-3">
        {subjects.map((s) => (
          <li key={s.id}>
            <SubjectProgressCard subject={s} />
          </li>
        ))}
      </ul>
    </section>
  );
}

function SubjectProgressCard({ subject }: { subject: SubjectProgressData }) {
  const { name, completedSessions, totalSessions, progressPct, daysToExam, hasWarning } =
    subject;

  const countdownLabel =
    daysToExam === 0
      ? "Today"
      : daysToExam > 0
        ? `${daysToExam} day${daysToExam === 1 ? "" : "s"} to go`
        : "Exam passed";

  type StatusKey = "on-track" | "warning" | "exam-today" | "exam-passed";
  const statusKey: StatusKey =
    daysToExam < 0
      ? "exam-passed"
      : daysToExam === 0
        ? "exam-today"
        : hasWarning
          ? "warning"
          : "on-track";

  const statusLabel: Record<StatusKey, string> = {
    "on-track": "On track",
    "warning": "Warning",
    "exam-today": "Exam today",
    "exam-passed": "Exam passed",
  };

  const statusCls: Record<StatusKey, string> = {
    "on-track":
      "bg-secondary-container text-on-secondary-container",
    "warning": "bg-error-container text-on-error-container",
    "exam-today": "bg-primary-container text-on-primary-container",
    "exam-passed": "bg-surface-container text-on-surface-variant",
  };

  const sessionLabel =
    totalSessions === 0
      ? "No sessions scheduled"
      : `${completedSessions} of ${totalSessions} session${totalSessions === 1 ? "" : "s"} done`;

  return (
    <article
      className="bg-surface-container-lowest border border-outline-variant rounded-lg p-4"
      data-testid="subject-progress-card"
      data-status={statusKey}
    >
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <h3 className="font-headline-md text-headline-md text-on-surface">
            {name}
          </h3>
          {hasWarning && (
            <p className="font-label-sm text-label-sm text-error flex items-center gap-1 mt-1">
              <span
                className="material-symbols-outlined text-[14px]"
                aria-hidden="true"
              >
                warning
              </span>
              May not have enough time before the exam
            </p>
          )}
        </div>
        <div className="text-right shrink-0">
          <p className="font-label-sm text-label-sm text-on-surface-variant mb-1">
            {countdownLabel}
          </p>
          <span
            className={
              "font-label-sm text-label-sm px-2 py-0.5 rounded inline-block " +
              statusCls[statusKey]
            }
          >
            {statusLabel[statusKey]}
          </span>
        </div>
      </div>

      {/* Progress bar */}
      <div
        className="h-2 bg-surface-container-highest rounded-full overflow-hidden mb-2"
        role="progressbar"
        aria-valuenow={progressPct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`${name} progress: ${progressPct}%`}
      >
        <div
          className="h-full bg-primary rounded-full"
          style={{ width: `${progressPct}%` }}
        />
      </div>

      <p className="font-body-sm text-body-sm text-on-surface-variant">
        {sessionLabel}
      </p>
    </article>
  );
}
