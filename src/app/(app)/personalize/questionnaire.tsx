"use client";

import { useState, useReducer, useTransition } from "react";
import { useRouter } from "next/navigation";

import {
  savePersonalizationAction,
  skipPersonalizationAction,
  type PersonalizationActionState,
} from "@/server/actions/personalization";
import type { PersonalizationAnswers, AgeGroup, FocusBand, StudyHabit, StudyChallenge, StudyGoal, MemoryRating } from "@/lib/personalization/types";

type Answers = Partial<PersonalizationAnswers>;

type AnswerAction =
  | { type: "SET_AGE"; value: AgeGroup }
  | { type: "SET_FOCUS"; value: FocusBand }
  | { type: "SET_HABIT"; value: StudyHabit }
  | { type: "SET_CHALLENGE"; value: StudyChallenge }
  | { type: "SET_GOAL"; value: StudyGoal }
  | { type: "SET_MEMORY"; value: MemoryRating };

function reducer(state: Answers, action: AnswerAction): Answers {
  switch (action.type) {
    case "SET_AGE": return { ...state, ageGroup: action.value };
    case "SET_FOCUS": return { ...state, focusBand: action.value };
    case "SET_HABIT": return { ...state, studyHabit: action.value };
    case "SET_CHALLENGE": return { ...state, studyChallenge: action.value };
    case "SET_GOAL": return { ...state, studyGoal: action.value };
    case "SET_MEMORY": return { ...state, memoryRating: action.value };
  }
}

function isComplete(a: Answers): a is PersonalizationAnswers {
  return !!(a.ageGroup && a.focusBand && a.studyHabit && a.studyChallenge && a.studyGoal && a.memoryRating);
}

export function Questionnaire({ existingAnswers }: { existingAnswers: Partial<PersonalizationAnswers> | null }) {
  const router = useRouter();
  const [answers, dispatch] = useReducer(reducer, existingAnswers ?? {});
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleSubmit = () => {
    if (!isComplete(answers)) {
      setError("Please answer all six questions before saving.");
      return;
    }
    setError(null);
    startTransition(async () => {
      const result: PersonalizationActionState = await savePersonalizationAction(null, answers);
      if (result && !result.ok) setError(result.error);
    });
  };

  const handleSkip = () => {
    startTransition(async () => {
      await skipPersonalizationAction();
      router.push("/today");
    });
  };

  return (
    <div className="flex flex-col gap-stack-lg">
      <Question
        number={1}
        label="How old are you?"
        options={[
          { value: "younger" as AgeGroup, label: "14 or 15" },
          { value: "older" as AgeGroup, label: "16 or 17" },
          { value: "adult" as AgeGroup, label: "18 or older" },
        ]}
        selected={answers.ageGroup}
        onSelect={(v) => dispatch({ type: "SET_AGE", value: v as AgeGroup })}
      />

      <Question
        number={2}
        label="When you study, how long can you focus before your mind wanders?"
        options={[
          { value: "short" as FocusBand, label: "Under 20 minutes" },
          { value: "medium" as FocusBand, label: "20–40 minutes" },
          { value: "long" as FocusBand, label: "40–60 minutes" },
          { value: "very_long" as FocusBand, label: "Over an hour" },
        ]}
        selected={answers.focusBand}
        onSelect={(v) => dispatch({ type: "SET_FOCUS", value: v as FocusBand })}
      />

      <Question
        number={3}
        label="When you study, what do you usually do?"
        options={[
          { value: "passive" as StudyHabit, label: "Re-read my notes or textbook" },
          { value: "note_taking" as StudyHabit, label: "Make notes from scratch" },
          { value: "active" as StudyHabit, label: "Quiz myself or do practice questions" },
          { value: "flashcards" as StudyHabit, label: "Use flashcards" },
          { value: "passive_media" as StudyHabit, label: "Watch videos or listen to podcasts" },
        ]}
        selected={answers.studyHabit}
        onSelect={(v) => dispatch({ type: "SET_HABIT", value: v as StudyHabit })}
      />

      <Question
        number={4}
        label="What's your biggest study challenge?"
        options={[
          { value: "focus" as StudyChallenge, label: "Staying focused and not getting distracted" },
          { value: "memory" as StudyChallenge, label: "Remembering what I studied" },
          { value: "understanding" as StudyChallenge, label: "Understanding difficult concepts" },
          { value: "prioritization" as StudyChallenge, label: "Knowing what to study first" },
        ]}
        selected={answers.studyChallenge}
        onSelect={(v) => dispatch({ type: "SET_CHALLENGE", value: v as StudyChallenge })}
      />

      <Question
        number={5}
        label="What's your main goal right now?"
        options={[
          { value: "pass" as StudyGoal, label: "Just pass my exams" },
          { value: "excel" as StudyGoal, label: "Get high grades" },
          { value: "mastery" as StudyGoal, label: "Really understand the subject deeply" },
          { value: "habits" as StudyGoal, label: "Build better study habits" },
        ]}
        selected={answers.studyGoal}
        onSelect={(v) => dispatch({ type: "SET_GOAL", value: v as StudyGoal })}
      />

      <Question
        number={6}
        label="How good is your memory? (be honest)"
        options={[
          { value: "strong" as MemoryRating, label: "Very strong — I remember most things" },
          { value: "average" as MemoryRating, label: "Average — I forget if I don't review" },
          { value: "weak" as MemoryRating, label: "Not great — I need to review a lot" },
          { value: "very_weak" as MemoryRating, label: "Poor — I forget things quickly" },
        ]}
        selected={answers.memoryRating}
        onSelect={(v) => dispatch({ type: "SET_MEMORY", value: v as MemoryRating })}
      />

      {error && (
        <p role="alert" className="font-label-md text-label-md text-error">
          {error}
        </p>
      )}

      <div className="flex items-center justify-between gap-4 pt-2 border-t border-outline-variant">
        <button
          type="button"
          onClick={handleSkip}
          disabled={isPending}
          className="font-label-md text-label-md text-on-surface-variant hover:text-primary transition-colors disabled:opacity-40"
        >
          Skip for now
        </button>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={isPending || !isComplete(answers)}
          aria-busy={isPending}
          className="bg-primary text-on-primary font-label-md text-label-md px-6 py-3 rounded-lg hover:opacity-90 transition-opacity shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isPending ? "Saving…" : "Save preferences"}
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Reusable question + options component
// ---------------------------------------------------------------------------

function Question<T extends string>({
  number,
  label,
  options,
  selected,
  onSelect,
}: {
  number: number;
  label: string;
  options: { value: T; label: string }[];
  selected: T | undefined;
  onSelect: (value: T) => void;
}) {
  return (
    <section>
      <h2 className="font-label-md text-label-md text-on-surface-variant uppercase tracking-wider mb-3">
        {number}. {label}
      </h2>
      <div className="flex flex-col gap-2">
        {options.map((opt) => {
          const isSelected = selected === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => onSelect(opt.value)}
              aria-pressed={isSelected}
              className={`text-left border rounded-lg px-4 py-3 font-body-md text-body-md transition-all ${
                isSelected
                  ? "border-primary bg-secondary-container/20 text-on-surface"
                  : "border-outline-variant hover:border-primary text-on-surface-variant hover:text-on-surface"
              }`}
            >
              {opt.label}
            </button>
          );
        })}
      </div>
    </section>
  );
}

