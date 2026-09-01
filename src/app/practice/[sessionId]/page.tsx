import { redirect, notFound } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { getPracticeSessionAction } from "@/server/actions/practice";
import { PracticeUI } from "./practice-ui";

export const metadata = { title: "Practice — Pace" };

export default async function PracticeSessionPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { sessionId } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const state = await getPracticeSessionAction(sessionId);
  if (!state) notFound();

  return (
    <PracticeUI
      sessionId={state.sessionId}
      subjectName={state.subjectName}
      topicName={state.topicName}
      initialQuestion={state.question}
      initialQuestionsAnswered={state.questionsAnswered}
      initialCorrectCount={state.correctCount}
      initialDifficulty={state.currentDifficulty}
    />
  );
}
