import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { SubjectIntelligenceForm } from "./subject-intelligence-form";
import { AddSubjectForm } from "./add-subject-form";
import type { Difficulty } from "@/lib/personalization/types";

export default async function SubjectsPage() {
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

  const { data: subjects } = await supabase
    .from("subjects")
    .select("id, name, exam_date, difficulty, confidence_pct, topics(id, name)")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true });

  return (
    <main className="w-full max-w-3xl mx-auto px-container-margin py-stack-lg flex flex-col gap-stack-md">
      <header className="border-b border-outline-variant pb-stack-sm">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="font-headline-lg-mobile md:font-headline-lg text-headline-lg-mobile md:text-headline-lg text-on-surface">
              Subjects
            </h1>
            <p className="font-body-md text-body-md text-on-surface-variant mt-1">
              Your subjects, topics, and exam dates. Rate each subject&rsquo;s difficulty and your confidence to sharpen your daily recommendations.
            </p>
          </div>
        </div>
      </header>

      <AddSubjectForm />

      {subjects && subjects.length > 0 ? (
        <div className="flex flex-col gap-stack-md">
          {subjects.map((s) => {
            const topics = ((s.topics as Array<{ id: string; name: string }> | null) ?? []);
            return (
              <section
                key={s.id as string}
                className="border border-outline-variant rounded-xl p-stack-md bg-surface-container-lowest"
              >
                <div className="flex items-start justify-between gap-3 mb-stack-sm">
                  <h2 className="font-headline-md text-headline-md text-on-surface">
                    {s.name as string}
                  </h2>
                  <span className="font-label-sm text-label-sm bg-secondary-container text-on-secondary-container px-2 py-1 rounded shrink-0">
                    {s.exam_date
                      ? `Exam ${s.exam_date as string}`
                      : "No exam date"}
                  </span>
                </div>
                {topics.length > 0 ? (
                  <ul className="flex flex-col gap-2">
                    {topics.map((t) => (
                      <li
                        key={t.id}
                        className="font-body-md text-body-md text-on-surface-variant flex items-center gap-2"
                      >
                        <span
                          className="material-symbols-outlined text-[16px] text-outline"
                          aria-hidden="true"
                        >
                          menu_book
                        </span>
                        {t.name}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="font-body-md text-body-md text-on-surface-variant">
                    No topics.
                  </p>
                )}
                <SubjectIntelligenceForm
                  subjectId={s.id as string}
                  initialDifficulty={(s.difficulty as Difficulty | null) ?? null}
                  initialConfidencePct={(s.confidence_pct as number | null) ?? null}
                />
              </section>
            );
          })}
        </div>
      ) : (
        <div className="w-full bg-surface-container-lowest border border-outline-variant rounded-xl p-stack-lg flex flex-col items-center gap-stack-sm text-center">
          <h2 className="font-headline-md text-headline-md text-on-surface">
            No subjects yet
          </h2>
          <p className="font-body-md text-body-md text-on-surface-variant max-w-sm">
            Finish onboarding to add your subjects.
          </p>
        </div>
      )}
    </main>
  );
}
