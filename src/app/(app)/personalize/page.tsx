import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { Questionnaire } from "./questionnaire";

export default async function PersonalizePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("session_length_minutes, personalization_completed_at, personalization_answers")
    .eq("id", user.id)
    .maybeSingle();

  if (profile?.session_length_minutes == null) redirect("/onboarding");

  // If already personalised, show the form pre-filled so they can change answers.
  const existingAnswers = profile?.personalization_answers ?? null;

  return (
    <main className="w-full max-w-2xl mx-auto px-container-margin py-stack-lg">
      <header className="mb-stack-lg">
        <h1 className="font-headline-lg-mobile md:font-headline-lg text-headline-lg-mobile md:text-headline-lg text-on-surface mb-1">
          {existingAnswers ? "Update your study style" : "Help Pace learn your study style"}
        </h1>
        <p className="font-body-md text-body-md text-on-surface-variant">
          {existingAnswers
            ? "Your preferences shape which technique Pace recommends each day."
            : "Six quick questions. Your answers shape how Pace recommends what to study. You can skip any time — this is always optional."}
        </p>
      </header>
      <Questionnaire existingAnswers={existingAnswers} />
    </main>
  );
}
