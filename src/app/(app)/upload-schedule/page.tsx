import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { UploadForm } from "./upload-form";

export default async function UploadSchedulePage() {
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

  if (profile?.session_length_minutes == null) redirect("/onboarding");

  return (
    <main className="w-full max-w-2xl mx-auto px-container-margin py-stack-lg">
      <header className="mb-stack-lg">
        <h1 className="font-headline-lg-mobile md:font-headline-lg text-headline-lg-mobile md:text-headline-lg text-on-surface mb-1">
          Upload your schedule
        </h1>
        <p className="font-body-md text-body-md text-on-surface-variant">
          Take a photo of your timetable or exam schedule. Pace reads it and extracts your subjects and exam dates. You review and confirm before anything is saved.
        </p>
      </header>
      <UploadForm />
    </main>
  );
}
