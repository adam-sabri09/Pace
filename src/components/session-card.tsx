"use client";

import { useTransition, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import {
  markDoneAction,
  markMissedAction,
  submitFeedbackAction,
} from "@/server/actions/sessions";

export type SessionStatus = "scheduled" | "completed" | "missed";

export type SessionCardProps = {
  id: string;
  status: SessionStatus;
  subjectName: string;
  topicName: string;
  timeRange: string; // "16:00 – 16:45"
  durationMinutes: number;
  instruction: string;
};

/**
 * Horizontal 3-zone card on desktop, stacked with buttons below on mobile
 * (Choice 5-A). Renders three status variants; Complete/Missed appear only
 * on `scheduled`. Optimistic pending state via useTransition — the
 * server action revalidates /today and /plan on success (see
 * src/server/actions/sessions.ts).
 */
export function SessionCard({
  id,
  status,
  subjectName,
  topicName,
  timeRange,
  durationMinutes,
  instruction,
}: SessionCardProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [justCompleted, setJustCompleted] = useState(false);
  const [feedbackDone, setFeedbackDone] = useState(false);

  const isActive = status === "scheduled";
  const isDone = status === "completed";
  const isMissed = status === "missed";

  const runMarkDone = () => {
    startTransition(async () => {
      const result = await markDoneAction(id);
      if (result?.ok) setJustCompleted(true);
    });
  };

  const runMarkMissed = () => {
    startTransition(async () => {
      await markMissedAction(id);
    });
  };

  const submitConfidence = (confidence: number) => {
    startTransition(async () => {
      await submitFeedbackAction(id, confidence);
      setFeedbackDone(true);
      router.refresh();
    });
  };

  const handleSkip = () => {
    setFeedbackDone(true);
    router.refresh();
  };

  const containerCls =
    "bg-surface-container-lowest border border-outline-variant rounded-lg overflow-hidden relative" +
    (isDone || isMissed ? " opacity-70" : "");

  return (
    <>
    <article className={containerCls} data-testid="session-card" data-status={status}>
      <div className="absolute left-0 top-0 bottom-0 w-1 bg-outline-variant" aria-hidden="true" />
      <div className="flex flex-col sm:flex-row sm:items-center">
        <div className="flex-1 p-4 pl-6 flex flex-col sm:flex-row gap-3 sm:gap-6 sm:items-center">
          <div className="flex flex-col gap-1 sm:w-36 shrink-0">
            <span className="font-label-sm text-label-sm bg-secondary-container text-on-secondary-container px-2 py-1 rounded inline-block w-fit">
              {subjectName}
            </span>
            <span className="font-body-md text-body-md text-on-surface-variant flex items-center gap-1">
              <span className="material-symbols-outlined text-[16px]" aria-hidden="true">
                schedule
              </span>
              {timeRange} · {durationMinutes} min
            </span>
          </div>
          <div className="flex-1">
            <h3
              className={
                "font-headline-md text-headline-md text-on-surface" +
                (isDone || isMissed ? " line-through" : "")
              }
            >
              {topicName}
            </h3>
            <p className="font-body-md text-body-md text-on-surface-variant mt-1">
              {instruction}
            </p>
            <p
              className={
                "font-label-sm text-label-sm mt-1 tracking-wider uppercase " +
                (isDone
                  ? "text-primary"
                  : isMissed
                    ? "text-outline"
                    : "text-on-surface-variant")
              }
            >
              {isDone ? "Completed" : isMissed ? "Missed" : "Upcoming"}
            </p>
          </div>
        </div>
        {isActive && !justCompleted && (
          <div className="flex flex-col gap-2 p-4 pt-0 sm:pt-4 border-t sm:border-t-0 sm:border-l border-outline-variant sm:w-48 sm:justify-center">
            <Link
              href={`/study/${id}`}
              className="w-full text-center px-4 py-2 font-label-md text-label-md bg-primary text-on-primary rounded-lg hover:opacity-90 transition-opacity"
            >
              Start session
            </Link>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={runMarkMissed}
                disabled={isPending}
                aria-busy={isPending}
                className="flex-1 px-3 py-2 font-label-sm text-label-sm border border-outline text-on-surface-variant rounded-lg hover:bg-surface-variant transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Missed
              </button>
              <button
                type="button"
                onClick={runMarkDone}
                disabled={isPending}
                aria-busy={isPending}
                className="flex-1 px-3 py-2 font-label-sm text-label-sm bg-primary-container text-on-primary rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1"
              >
                <span className="material-symbols-outlined text-[16px]" aria-hidden="true">
                  check_circle
                </span>
                Complete
              </button>
            </div>
          </div>
        )}
      </div>
    </article>
    {justCompleted && !feedbackDone && (
      <div className="rounded-lg border border-outline-variant bg-surface-container-lowest px-4 py-3 flex flex-col gap-2">
        <p className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider">
          How confident do you feel?
        </p>
        <div className="flex gap-2 flex-wrap">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              disabled={isPending}
              onClick={() => submitConfidence(n)}
              className="px-3 py-1.5 font-label-md text-label-md border border-outline-variant rounded-lg hover:bg-secondary-container hover:text-on-secondary-container transition-colors disabled:opacity-50"
              aria-label={`Confidence ${n} out of 5`}
            >
              {n}
            </button>
          ))}
          <button
            type="button"
            onClick={handleSkip}
            className="px-3 py-1.5 font-label-sm text-label-sm text-outline hover:text-on-surface transition-colors"
          >
            Skip
          </button>
        </div>
      </div>
    )}
    </>
  );
}
