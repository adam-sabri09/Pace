import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { CoachChat } from "./chat";

/**
 * /coach — AI study coach.
 * Uses the student's real subjects, confidence levels, upcoming tasks,
 * and session completion rate as context for coaching advice.
 */
export default async function CoachPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("session_length_minutes, first_name")
    .eq("id", user.id)
    .maybeSingle();

  if (profile?.session_length_minutes == null) redirect("/onboarding");

  return (
    <main className="w-full max-w-3xl mx-auto px-container-margin py-stack-lg flex flex-col gap-stack-md h-full">
      <header className="border-b border-outline-variant pb-stack-sm shrink-0">
        <h1 className="font-headline-lg-mobile md:font-headline-lg text-headline-lg-mobile md:text-headline-lg text-on-surface flex items-center gap-3">
          <span
            className="material-symbols-outlined text-secondary"
            style={{ fontVariationSettings: "'FILL' 1" }}
            aria-hidden="true"
          >
            chat
          </span>
          Study Coach
        </h1>
        <p className="font-body-md text-body-md text-on-surface-variant mt-1">
          Ask anything about studying, your subjects, or staying on track.
        </p>
      </header>

      <CoachChat />
    </main>
  );
}
