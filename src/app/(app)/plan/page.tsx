import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { utcToLocalParts } from "@/server/llm/time";

/**
 * /plan — full timeline grouped by day (DESIGN-SPEC §3.8). Read-only in
 * Step 6; Complete/Missed live on /today. Past sessions render muted;
 * future days render at full opacity.
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

  const { data: sessions } = await supabase
    .from("sessions")
    .select(
      "id, starts_at, duration_minutes, instruction, status, topic:topics(name, subject:subjects(name))",
    )
    .eq("user_id", user.id)
    .order("starts_at", { ascending: true });

  const now = new Date();
  const today = utcToLocalParts(now, timeZone).dateString;

  // Group sessions by local date.
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
        <h1 className="font-headline-lg-mobile md:font-headline-lg text-headline-lg-mobile md:text-headline-lg text-on-surface">
          Study Plan
        </h1>
        <p className="font-body-md text-body-md text-on-surface-variant mt-1">
          Your schedule, grouped by day.
        </p>
      </header>

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
                    const muted =
                      s.status !== "scheduled" || past;
                    return (
                      <li
                        key={s.id}
                        className={
                          "relative pl-6 " +
                          (muted ? "opacity-70" : "")
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
                              (s.status === "completed" ||
                              s.status === "missed"
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
                              {s.status === "completed" ? "Completed" : "Missed"}
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
