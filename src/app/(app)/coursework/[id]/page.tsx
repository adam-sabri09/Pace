import { redirect, notFound } from "next/navigation";
import Link from "next/link";

import { createClient } from "@/lib/supabase/server";
import { getCourseworkItemAction } from "@/server/actions/coursework";
import { StartPracticeButton } from "./start-practice-button";

export const metadata = { title: "Coursework — Pace" };

export default async function CourseworkDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

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

  const item = await getCourseworkItemAction(id);
  if (!item) notFound();

  const ext = item.extracted;

  return (
    <main className="w-full max-w-3xl mx-auto px-container-margin py-stack-lg flex flex-col gap-stack-md">
      {/* Back link */}
      <Link
        href="/coursework"
        className="flex items-center gap-1 font-label-md text-label-md text-on-surface-variant hover:text-on-surface transition-colors w-fit"
      >
        <span className="material-symbols-outlined text-base" aria-hidden="true">
          arrow_back
        </span>
        Coursework
      </Link>

      <header className="border-b border-outline-variant pb-stack-sm">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="font-headline-lg-mobile md:font-headline-lg text-headline-lg-mobile md:text-headline-lg text-on-surface">
              {item.title}
            </h1>
            {item.subjectName && (
              <p className="font-body-md text-body-md text-on-surface-variant mt-1">
                {item.subjectName}
              </p>
            )}
          </div>
          {item.status === "ready" && (
            <StartPracticeButton courseworkItemId={item.id} />
          )}
        </div>

        {item.status === "processing" && (
          <p className="mt-stack-sm font-body-md text-body-md text-on-surface-variant bg-surface-container rounded-xl px-4 py-3">
            Extracting content… refresh in a moment.
          </p>
        )}
        {item.status === "failed" && (
          <p className="mt-stack-sm font-body-md text-body-md text-error bg-error-container rounded-xl px-4 py-3">
            Extraction failed. Try uploading a clearer version of the file.
          </p>
        )}
      </header>

      {ext && (
        <div className="flex flex-col gap-stack-md">
          {/* Difficulty badge */}
          {ext.difficulty && (
            <p className="font-label-md text-label-md text-on-surface-variant capitalize">
              Difficulty: {ext.difficulty}
            </p>
          )}

          {/* Topics */}
          {ext.topics && ext.topics.length > 0 && (
            <section className="flex flex-col gap-3">
              <h2 className="font-headline-md text-headline-md text-on-surface">Topics detected</h2>
              {ext.topics.map((topic, i) => (
                <div
                  key={i}
                  className="border border-outline-variant rounded-xl p-4 bg-surface-container-lowest"
                >
                  <p className="font-headline-sm text-headline-sm text-on-surface">{topic.name}</p>
                  {topic.subtopics && topic.subtopics.length > 0 && (
                    <p className="font-body-sm text-body-sm text-on-surface-variant mt-1">
                      {topic.subtopics.join(" · ")}
                    </p>
                  )}
                  {topic.concepts && topic.concepts.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-2">
                      {topic.concepts.map((c, j) => (
                        <span
                          key={j}
                          className="font-label-sm text-label-sm bg-secondary-container text-on-secondary-container px-2 py-0.5 rounded"
                        >
                          {c}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </section>
          )}

          {/* Key facts */}
          {ext.keyFacts && ext.keyFacts.length > 0 && (
            <section className="flex flex-col gap-2">
              <h2 className="font-headline-md text-headline-md text-on-surface">Key facts</h2>
              <ul className="flex flex-col gap-1.5">
                {ext.keyFacts.map((fact, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <span className="font-body-md text-body-md text-primary mt-0.5">•</span>
                    <span className="font-body-md text-body-md text-on-surface">{fact}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* Definitions */}
          {ext.definitions && ext.definitions.length > 0 && (
            <section className="flex flex-col gap-2">
              <h2 className="font-headline-md text-headline-md text-on-surface">Definitions</h2>
              <dl className="flex flex-col gap-2">
                {ext.definitions.map((d, i) => (
                  <div key={i} className="border-l-2 border-primary pl-3">
                    <dt className="font-headline-sm text-headline-sm text-on-surface">{d.term}</dt>
                    <dd className="font-body-md text-body-md text-on-surface-variant">{d.definition}</dd>
                  </div>
                ))}
              </dl>
            </section>
          )}

          {/* Relationships */}
          {ext.relationships && ext.relationships.length > 0 && (
            <section className="flex flex-col gap-2">
              <h2 className="font-headline-md text-headline-md text-on-surface">Relationships</h2>
              <ul className="flex flex-col gap-1.5">
                {ext.relationships.map((r, i) => (
                  <li key={i} className="font-body-md text-body-md text-on-surface">
                    <span className="font-semibold">{r.from}</span>
                    <span className="text-on-surface-variant mx-2">{r.relationship}</span>
                    <span className="font-semibold">{r.to}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      )}

      {item.status === "ready" && (
        <div className="flex justify-center pt-stack-sm">
          <StartPracticeButton courseworkItemId={item.id} variant="large" />
        </div>
      )}
    </main>
  );
}
