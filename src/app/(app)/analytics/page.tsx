import { redirect } from "next/navigation";
import Link from "next/link";

import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Analytics — Pace" };

export default async function AnalyticsPage() {
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
  const timeZone = (profile?.time_zone as string | null) ?? "UTC";

  const [practiceSessionsRes, practiceAttemptsRes, masteryRes, topicsRes] = await Promise.all([
    supabase
      .from("practice_sessions")
      .select("id, created_at, completed_at, subject_name, topic_name, questions_answered, correct_count, status")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(100),
    supabase
      .from("practice_attempts")
      .select("is_correct, response_time_ms, difficulty, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(500),
    supabase
      .from("topic_mastery")
      .select("topic_id, mastery_pct, sessions_completed, sessions_total, last_session_at")
      .eq("user_id", user.id)
      .order("mastery_pct", { ascending: false }),
    supabase
      .from("topics")
      .select("id, name, subject:subjects(name)")
      .eq("user_id", user.id),
  ]);

  const sessions = practiceSessionsRes.data ?? [];
  const attempts = practiceAttemptsRes.data ?? [];
  const masteryRows = masteryRes.data ?? [];
  const topics = topicsRes.data ?? [];

  // Topic name lookup
  const topicNameMap = new Map<string, string>();
  for (const t of topics) {
    const subj = Array.isArray(t.subject) ? t.subject[0] : t.subject;
    topicNameMap.set(t.id as string, `${subj?.name ?? ""} · ${t.name as string}`);
  }

  // Overall stats
  const completedSessions = sessions.filter((s) => s.status === "completed");
  const totalQuestions = attempts.length;
  const totalCorrect = attempts.filter((a) => a.is_correct).length;
  const overallAccuracy =
    totalQuestions > 0 ? Math.round((totalCorrect / totalQuestions) * 100) : null;

  const timesMs = attempts
    .map((a) => a.response_time_ms as number | null)
    .filter((t): t is number => t !== null && t > 0);
  const avgResponseSec =
    timesMs.length > 0
      ? Math.round(timesMs.reduce((a, b) => a + b, 0) / timesMs.length / 1000)
      : null;

  // Practice streak — consecutive calendar days with at least one attempt, in the user's timezone
  const fmt = new Intl.DateTimeFormat('en-CA', { timeZone });
  const daysSeen = new Set(
    attempts.map((a) => fmt.format(new Date(a.created_at as string))),
  );
  let streak = 0;
  const today = fmt.format(new Date());
  let cursor = today;
  while (daysSeen.has(cursor)) {
    streak++;
    const d = new Date(`${cursor}T12:00:00Z`);
    d.setUTCDate(d.getUTCDate() - 1);
    cursor = fmt.format(d);
  }

  // Mastery — strongest and weakest
  const masteryWithNames = masteryRows.map((m) => ({
    topicId: m.topic_id as string,
    mastery: m.mastery_pct as number,
    sessionsCompleted: m.sessions_completed as number,
    sessionsTotal: m.sessions_total as number,
    name: topicNameMap.get(m.topic_id as string) ?? "Unknown topic",
  }));

  const strongest = masteryWithNames.slice(0, 5);
  const weakest = [...masteryWithNames].sort((a, b) => a.mastery - b.mastery).slice(0, 5);

  // Weekly summary (last 7 days)
  const last7 = new Date();
  last7.setDate(last7.getDate() - 6);
  const recentAttempts = attempts.filter(
    (a) => new Date(a.created_at as string) >= last7,
  );
  const recentCorrect = recentAttempts.filter((a) => a.is_correct).length;
  const recentAccuracy =
    recentAttempts.length > 0
      ? Math.round((recentCorrect / recentAttempts.length) * 100)
      : null;

  const hasData = totalQuestions > 0;

  return (
    <main className="w-full max-w-3xl mx-auto px-container-margin py-stack-lg flex flex-col gap-stack-md">
      <header className="border-b border-outline-variant pb-stack-sm">
        <h1 className="font-headline-lg-mobile md:font-headline-lg text-headline-lg-mobile md:text-headline-lg text-on-surface">
          Practice analytics
        </h1>
        <p className="font-body-md text-body-md text-on-surface-variant mt-1">
          How your coursework practice is building mastery over time.
        </p>
      </header>

      {!hasData ? (
        <div className="flex flex-col items-center gap-stack-sm text-center py-stack-lg">
          <span
            className="material-symbols-outlined text-4xl text-on-surface-variant"
            aria-hidden="true"
          >
            insights
          </span>
          <h2 className="font-headline-md text-headline-md text-on-surface">No practice data yet</h2>
          <p className="font-body-md text-body-md text-on-surface-variant max-w-sm">
            Upload some study material and complete a practice session to see your progress here.
          </p>
          <Link
            href="/coursework"
            className="bg-primary text-on-primary font-label-lg text-label-lg px-6 py-2.5 rounded-full"
          >
            Go to Coursework
          </Link>
        </div>
      ) : (
        <>
          {/* KPI row */}
          <section className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <KpiCard label="Questions answered" value={String(totalQuestions)} />
            <KpiCard
              label="Overall accuracy"
              value={overallAccuracy !== null ? `${overallAccuracy}%` : "—"}
            />
            <KpiCard
              label="Avg response time"
              value={avgResponseSec !== null ? `${avgResponseSec}s` : "—"}
            />
            <KpiCard
              label="Practice streak"
              value={streak > 0 ? `${streak}d` : "—"}
              sub={streak > 0 ? "consecutive days" : "no streak yet"}
            />
          </section>

          {/* This week */}
          <section className="border border-outline-variant rounded-xl p-4 bg-surface-container-lowest">
            <h2 className="font-headline-md text-headline-md text-on-surface mb-3">This week</h2>
            <div className="flex gap-stack-md flex-wrap">
              <div>
                <p className="font-label-sm text-label-sm text-on-surface-variant">Questions</p>
                <p className="font-headline-lg text-headline-lg text-primary">
                  {recentAttempts.length}
                </p>
              </div>
              <div>
                <p className="font-label-sm text-label-sm text-on-surface-variant">Accuracy</p>
                <p className="font-headline-lg text-headline-lg text-primary">
                  {recentAccuracy !== null ? `${recentAccuracy}%` : "—"}
                </p>
              </div>
              <div>
                <p className="font-label-sm text-label-sm text-on-surface-variant">Sessions</p>
                <p className="font-headline-lg text-headline-lg text-primary">
                  {
                    completedSessions.filter(
                      (s) => new Date(s.created_at as string) >= last7,
                    ).length
                  }
                </p>
              </div>
            </div>
          </section>

          {/* Topic mastery */}
          {masteryWithNames.length > 0 && (
            <section className="grid md:grid-cols-2 gap-4">
              {strongest.length > 0 && (
                <div className="flex flex-col gap-2">
                  <h2 className="font-headline-md text-headline-md text-on-surface">
                    Strongest topics
                  </h2>
                  {strongest.map((m) => (
                    <MasteryBar key={m.topicId} name={m.name} mastery={m.mastery} />
                  ))}
                </div>
              )}
              {weakest.length > 0 && (
                <div className="flex flex-col gap-2">
                  <h2 className="font-headline-md text-headline-md text-on-surface">
                    Needs practice
                  </h2>
                  {weakest.map((m) => (
                    <MasteryBar key={m.topicId} name={m.name} mastery={m.mastery} weak />
                  ))}
                </div>
              )}
            </section>
          )}

          {/* Recent sessions */}
          {completedSessions.length > 0 && (
            <section className="flex flex-col gap-2">
              <h2 className="font-headline-md text-headline-md text-on-surface">
                Recent sessions
              </h2>
              {completedSessions.slice(0, 10).map((s) => {
                const qa = s.questions_answered as number;
                const cc = s.correct_count as number;
                const acc = qa > 0 ? Math.round((cc / qa) * 100) : 0;
                const date = new Date(s.created_at as string).toLocaleDateString(undefined, {
                  month: "short",
                  day: "numeric",
                });
                return (
                  <div
                    key={s.id as string}
                    className="border border-outline-variant rounded-xl px-4 py-3 bg-surface-container-lowest flex items-center justify-between gap-3"
                  >
                    <div>
                      <p className="font-headline-sm text-headline-sm text-on-surface">
                        {(s.subject_name as string | null) ?? "Practice"}
                      </p>
                      {s.topic_name && (
                        <p className="font-body-sm text-body-sm text-on-surface-variant">
                          {s.topic_name as string}
                        </p>
                      )}
                    </div>
                    <div className="text-right shrink-0">
                      <p className="font-headline-sm text-headline-sm text-primary">{acc}%</p>
                      <p className="font-label-sm text-label-sm text-on-surface-variant">
                        {cc}/{qa} · {date}
                      </p>
                    </div>
                  </div>
                );
              })}
            </section>
          )}
        </>
      )}
    </main>
  );
}

function KpiCard({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="border border-outline-variant rounded-xl px-4 py-3 bg-surface-container-lowest flex flex-col gap-0.5">
      <p className="font-label-sm text-label-sm text-on-surface-variant">{label}</p>
      <p className="font-headline-md text-headline-md text-primary">{value}</p>
      {sub && <p className="font-label-sm text-label-sm text-outline">{sub}</p>}
    </div>
  );
}

function MasteryBar({
  name,
  mastery,
  weak = false,
}: {
  name: string;
  mastery: number;
  weak?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between gap-2">
        <p className="font-body-sm text-body-sm text-on-surface truncate">{name}</p>
        <span className="font-label-sm text-label-sm text-on-surface-variant shrink-0">
          {mastery}%
        </span>
      </div>
      <div className="w-full bg-surface-container-low rounded-full h-1.5">
        <div
          className={`h-1.5 rounded-full transition-all ${weak ? "bg-error" : "bg-primary"}`}
          style={{ width: `${mastery}%` }}
        />
      </div>
    </div>
  );
}
