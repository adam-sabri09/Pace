import { redirect } from "next/navigation";
import Link from "next/link";

import { createClient } from "@/lib/supabase/server";
import { logOutAction } from "@/server/actions/auth";
import { AvailabilityEditor } from "./availability-editor";
import type { SessionLength } from "@/lib/validation/onboarding";

/**
 * /settings — manage availability, session length, subjects.
 */
export default async function SettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [profileRes, availRes] = await Promise.all([
    supabase
      .from("profiles")
      .select("session_length_minutes")
      .eq("id", user.id)
      .maybeSingle(),
    supabase
      .from("availability_windows")
      .select("day_of_week, starts_at, ends_at")
      .eq("user_id", user.id)
      .order("day_of_week", { ascending: true }),
  ]);

  const sessionLength = (profileRes.data?.session_length_minutes ?? 45) as SessionLength;

  const initialWindows = (availRes.data ?? []).map((w) => ({
    dayOfWeek: w.day_of_week as number,
    startsAt: (w.starts_at as string).slice(0, 5),
    endsAt: (w.ends_at as string).slice(0, 5),
  }));

  return (
    <main className="w-full max-w-3xl mx-auto px-container-margin py-stack-lg flex flex-col gap-stack-md">
      <header className="border-b border-outline-variant pb-stack-sm">
        <h1 className="font-headline-lg-mobile md:font-headline-lg text-headline-lg-mobile md:text-headline-lg text-on-surface">
          Settings
        </h1>
        <p className="font-body-md text-body-md text-on-surface-variant mt-1">
          Changes to availability or session length will rebuild your plan automatically.
        </p>
      </header>

      <AvailabilityEditor
        initialWindows={initialWindows}
        initialSessionLength={sessionLength}
      />

      <section className="border border-outline-variant rounded-xl p-stack-md bg-surface-container-lowest">
        <h2 className="font-headline-md text-headline-md text-on-surface flex items-center gap-base border-b border-outline-variant pb-base mb-stack-md">
          <span className="material-symbols-outlined text-outline" aria-hidden="true">
            tune
          </span>
          Subjects
        </h2>
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="font-label-md text-label-md text-on-surface">
              Subjects &amp; difficulty
            </p>
            <p className="font-body-md text-body-md text-on-surface-variant">
              Update difficulty and confidence for each subject to sharpen daily recommendations.
            </p>
          </div>
          <Link
            href="/subjects"
            className="shrink-0 font-label-md text-label-md text-primary border border-primary/30 px-4 py-2 rounded-lg hover:bg-primary/5 transition-colors"
          >
            Update
          </Link>
        </div>
      </section>

      <section className="border border-outline-variant rounded-xl p-stack-md bg-surface-container-lowest">
        <h2 className="font-headline-md text-headline-md text-on-surface flex items-center gap-base border-b border-outline-variant pb-base mb-stack-md">
          <span className="material-symbols-outlined text-outline" aria-hidden="true">
            logout
          </span>
          Session
        </h2>
        <form action={logOutAction}>
          <button
            type="submit"
            className="border border-outline-variant text-on-surface font-label-md text-label-md px-6 py-2 rounded-lg hover:bg-surface-container-low transition-colors"
          >
            Log out
          </button>
        </form>
      </section>

      <section className="border border-outline-variant rounded-xl p-stack-md bg-surface-container-lowest opacity-60">
        <h2 className="font-headline-md text-headline-md text-on-surface flex items-center gap-base border-b border-outline-variant pb-base mb-stack-md">
          <span className="material-symbols-outlined text-outline" aria-hidden="true">
            delete_forever
          </span>
          Danger zone
        </h2>
        <button
          type="button"
          disabled
          aria-disabled="true"
          className="font-label-md text-label-md text-error border border-outline-variant px-6 py-2 rounded-lg cursor-not-allowed"
        >
          Delete account (coming soon)
        </button>
      </section>
    </main>
  );
}
