import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { Wizard } from "./wizard";

/**
 * /onboarding — the 5-step wizard + Review.
 * Redirect matrix:
 *   - not signed in     → /login
 *   - already onboarded → /today (session_length_minutes is set)
 *   - otherwise         → render the wizard
 * The "onboarded" flag is profiles.session_length_minutes IS NOT NULL —
 * this is the last thing commitOnboardingAction writes, so any partial
 * state before that write still routes the user back through the wizard.
 */
export default async function OnboardingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("session_length_minutes")
    .eq("id", user.id)
    .maybeSingle();

  if (profile?.session_length_minutes != null) redirect("/today");

  return <Wizard />;
}
