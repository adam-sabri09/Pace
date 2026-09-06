import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { LocalTime } from "@/components/LocalTime";
import { ClearErrorsButton } from "@/components/admin/ClearErrorsButton";
import { isAdminEmail } from "@/lib/auth/admin";

async function fetchStats() {
  const db = createServiceClient();

  const [
    { count: totalUsers },
    { count: newUsers },
    { count: onboardedUsers },
    aggregateRes,
    errorsRes,
    { count: totalCourseworkItems },
  ] = await Promise.all([
    db.from("profiles").select("*", { count: "exact", head: true }).then((r) => ({ count: r.count ?? 0 })),
    db.from("profiles").select("*", { count: "exact", head: true })
      .gte("created_at", new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
      .then((r) => ({ count: r.count ?? 0 })),
    db.from("profiles").select("*", { count: "exact", head: true })
      .not("session_length_minutes", "is", null)
      .then((r) => ({ count: r.count ?? 0 })),
    db.rpc("admin_get_aggregate_stats"),
    db.from("app_errors").select("id, created_at, error_type, message, context, user_id")
      .order("created_at", { ascending: false }).limit(15).then((r) => r),
    db.from("coursework_items").select("*", { count: "exact", head: true }).then((r) => ({ count: r.count ?? 0 })),
  ]);

  if (aggregateRes.error) throw new Error(`admin_get_aggregate_stats: ${aggregateRes.error.message}`);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const agg = aggregateRes.data as any;

  // Sessions
  const completedCount = Number(agg.sessions.completed);
  const missedCount    = Number(agg.sessions.missed);
  const scheduledCount = Number(agg.sessions.scheduled);
  const doneOrMissed   = completedCount + missedCount;
  const completionRate = doneOrMissed > 0 ? Math.round((completedCount / doneOrMissed) * 100) : null;

  // Subjects
  const totalSubjectEntries = Number(agg.subjects.total);
  const topSubjects: [string, number][] = (agg.subjects.top_names as { name: string; cnt: number }[]).map(
    (r) => [r.name, r.cnt],
  );
  const difficultyCounts: [string, number][] = [
    ["easy",   Number(agg.subjects.difficulty.easy)],
    ["medium", Number(agg.subjects.difficulty.medium)],
    ["hard",   Number(agg.subjects.difficulty.hard)],
    ["unset",  Number(agg.subjects.difficulty.unset)],
  ];
  const avgConfidence  = agg.subjects.avg_confidence != null ? Number(agg.subjects.avg_confidence) : null;
  const confidenceSet  = Number(agg.subjects.confidence_count);

  // Profiles / goals / habits
  const avgMemory       = agg.profiles.avg_memory != null ? Number(agg.profiles.avg_memory) : null;
  const memoryScoreCount = Number(agg.profiles.memory_count);
  const topGoals: [string, number][]  = (agg.profiles.top_goals  as { goal: string; cnt: number }[]).map((r) => [r.goal, r.cnt]);
  const topHabits: [string, number][] = (agg.profiles.top_habits as { habit: string; cnt: number }[]).map((r) => [r.habit, r.cnt]);
  const ageBandCounts: [string, number][] = (agg.profiles.age_bands as { age_band: string; cnt: number }[]).map((r) => [r.age_band, r.cnt]);

  // Practice
  const totalPracticeSessions  = Number(agg.practice.total_sessions);
  const totalQuestionsAnswered = Number(agg.practice.total_questions);
  const totalCorrect           = Number(agg.practice.total_correct);
  const avgPracticeAccuracy    = totalQuestionsAnswered > 0
    ? Math.round((totalCorrect / totalQuestionsAnswered) * 100)
    : null;

  const onboardingRate = (totalUsers as number) > 0
    ? Math.round(((onboardedUsers as number) / (totalUsers as number)) * 100)
    : null;

  const errors = errorsRes.data ?? [];
  const errorsUnavailable = !!errorsRes.error;

  return {
    totalUsers,
    newUsers,
    onboardedUsers,
    onboardingRate,
    completedCount,
    missedCount,
    scheduledCount,
    completionRate,
    totalSubjectEntries,
    topSubjects,
    difficultyCounts,
    avgConfidence,
    confidenceSet,
    totalSubjectsWithConfidence: totalSubjectEntries,
    ageBandCounts,
    avgMemory,
    memoryScoreCount,
    topGoals,
    topHabits,
    errors,
    errorsUnavailable,
    totalCourseworkItems: totalCourseworkItems as number,
    totalPracticeSessions,
    totalQuestionsAnswered,
    avgPracticeAccuracy,
  };
}

export default async function AdminPage() {
  // Auth check — the (app) layout already verified the user is logged in.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || !isAdminEmail(user.email)) {
    redirect("/today");
  }

  let stats: Awaited<ReturnType<typeof fetchStats>> | null = null;
  let statsError: string | null = null;
  try {
    stats = await fetchStats();
  } catch (e) {
    statsError = e instanceof Error ? e.message : "Failed to load stats.";
    console.error("[admin] fetchStats failed:", statsError);
  }

  const AGE_LABELS: Record<string, string> = {
    junior: "Junior",
    intermediate: "Intermediate",
    senior: "Senior",
    university: "University",
    adult: "Adult",
  };

  const ERROR_LABELS: Record<string, string> = {
    upload_ocr: "Upload — OCR",
    upload_save: "Upload — Save",
    plan_generation: "Plan generation",
    replan: "Replan",
    onboarding: "Onboarding",
    other: "Other",
  };

  if (!stats) {
    return (
      <div className="max-w-5xl mx-auto px-container-margin py-stack-lg space-y-stack-lg">
        <div>
          <p className="font-label-sm text-label-sm text-outline uppercase tracking-wider mb-1">Internal</p>
          <h1 className="font-display text-display text-primary">Admin</h1>
        </div>
        <div className="border border-error rounded-xl p-6 bg-error-container">
          <p className="font-label-md text-label-md text-on-error-container mb-1">Dashboard unavailable</p>
          <p className="font-body-md text-body-md text-on-error-container">
            {statsError ?? "Could not load admin stats."}
          </p>
          <p className="font-body-sm text-body-sm text-on-error-container mt-2 opacity-70">
            Check that all Supabase environment variables are set in the Vercel dashboard for the Production environment.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-container-margin py-stack-lg space-y-stack-lg">
      {/* Header */}
      <div>
        <p className="font-label-sm text-label-sm text-outline uppercase tracking-wider mb-1">
          Internal
        </p>
        <h1 className="font-display text-display text-primary">Admin</h1>
        <p className="font-body-md text-body-md text-on-surface-variant mt-1">
          Live data from Supabase.
        </p>
      </div>

      {/* KPI row */}
      <section>
        <h2 className="font-label-sm text-label-sm text-outline uppercase tracking-wider mb-stack-sm">
          Overview
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <KpiCard label="Total users" value={stats.totalUsers} />
          <KpiCard label="New this week" value={stats.newUsers} />
          <KpiCard label="Onboarded" value={stats.onboardedUsers} />
          <KpiCard
            label="Onboarding rate"
            value={stats.onboardingRate !== null ? `${stats.onboardingRate}%` : "—"}
          />
          <KpiCard label="Sessions completed" value={stats.completedCount} />
          <KpiCard label="Sessions missed" value={stats.missedCount} />
          <KpiCard
            label="Completion rate"
            value={stats.completionRate !== null ? `${stats.completionRate}%` : "—"}
          />
          <KpiCard
            label="Avg confidence"
            value={stats.avgConfidence !== null ? `${stats.avgConfidence}%` : "—"}
          />
          <KpiCard label="Coursework items" value={stats.totalCourseworkItems} />
          <KpiCard label="Practice sessions" value={stats.totalPracticeSessions} />
          <KpiCard label="Questions answered" value={stats.totalQuestionsAnswered} />
          <KpiCard
            label="Avg practice accuracy"
            value={stats.avgPracticeAccuracy !== null ? `${stats.avgPracticeAccuracy}%` : "—"}
          />
        </div>
      </section>

      {/* Sessions breakdown + subjects side by side */}
      <div className="grid md:grid-cols-2 gap-stack-md">
        {/* Sessions */}
        <section className="border border-outline-variant rounded-xl p-6 bg-surface">
          <h2 className="font-label-sm text-label-sm text-outline uppercase tracking-wider mb-stack-sm">
            Sessions
          </h2>
          <div className="space-y-3">
            <StatusBar
              label="Completed"
              count={stats.completedCount}
              total={stats.completedCount + stats.missedCount + stats.scheduledCount}
              color="bg-primary"
            />
            <StatusBar
              label="Missed"
              count={stats.missedCount}
              total={stats.completedCount + stats.missedCount + stats.scheduledCount}
              color="bg-error"
            />
            <StatusBar
              label="Scheduled"
              count={stats.scheduledCount}
              total={stats.completedCount + stats.missedCount + stats.scheduledCount}
              color="bg-outline-variant"
            />
          </div>
        </section>

        {/* Age band distribution */}
        <section className="border border-outline-variant rounded-xl p-6 bg-surface">
          <h2 className="font-label-sm text-label-sm text-outline uppercase tracking-wider mb-stack-sm">
            Age bands
          </h2>
          {stats.ageBandCounts.length === 0 ? (
            <p className="font-body-md text-body-md text-outline">
              No age band data yet — users who complete the new onboarding will appear here.
            </p>
          ) : (
            <div className="space-y-3">
              {stats.ageBandCounts.map(([band, count]) => (
                <StatusBar
                  key={band}
                  label={AGE_LABELS[band] ?? band}
                  count={count}
                  total={stats.totalUsers as number}
                  color="bg-secondary-container"
                />
              ))}
            </div>
          )}
        </section>
      </div>

      {/* Subjects + Difficulty + Confidence row */}
      <div className="grid md:grid-cols-2 gap-stack-md">
        <section className="border border-outline-variant rounded-xl p-6 bg-surface">
          <h2 className="font-label-sm text-label-sm text-outline uppercase tracking-wider mb-stack-sm">
            Top subjects ({stats.totalSubjectEntries} entries)
          </h2>
          {stats.topSubjects.length === 0 ? (
            <p className="font-body-md text-body-md text-outline">No subjects yet.</p>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {stats.topSubjects.map(([name, count]) => (
                <div key={name} className="border border-outline-variant rounded-lg p-3 bg-surface-container-low">
                  <p className="font-label-md text-label-md truncate">{name}</p>
                  <p className="font-body-sm text-body-sm text-outline mt-0.5">
                    {count} {count === 1 ? "user" : "users"}
                  </p>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="border border-outline-variant rounded-xl p-6 bg-surface space-y-stack-sm">
          <div>
            <h2 className="font-label-sm text-label-sm text-outline uppercase tracking-wider mb-3">
              Difficulty distribution
            </h2>
            <div className="space-y-2">
              {[["easy", "Easy"], ["medium", "Medium"], ["hard", "Hard"], ["unset", "Not set"]].map(([key, label]) => {
                const count = stats.difficultyCounts.find(([k]) => k === key)?.[1] ?? 0;
                return (
                  <StatusBar key={key} label={label} count={count} total={stats.totalSubjectEntries} color="bg-secondary-container" />
                );
              })}
            </div>
          </div>
          <div className="border-t border-outline-variant pt-stack-sm">
            <h2 className="font-label-sm text-label-sm text-outline uppercase tracking-wider mb-1">
              Confidence
            </h2>
            <p className="font-headline-md text-headline-md text-on-surface">
              {stats.avgConfidence !== null ? `${stats.avgConfidence}%` : "—"}
            </p>
            <p className="font-body-sm text-body-sm text-outline">
              avg across {stats.confidenceSet} of {stats.totalSubjectsWithConfidence} subjects
            </p>
          </div>
        </section>
      </div>

      {/* Goals + Habits + Memory row */}
      <div className="grid md:grid-cols-3 gap-stack-md">
        <section className="border border-outline-variant rounded-xl p-6 bg-surface">
          <h2 className="font-label-sm text-label-sm text-outline uppercase tracking-wider mb-3">
            Top goals
          </h2>
          {stats.topGoals.length === 0 ? (
            <p className="font-body-md text-body-md text-outline">No goal data yet.</p>
          ) : (
            <div className="space-y-2">
              {stats.topGoals.map(([goal, count]) => (
                <div key={goal} className="flex justify-between items-baseline gap-2">
                  <p className="font-body-sm text-body-sm text-on-surface truncate">{goal}</p>
                  <span className="font-label-sm text-label-sm text-outline shrink-0">{count}</span>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="border border-outline-variant rounded-xl p-6 bg-surface">
          <h2 className="font-label-sm text-label-sm text-outline uppercase tracking-wider mb-3">
            Study habits
          </h2>
          {stats.topHabits.length === 0 ? (
            <p className="font-body-md text-body-md text-outline">No habit data yet.</p>
          ) : (
            <div className="space-y-2">
              {stats.topHabits.map(([habit, count]) => (
                <div key={habit} className="flex justify-between items-baseline gap-2">
                  <p className="font-body-sm text-body-sm text-on-surface capitalize">{habit.replace("_", " ")}</p>
                  <span className="font-label-sm text-label-sm text-outline shrink-0">{count}</span>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="border border-outline-variant rounded-xl p-6 bg-surface">
          <h2 className="font-label-sm text-label-sm text-outline uppercase tracking-wider mb-3">
            Memory scores
          </h2>
          <p className="font-headline-lg-mobile text-headline-lg-mobile text-on-surface">
            {stats.avgMemory !== null ? `${stats.avgMemory}%` : "—"}
          </p>
          <p className="font-body-sm text-body-sm text-outline mt-1">
            avg across {stats.memoryScoreCount} users who completed the memory test
          </p>
        </section>
      </div>

      {/* Recent errors */}
      <section className="border border-outline-variant rounded-xl p-6 bg-surface">
        <div className="flex items-center justify-between gap-4 mb-stack-sm">
          <h2 className="font-label-sm text-label-sm text-outline uppercase tracking-wider">
            Recent errors
          </h2>
          {!stats.errorsUnavailable && stats.errors.length > 0 && <ClearErrorsButton />}
        </div>
        {stats.errorsUnavailable ? (
          <div className="border border-outline-variant rounded-lg p-4 bg-surface-container-low">
            <p className="font-body-md text-body-md text-on-surface-variant">
              The <code className="font-mono text-sm">app_errors</code> table does not exist yet.
              Run migration <code className="font-mono text-sm">0004_extended_onboarding.sql</code>{" "}
              in the Supabase dashboard to enable error tracking.
            </p>
          </div>
        ) : stats.errors.length === 0 ? (
          <p className="font-body-md text-body-md text-outline">No errors logged. Great!</p>
        ) : (
          <div className="divide-y divide-outline-variant">
            {stats.errors.map((err) => (
              <div key={err.id} className="py-4">
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div>
                    <span className="inline-block font-label-sm text-label-sm bg-error-container text-on-error-container rounded-full px-2 py-0.5 mr-2">
                      {ERROR_LABELS[err.error_type as string] ?? err.error_type}
                    </span>
                    <LocalTime
                      utcIso={err.created_at as string}
                      className="font-body-sm text-body-sm text-outline"
                    />
                  </div>
                  {err.user_id && (
                    <span className="font-mono text-xs text-outline-variant">
                      uid:{(err.user_id as string).slice(0, 8)}…
                    </span>
                  )}
                </div>
                <p className="font-body-md text-body-md mt-1 break-all">{err.message as string}</p>
                {err.context && Object.keys(err.context as object).length > 0 && (
                  <pre className="mt-1 font-mono text-xs text-on-surface-variant bg-surface-container-highest rounded p-2 overflow-x-auto whitespace-pre-wrap break-all">
                    {JSON.stringify(err.context, null, 2)}
                  </pre>
                )}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function KpiCard({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="border border-outline-variant rounded-xl p-5 bg-surface">
      <p className="font-label-sm text-label-sm text-outline uppercase tracking-wider mb-1">
        {label}
      </p>
      <p className="font-display text-[2rem] leading-none text-on-surface font-medium">
        {value}
      </p>
    </div>
  );
}

function StatusBar({
  label,
  count,
  total,
  color,
}: {
  label: string;
  count: number;
  total: number;
  color: string;
}) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
  return (
    <div>
      <div className="flex justify-between items-baseline mb-1">
        <span className="font-label-md text-label-md">{label}</span>
        <span className="font-body-sm text-body-sm text-outline">
          {count} ({pct}%)
        </span>
      </div>
      <div className="h-2 w-full bg-surface-container-highest rounded-full overflow-hidden">
        <div
          className={`h-full ${color} rounded-full transition-all duration-500`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
