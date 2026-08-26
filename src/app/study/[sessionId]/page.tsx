import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { StudySession } from "./study-session";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * /study/[sessionId] — focused study screen (F10, UI-SPEC §3.9).
 *
 * Outside the (app) route group so it gets no nav shell — this is an
 * intentional full-screen focus experience. Auth is checked here directly,
 * matching the onboarding page pattern.
 *
 * Guards: non-UUID path param → /today, unauthenticated → /login,
 * session not found / not scheduled → /today.
 */
export default async function StudyPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { sessionId } = await params;

  if (!UUID_RE.test(sessionId)) redirect("/today");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: session } = await supabase
    .from("sessions")
    .select(
      "id, duration_minutes, instruction, status, topic:topics(name, subject:subjects(name))",
    )
    .eq("id", sessionId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!session || session.status !== "scheduled") redirect("/today");

  const topic = Array.isArray(session.topic) ? session.topic[0] : session.topic;
  const subject = topic
    ? Array.isArray(topic.subject)
      ? topic.subject[0]
      : topic.subject
    : null;

  return (
    <StudySession
      sessionId={sessionId}
      subjectName={(subject?.name as string | undefined) ?? "Session"}
      topicName={(topic?.name as string | undefined) ?? "Study session"}
      instruction={session.instruction as string}
      durationMinutes={session.duration_minutes as number}
    />
  );
}
