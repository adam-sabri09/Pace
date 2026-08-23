import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { logOutAction } from "@/server/actions/auth";
import { localWallClockToUTC, utcToLocalParts } from "@/server/llm/time";

/**
 * /today — authenticated landing.
 *
 * Step 5 scope: minimal vertical list of *today's* sessions (in the user's
 * timezone) rendered from the DB. Nav shell, Complete / Missed buttons,
 * polished cards, and the exam-countdown widget are Step 6.
 */
export default async function TodayPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("first_name, session_length_minutes, time_zone")
    .eq("id", user.id)
    .maybeSingle();

  if (profile?.session_length_minutes == null) redirect("/onboarding");

  const timeZone = profile?.time_zone ?? "UTC";
  const greetingName = profile?.first_name?.trim() || "friend";

  // Compute the local-day boundaries for "today" in the user's timezone,
  // then filter sessions.starts_at into that window.
  const now = new Date();
  const localNow = utcToLocalParts(now, timeZone);
  const dayStartLocal = `${localNow.dateString}T00:00`;
  const dayEndLocal = `${localNow.dateString}T23:59`;
  const dayStartUTC = localWallClockToUTC(dayStartLocal, timeZone).toISOString();
  const dayEndUTC = localWallClockToUTC(dayEndLocal, timeZone).toISOString();

  const { data: sessions } = await supabase
    .from("sessions")
    .select(
      "id, starts_at, duration_minutes, instruction, status, topic:topics(id, name, subject:subjects(id, name))",
    )
    .eq("user_id", user.id)
    .gte("starts_at", dayStartUTC)
    .lte("starts_at", dayEndUTC)
    .order("starts_at", { ascending: true });

  return (
    <main className="min-h-full flex-grow flex flex-col items-center px-container-margin py-stack-lg">
      <div className="w-full max-w-2xl flex flex-col gap-stack-md">
        <header className="flex flex-col gap-base">
          <span className="font-display text-headline-md text-primary">Pace</span>
          <h1 className="font-display text-headline-lg-mobile md:text-headline-lg text-on-surface">
            Good day, {greetingName}.
          </h1>
          <p className="font-body-md text-body-md text-on-surface-variant">
            {sessions && sessions.length > 0
              ? `You have ${sessions.length} session${sessions.length === 1 ? "" : "s"} today.`
              : "No sessions today."}
          </p>
        </header>

        {sessions && sessions.length > 0 ? (
          <ul className="flex flex-col gap-3">
            {sessions.map((s) => {
              const start = utcToLocalParts(new Date(s.starts_at as string), timeZone);
              const end = utcToLocalParts(
                new Date(
                  new Date(s.starts_at as string).getTime() +
                    (s.duration_minutes as number) * 60_000,
                ),
                timeZone,
              );
              // The Supabase types render nested embeds as an array on the
              // typed client even for to-one relations. Handle both shapes.
              const topic = Array.isArray(s.topic) ? s.topic[0] : s.topic;
              const subject = topic
                ? Array.isArray(topic.subject)
                  ? topic.subject[0]
                  : topic.subject
                : null;
              return (
                <li
                  key={s.id as string}
                  className="bg-surface-container-lowest border border-outline-variant rounded-lg p-4 relative overflow-hidden"
                >
                  <div className="absolute left-0 top-0 bottom-0 w-1 bg-outline-variant" />
                  <div className="pl-3 flex flex-col gap-1">
                    <div className="flex items-center gap-3">
                      {subject && (
                        <span className="font-label-sm text-label-sm bg-secondary-container text-on-secondary-container px-2 py-1 rounded">
                          {subject.name as string}
                        </span>
                      )}
                      <span className="font-body-md text-body-md text-on-surface-variant">
                        {start.timeString} – {end.timeString} · {s.duration_minutes as number} min
                      </span>
                    </div>
                    <h2 className="font-headline-md text-headline-md text-on-surface">
                      {topic ? (topic.name as string) : "Session"}
                    </h2>
                    <p className="font-body-md text-body-md text-on-surface-variant">
                      {s.instruction as string}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
        ) : (
          // "You're all clear today" empty state (DESIGN-SPEC.md §3.11).
          <div className="w-full bg-surface-container-lowest border border-outline-variant rounded-xl p-stack-lg flex flex-col items-center gap-stack-sm text-center">
            <div className="w-16 h-16 rounded-full bg-surface-container-low flex items-center justify-center">
              <span
                className="material-symbols-outlined text-3xl text-secondary"
                style={{ fontVariationSettings: "'wght' 300" }}
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

        <form action={logOutAction} className="mt-stack-md self-center">
          <button
            type="submit"
            className="border border-outline-variant text-on-surface font-label-md text-label-md px-8 py-3 rounded-lg hover:bg-surface-container-low transition-colors"
          >
            Log out
          </button>
        </form>
      </div>
    </main>
  );
}
