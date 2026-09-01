import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

// Temporarily: all authenticated users can access /admin.

type StatRow = { count: string } | null;

async function fetchStats() {
  const db = createServiceClient();

  const [
    { count: totalUsers },
    { count: newUsers },
    { count: onboardedUsers },
    sessionsRes,
    subjectsRes,
    profilesRes,
    ageBandRes,
    errorsRes,
  ] = await Promise.all([
    db.from("profiles").select("*", { count: "exact", head: true }).then((r) => ({ count: r.count ?? 0 })),
    db.from("profiles").select("*", { count: "exact", head: true })
      .gte("created_at", new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
      .then((r) => ({ count: r.count ?? 0 })),
    db.from("profiles").select("*", { count: "exact", head: true })
      .not("session_length_minutes", "is", null)
      .then((r) => ({ count: r.count ?? 0 })),
    db.from("sessions").select("status, duration_minutes"),
    db.from("subjects").select("name, difficulty, confidence_pct"),
    db.from("profiles").select("age_band, study_habits, goal_ranking, memory_score, session_length_minutes").not("session_length_minutes", "is", null),
    db.from("profiles").select("age_band").not("age_band", "is", null),
    db.from("app_errors").select("id, created_at, error_type, message, context, user_id")
      .order("created_at", { ascending: false }).limit(15).then((r) => r),
  ]);

  // Sessions
  const sessions = sessionsRes.data ?? [];
  const completedCount = sessions.filter((s) => s.status === "completed").length;
  const missedCount = sessions.filter((s) => s.status === "missed").length;
  const scheduledCount = sessions.filter((s) => s.status === "scheduled").length;
  const doneOrMissed = completedCount + missedCount;
  const completionRate = doneOrMissed > 0 ? Math.round((completedCount / doneOrMissed) * 100) : null;

  // Subjects
  const subjectData = subjectsRes.data ?? [];
  const allSubjectNames = subjectData.map((s) => s.name as string);
  const subjectCounts = new Map<string, number>();
  for (const name of allSubjectNames) {
    subjectCounts.set(name, (subjectCounts.get(name) ?? 0) + 1);
  }
  const topSubjects = [...subjectCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);

  // Difficulty distribution
  const difficultyCounts = new Map<string, number>([["easy", 0], ["medium", 0], ["hard", 0], ["unset", 0]]);
  for (const s of subjectData) {
    const d = (s.difficulty as string | null) ?? "unset";
    difficultyCounts.set(d, (difficultyCounts.get(d) ?? 0) + 1);
  }

  // Confidence stats
  const confidenceValues = subjectData
    .map((s) => s.confidence_pct as number | null)
    .filter((v): v is number => v !== null);
  const avgConfidence = confidenceValues.length > 0
    ? Math.round(confidenceValues.reduce((a, b) => a + b, 0) / confidenceValues.length)
    : null;
  const confidenceSet = confidenceValues.length;

  // Age bands
  const ageBandData = ageBandRes.data ?? [];
  const ageBandCounts = new Map<string, number>();
  for (const row of ageBandData) {
    const band = row.age_band as string;
    if (band) ageBandCounts.set(band, (ageBandCounts.get(band) ?? 0) + 1);
  }

  // Memory scores
  const profiles = profilesRes.data ?? [];
  const memScores = profiles.map((p) => p.memory_score as number | null).filter((v): v is number => v !== null);
  const avgMemory = memScores.length > 0
    ? Math.round(memScores.reduce((a, b) => a + b, 0) / memScores.length)
    : null;

  // Top goals (first item in goal_ranking)
  const goalCounts = new Map<string, number>();
  for (const p of profiles) {
    const ranking = p.goal_ranking as string[] | null;
    if (ranking && ranking.length > 0) {
      goalCounts.set(ranking[0], (goalCounts.get(ranking[0]) ?? 0) + 1);
    }
  }
  const topGoals = [...goalCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);

  // Study habits distribution
  const habitCounts = new Map<string, number>();
  for (const p of profiles) {
    const habits = p.study_habits as string[] | null;
    if (habits) {
      for (const h of habits) habitCounts.set(h, (habitCounts.get(h) ?? 0) + 1);
    }
  }
  const topHabits = [...habitCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6);

  const onboardingRate = totalUsers > 0
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
    totalSubjectEntries: allSubjectNames.length,
    topSubjects,
    difficultyCounts: [...difficultyCounts.entries()],
    avgConfidence,
    confidenceSet,
    totalSubjectsWithConfidence: subjectData.length,
    ageBandCounts: [...ageBandCounts.entries()].sort((a, b) => b[1] - a[1]),
    avgMemory,
    memoryScoreCount: memScores.length,
    topGoals,
    topHabits,
    errors,
    errorsUnavailable,
  };
}

export default async function AdminPage() {
  // Auth check — the (app) layout already verified the user is logged in.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Temporarily: all authenticated users can access /admin.
  // The layout already verified the user is logged in; if somehow null, redirect.
  if (!user) {
    redirect("/today");
  }

  const stats = await fetchStats();

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
        <h2 className="font-label-sm text-label-sm text-outline uppercase tracking-wider mb-stack-sm">
          Recent errors
        </h2>
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
                    <span className="font-body-sm text-body-sm text-outline">
                      {new Date(err.created_at as string).toLocaleString()}
                    </span>
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
