"use client";

import { useState, useTransition } from "react";

import { updateSubjectIntelligenceAction } from "@/server/actions/subject-intelligence";
import type { Difficulty } from "@/lib/personalization/types";

interface Props {
  subjectId: string;
  initialDifficulty: Difficulty | null;
  initialConfidencePct: number | null;
}

const DIFFICULTY_OPTIONS: { value: Difficulty; label: string }[] = [
  { value: "easy", label: "Easy" },
  { value: "medium", label: "Medium" },
  { value: "hard", label: "Hard" },
];

export function SubjectIntelligenceForm({
  subjectId,
  initialDifficulty,
  initialConfidencePct,
}: Props) {
  const [difficulty, setDifficulty] = useState<Difficulty | null>(initialDifficulty);
  const [confidencePct, setConfidencePct] = useState<number | null>(initialConfidencePct);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleSave = () => {
    setSaved(false);
    setError(null);
    startTransition(async () => {
      const result = await updateSubjectIntelligenceAction(subjectId, difficulty, confidencePct);
      if (result.ok) {
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
      } else {
        setError(result.error);
      }
    });
  };

  const isDirty =
    difficulty !== initialDifficulty || confidencePct !== initialConfidencePct;

  return (
    <div className="mt-stack-sm pt-stack-sm border-t border-outline-variant flex flex-col sm:flex-row sm:items-end gap-4">
      <div className="flex flex-col gap-1">
        <label className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider">
          How hard is this subject?
        </label>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setDifficulty(null)}
            className={`font-label-md text-label-md px-3 py-1.5 rounded border transition-all ${
              difficulty == null
                ? "border-primary bg-primary/10 text-primary"
                : "border-outline-variant text-on-surface-variant hover:border-primary"
            }`}
          >
            Not set
          </button>
          {DIFFICULTY_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setDifficulty(opt.value)}
              aria-pressed={difficulty === opt.value}
              className={`font-label-md text-label-md px-3 py-1.5 rounded border transition-all ${
                difficulty === opt.value
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-outline-variant text-on-surface-variant hover:border-primary"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <label
          htmlFor={`confidence-${subjectId}`}
          className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider"
        >
          Confidence: {confidencePct != null ? `${confidencePct}%` : "not set"}
        </label>
        <input
          id={`confidence-${subjectId}`}
          type="range"
          min={0}
          max={100}
          step={5}
          value={confidencePct ?? 50}
          onChange={(e) => setConfidencePct(Number(e.target.value))}
          className="w-40 accent-primary"
        />
      </div>

      <div className="flex items-center gap-3">
        {confidencePct != null && (
          <button
            type="button"
            onClick={() => setConfidencePct(null)}
            className="font-label-sm text-label-sm text-on-surface-variant hover:text-primary transition-colors"
          >
            Clear confidence
          </button>
        )}
        <button
          type="button"
          onClick={handleSave}
          disabled={isPending || !isDirty}
          aria-busy={isPending}
          className="font-label-md text-label-md px-4 py-1.5 rounded-lg bg-primary text-on-primary hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {isPending ? "Saving…" : saved ? "Saved" : "Save"}
        </button>
        {error && (
          <p role="alert" className="font-label-sm text-label-sm text-error">
            {error}
          </p>
        )}
      </div>
    </div>
  );
}
