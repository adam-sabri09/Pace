"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  submitAnswerAction,
  endPracticeAction,
  retryNextQuestionAction,
} from "@/server/actions/practice";
import type { ClientQuestion, PracticeSummary } from "@/server/actions/practice";
import type { Difficulty } from "@/lib/practice/difficulty";
import { DIFFICULTY_LABELS } from "@/lib/practice/difficulty";
import { resolveSessionEnd } from "@/lib/practice/session";

type Phase = "question" | "feedback" | "complete";

export function PracticeUI({
  sessionId,
  subjectName,
  topicName,
  initialQuestion,
  initialQuestionsAnswered,
  initialCorrectCount,
  initialDifficulty,
}: {
  sessionId: string;
  subjectName: string;
  topicName: string | null;
  initialQuestion: ClientQuestion;
  initialQuestionsAnswered: number;
  initialCorrectCount: number;
  initialDifficulty: Difficulty;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [phase, setPhase] = useState<Phase>("question");
  const [question, setQuestion] = useState<ClientQuestion>(initialQuestion);
  const [questionsAnswered, setQuestionsAnswered] = useState(initialQuestionsAnswered);
  const [correctCount, setCorrectCount] = useState(initialCorrectCount);
  const [difficulty] = useState<Difficulty>(initialDifficulty);
  const [answer, setAnswer] = useState("");
  const [feedback, setFeedback] = useState<{ text: string; isCorrect: boolean } | null>(null);
  const [summary, setSummary] = useState<PracticeSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [generationFailed, setGenerationFailed] = useState(false);
  const startTimeRef = useRef<number>(0);
  const MAX_QUESTIONS = 10;

  function handleStartQuestion() {
    startTimeRef.current = Date.now();
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!answer.trim()) return;
    const responseTimeMs = Date.now() - startTimeRef.current;
    setError(null);

    startTransition(async () => {
      const result = await submitAnswerAction(sessionId, answer, responseTimeMs);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setQuestionsAnswered((q) => q + 1);
      if (result.isCorrect) setCorrectCount((c) => c + 1);
      setFeedback({ text: result.feedback, isCorrect: result.isCorrect });

      const resolution = resolveSessionEnd(result);
      if (resolution === "complete") {
        setPhase("complete");
        setSummary({
          questionsAnswered: questionsAnswered + 1,
          correctCount: correctCount + (result.isCorrect ? 1 : 0),
          accuracy:
            Math.round(
              ((correctCount + (result.isCorrect ? 1 : 0)) / (questionsAnswered + 1)) * 100,
            ),
          subjectName,
          topicName,
        });
      } else {
        setPhase("feedback");
        if (resolution === "generation_failed") {
          // Gemini failed to generate the next question. Stay in feedback so
          // the student can retry — do NOT show the completion screen.
          setGenerationFailed(true);
        } else {
          setGenerationFailed(false);
          // Pre-set the next question so it's ready when the student continues.
          setTimeout(() => {
            setQuestion(result.nextQuestion!);
          }, 0);
        }
      }
    });
  }

  function handleContinue() {
    setAnswer("");
    setFeedback(null);
    setPhase("question");
    startTimeRef.current = Date.now();
  }

  function handleEndEarly() {
    startTransition(async () => {
      const result = await endPracticeAction(sessionId);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setSummary(result.summary);
      setPhase("complete");
    });
  }

  function handleRetryGeneration() {
    setError(null);
    startTransition(async () => {
      const result = await retryNextQuestionAction(sessionId);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setGenerationFailed(false);
      setQuestion(result.question);
    });
  }

  const accuracy =
    questionsAnswered > 0 ? Math.round((correctCount / questionsAnswered) * 100) : null;

  if (phase === "complete" && summary) {
    return (
      <CompletionScreen
        summary={summary}
        onRestart={() => router.push("/coursework")}
        onGoToToday={() => router.push("/today")}
      />
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-background">
      {/* Header */}
      <header className="flex items-center justify-between px-container-margin py-base border-b border-outline-variant bg-surface">
        <div>
          <p className="font-headline-sm text-headline-sm text-on-surface">{subjectName}</p>
          {topicName && (
            <p className="font-body-sm text-body-sm text-on-surface-variant">{topicName}</p>
          )}
        </div>
        <div className="flex items-center gap-gutter">
          <span className="font-label-sm text-label-sm text-on-surface-variant capitalize">
            {DIFFICULTY_LABELS[difficulty]}
          </span>
          <span className="font-label-sm text-label-sm text-on-surface-variant">
            {questionsAnswered}/{MAX_QUESTIONS}
          </span>
          {accuracy !== null && (
            <span className="font-label-sm text-label-sm text-on-surface-variant">
              {accuracy}% correct
            </span>
          )}
          <button
            onClick={handleEndEarly}
            disabled={isPending}
            className="font-label-sm text-label-sm text-on-surface-variant hover:text-on-surface transition-colors"
          >
            End session
          </button>
        </div>
      </header>

      {/* Main */}
      <main className="flex-1 flex flex-col items-center justify-center px-container-margin py-stack-lg">
        <div className="w-full max-w-2xl flex flex-col gap-stack-md">
          {/* Progress bar */}
          <div className="w-full bg-surface-container-low rounded-full h-1.5">
            <div
              className="bg-primary h-1.5 rounded-full transition-all duration-300"
              style={{ width: `${(questionsAnswered / MAX_QUESTIONS) * 100}%` }}
            />
          </div>

          {/* Question card */}
          <div className="border border-outline-variant rounded-2xl p-stack-md bg-surface-container-lowest">
            <p className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wide mb-3">
              {humanQuestionType(question.questionType)} · {question.conceptTested}
            </p>
            <p className="font-headline-md text-headline-md text-on-surface leading-snug">
              {question.questionText}
            </p>
          </div>

          {/* Answer area or feedback */}
          {phase === "question" && (
            <form onSubmit={handleSubmit} className="flex flex-col gap-stack-sm">
              <textarea
                value={answer}
                onChange={(e) => {
                  setAnswer(e.target.value);
                  if (e.target.value.length === 1) handleStartQuestion();
                }}
                placeholder="Write your answer here…"
                rows={5}
                className="w-full border border-outline-variant rounded-xl px-4 py-3 font-body-md text-body-md text-on-surface bg-surface focus:outline-none focus:ring-2 focus:ring-primary resize-none"
                disabled={isPending}
              />
              {error && (
                <p role="alert" className="font-body-sm text-body-sm text-error">
                  {error}
                </p>
              )}
              <button
                type="submit"
                disabled={isPending || !answer.trim()}
                className="self-end bg-primary text-on-primary font-label-lg text-label-lg px-6 py-2.5 rounded-full disabled:opacity-50 transition-opacity"
              >
                {isPending ? "Checking…" : "Submit answer"}
              </button>
            </form>
          )}

          {phase === "feedback" && feedback && (
            <div className="flex flex-col gap-stack-sm">
              <div
                className={`rounded-2xl px-stack-md py-stack-sm border ${
                  feedback.isCorrect
                    ? "bg-secondary-container border-secondary text-on-secondary-container"
                    : "bg-error-container border-error text-on-error-container"
                }`}
              >
                <div className="flex items-center gap-2 mb-2">
                  <span className="material-symbols-outlined text-xl" aria-hidden="true">
                    {feedback.isCorrect ? "check_circle" : "cancel"}
                  </span>
                  <span className="font-headline-sm text-headline-sm">
                    {feedback.isCorrect ? "Correct!" : "Not quite"}
                  </span>
                </div>
                <p className="font-body-md text-body-md">{feedback.text}</p>
              </div>

              <p className="font-body-sm text-body-sm text-on-surface-variant">
                Your answer: <em className="not-italic text-on-surface">{answer}</em>
              </p>

              {generationFailed && (
                <p role="alert" className="font-body-sm text-body-sm text-error">
                  Could not load the next question. Tap &quot;Try again&quot; to continue.
                </p>
              )}

              {error && (
                <p role="alert" className="font-body-sm text-body-sm text-error">
                  {error}
                </p>
              )}

              <button
                onClick={generationFailed ? handleRetryGeneration : handleContinue}
                disabled={isPending}
                className="self-end bg-primary text-on-primary font-label-lg text-label-lg px-6 py-2.5 rounded-full disabled:opacity-50 transition-opacity"
              >
                {isPending ? "Loading…" : generationFailed ? "Try again" : "Next question"}
              </button>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

function humanQuestionType(type: string): string {
  const map: Record<string, string> = {
    recall: "Recall",
    understanding: "Understanding",
    application: "Application",
    comparison: "Comparison",
    problem_solving: "Problem solving",
    find_mistake: "Find the mistake",
    changed_detail: "What if?",
  };
  return map[type] ?? type;
}

function CompletionScreen({
  summary,
  onRestart,
  onGoToToday,
}: {
  summary: PracticeSummary;
  onRestart: () => void;
  onGoToToday: () => void;
}) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-container-margin gap-stack-md text-center">
      <span className="material-symbols-outlined text-5xl text-primary" aria-hidden="true">
        celebration
      </span>
      <h1 className="font-headline-lg text-headline-lg text-on-surface">Session complete!</h1>
      <p className="font-body-md text-body-md text-on-surface-variant">
        {summary.subjectName}
        {summary.topicName && ` · ${summary.topicName}`}
      </p>

      <div className="flex gap-stack-md">
        <StatPill label="Questions" value={String(summary.questionsAnswered)} />
        <StatPill label="Correct" value={String(summary.correctCount)} />
        <StatPill label="Accuracy" value={`${summary.accuracy}%`} />
      </div>

      <p className="font-body-md text-body-md text-on-surface-variant max-w-xs">
        {summary.accuracy >= 80
          ? "Excellent work — you're making real progress on this material."
          : summary.accuracy >= 60
            ? "Good effort. Keep practising the tricky concepts and you'll nail it."
            : "A solid start. More practice will build confidence — you've got this."}
      </p>

      <div className="flex gap-3 flex-wrap justify-center">
        <button
          onClick={onRestart}
          className="bg-primary text-on-primary font-label-lg text-label-lg px-6 py-2.5 rounded-full"
        >
          More coursework
        </button>
        <button
          onClick={onGoToToday}
          className="border border-outline-variant text-on-surface font-label-lg text-label-lg px-6 py-2.5 rounded-full hover:bg-surface-container-low transition-colors"
        >
          Back to Today
        </button>
      </div>
    </div>
  );
}

function StatPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col items-center bg-surface-container-lowest border border-outline-variant rounded-xl px-5 py-3 min-w-[80px]">
      <span className="font-headline-md text-headline-md text-primary">{value}</span>
      <span className="font-label-sm text-label-sm text-on-surface-variant">{label}</span>
    </div>
  );
}
