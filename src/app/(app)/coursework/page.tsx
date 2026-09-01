import { redirect } from "next/navigation";
import Link from "next/link";

import { createClient } from "@/lib/supabase/server";
import { CourseworkUploadForm } from "./upload-form";

export const metadata = { title: "Coursework — Pace" };

function StatusBadge({ status }: { status: "processing" | "ready" | "failed" }) {
  const cls =
    status === "ready"
      ? "bg-secondary-container text-on-secondary-container"
      : status === "processing"
        ? "bg-surface-container text-on-surface-variant"
        : "bg-error-container text-on-error-container";
  const label =
    status === "ready" ? "Ready" : status === "processing" ? "Processing…" : "Failed";
  return (
    <span className={`font-label-sm text-label-sm px-2 py-0.5 rounded ${cls}`}>{label}</span>
  );
}

export default async function CourseworkPage() {
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

  const { data: rows } = await supabase
    .from("coursework_items")
    .select("id, title, subject_name, file_type, status, extracted, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(50);

  const items = (rows ?? []).map((row) => ({
    id: row.id as string,
    title: row.title as string,
    subjectName: row.subject_name as string | null,
    fileType: row.file_type as string,
    status: row.status as "processing" | "ready" | "failed",
    topicCount:
      ((row.extracted as { topics?: unknown[] } | null)?.topics?.length ?? 0),
    createdAt: row.created_at as string,
  }));

  const readyCount = items.filter((i) => i.status === "ready").length;

  return (
    <main className="w-full max-w-3xl mx-auto px-container-margin py-stack-lg flex flex-col gap-stack-md">
      <header className="border-b border-outline-variant pb-stack-sm">
        <h1 className="font-headline-lg-mobile md:font-headline-lg text-headline-lg-mobile md:text-headline-lg text-on-surface">
          Coursework
        </h1>
        <p className="font-body-md text-body-md text-on-surface-variant mt-1">
          Upload notes, handouts, or textbook pages. Pace extracts key concepts and builds practice
          questions from them.
        </p>
      </header>

      <CourseworkUploadForm />

      {items.length === 0 ? (
        <div className="flex flex-col items-center gap-stack-sm text-center py-stack-lg">
          <span
            className="material-symbols-outlined text-4xl text-on-surface-variant"
            aria-hidden="true"
          >
            upload_file
          </span>
          <h2 className="font-headline-md text-headline-md text-on-surface">No uploads yet</h2>
          <p className="font-body-md text-body-md text-on-surface-variant max-w-sm">
            Upload your first piece of study material above to get started.
          </p>
        </div>
      ) : (
        <section className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h2 className="font-headline-md text-headline-md text-on-surface">
              Your uploads
            </h2>
            {readyCount > 0 && (
              <span className="font-label-sm text-label-sm text-on-surface-variant">
                {readyCount} ready to practice
              </span>
            )}
          </div>

          {items.map((item) => (
            <Link
              key={item.id}
              href={`/coursework/${item.id}`}
              className="block border border-outline-variant rounded-xl p-4 bg-surface-container-lowest hover:bg-surface-container-low transition-colors"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-headline-sm text-headline-sm text-on-surface truncate">
                    {item.title}
                  </p>
                  <p className="font-body-sm text-body-sm text-on-surface-variant mt-0.5">
                    {item.subjectName ?? "Unknown subject"}
                    {item.topicCount > 0 &&
                      ` · ${item.topicCount} topic${item.topicCount === 1 ? "" : "s"} detected`}
                  </p>
                </div>
                <StatusBadge status={item.status} />
              </div>
            </Link>
          ))}
        </section>
      )}
    </main>
  );
}
