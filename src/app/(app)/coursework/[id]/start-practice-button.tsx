"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { startPracticeAction } from "@/server/actions/practice";
import { updateCourseworkDifficultyAction } from "@/server/actions/coursework";
import type { Difficulty } from "@/lib/practice/difficulty";

const DIFFICULTIES: { value: Difficulty; label: string }[] = [
  { value: 1, label: "Easy" },
  { value: 2, label: "Medium" },
  { value: 3, label: "Hard" },
];

export function StartPracticeButton({
  courseworkItemId,
  initialDifficulty = 2,
}: {
  courseworkItemId: string;
  initialDifficulty?: Difficulty;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [difficulty, setDifficulty] = useState<Difficulty>(initialDifficulty);

  const difficultyLabel = DIFFICULTIES.find((d) => d.value === difficulty)?.label ?? "Medium";

  function handleClick() {
    startTransition(async () => {
      // Persist the chosen difficulty non-fatally — practice still starts if this fails.
      await updateCourseworkDifficultyAction(courseworkItemId, difficulty);
      const result = await startPracticeAction(courseworkItemId, difficulty);
      if (!result.ok) {
        alert(result.error);
        return;
      }
      router.push(`/practice/${result.state.sessionId}`);
    });
  }

  return (
    <div className="flex flex-col items-center gap-3">
      <p className="font-label-md text-label-md text-on-surface-variant">
        Difficulty: {difficultyLabel}
      </p>
      <div
        role="group"
        aria-label="Starting difficulty"
        className="flex gap-1"
      >
        {DIFFICULTIES.map((d) => (
          <button
            key={d.value}
            type="button"
            onClick={() => setDifficulty(d.value)}
            aria-pressed={difficulty === d.value}
            className={`font-label-sm text-label-sm px-3 py-1 rounded-full border transition-colors ${
              difficulty === d.value
                ? "bg-primary text-on-primary border-primary"
                : "bg-transparent text-on-surface-variant border-outline-variant hover:border-primary/50 hover:text-on-surface"
            }`}
          >
            {d.label}
          </button>
        ))}
      </div>
      <p className="font-label-sm text-label-sm text-on-surface-variant">
        Adjusts as you practise
      </p>
      <button
        onClick={handleClick}
        disabled={isPending}
        className="px-8 py-3 font-label-lg text-label-lg bg-primary text-on-primary rounded-full disabled:opacity-50 transition-opacity"
      >
        {isPending ? "Starting…" : "Practice now"}
      </button>
    </div>
  );
}
