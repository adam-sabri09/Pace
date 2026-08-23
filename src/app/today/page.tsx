import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { logOutAction } from "@/server/actions/auth";

/**
 * /today — authenticated landing.
 *
 * Redirect matrix:
 *   - not signed in       → /login
 *   - not onboarded yet   → /onboarding  (session_length_minutes IS NULL)
 *   - onboarded, no plan  → the "all clear" empty state below
 *
 * A real dashboard (session cards, up-next tile, exam widget, nav shell)
 * lands in Step 5. This file stays intentionally minimal until then.
 */
export default async function TodayPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("first_name, session_length_minutes")
    .eq("id", user.id)
    .maybeSingle();

  if (profile?.session_length_minutes == null) redirect("/onboarding");

  const greetingName = profile?.first_name?.trim() || "friend";

  return (
    <main className="min-h-full flex-grow flex items-center justify-center px-container-margin py-stack-lg">
      <div className="w-full max-w-md flex flex-col items-center gap-stack-md text-center">
        <span className="font-display text-headline-md text-primary">Pace</span>
        <h1 className="font-display text-headline-lg-mobile md:text-headline-lg text-on-surface">
          You&rsquo;re all set, {greetingName}.
        </h1>
        {/* "All clear" empty state (DESIGN-SPEC.md §3.11) — the plan generator
            is Step 8; until then a signed-in, onboarded user sees this. */}
        <div className="w-full bg-surface-container-lowest border border-outline-variant rounded-xl p-stack-lg flex flex-col items-center gap-stack-sm">
          <div className="w-16 h-16 rounded-full bg-surface-container-low flex items-center justify-center">
            <span
              className="material-symbols-outlined text-3xl text-secondary"
              style={{ fontVariationSettings: "'wght' 300" }}
            >
              check_circle
            </span>
          </div>
          <h2 className="font-headline-md text-headline-md text-on-surface">
            Your plan is coming.
          </h2>
          <p className="font-body-md text-body-md text-on-surface-variant max-w-sm">
            Onboarding done. The plan generator lands next — this is where your
            day-by-day sessions will appear.
          </p>
        </div>
        <form action={logOutAction}>
          <button
            type="submit"
            className="border border-outline-variant text-on-surface font-label-md text-label-md px-8 py-3 rounded-lg hover:bg-surface-container-low transition-colors mt-stack-md"
          >
            Log out
          </button>
        </form>
      </div>
    </main>
  );
}
