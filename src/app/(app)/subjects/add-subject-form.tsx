"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { addSubjectAction } from "@/server/actions/subjects";
import type { Difficulty } from "@/lib/personalization/types";

const DIFFICULTY_OPTIONS: { value: Difficulty; label: string }[] = [
  { value: "easy", label: "Easy" },
  { value: "medium", label: "Medium" },
  { value: "hard", label: "Hard" },
];

export function AddSubjectForm() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [examDate, setExamDate] = useState("");
  const [topicInput, setTopicInput] = useState("");
  const [topics, setTopics] = useState<string[]>([]);
  const [difficulty, setDifficulty] = useState<Difficulty | null>(null);
  const [confidencePct, setConfidencePct] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const reset = () => {
    setName("");
    setExamDate("");
    setTopicInput("");
    setTopics([]);
    setDifficulty(null);
    setConfidencePct(null);
    setError(null);
  };

  const handleOpen = () => {
    reset();
    setOpen(true);
  };

  const handleClose = () => {
    reset();
    setOpen(false);
  };

  const handleAddTopic = () => {
    const t = topicInput.trim();
    if (!t) return;
    setTopics((prev) => [...prev, t]);
    setTopicInput("");
  };

  const handleRemoveTopic = (i: number) => {
    setTopics((prev) => prev.filter((_, idx) => idx !== i));
  };

  const handleSubmit = () => {
    setError(null);
    startTransition(async () => {
      const result = await addSubjectAction({
        name: name.trim(),
        examDate: examDate || null,
        topics,
        difficulty,
        confidencePct,
      });
      if (result.ok) {
        router.refresh();
        reset();
        setOpen(false);
      } else {
        setError(result.error);
      }
    });
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={handleOpen}
        className="self-start flex items-center gap-2 font-label-md text-label-md text-primary border border-primary/30 px-4 py-2 rounded-lg hover:bg-primary/5 transition-colors"
      >
        <span className="material-symbols-outlined text-[18px]" aria-hidden="true">
          add
        </span>
        Add subject
      </button>
    );
  }

  return (
    <section
      aria-label="New subject form"
      className="border border-primary/30 rounded-xl p-stack-md bg-surface-container-lowest"
    >
      <div className="flex items-center justify-between mb-stack-sm">
        <h2 className="font-headline-md text-headline-md text-on-surface">New subject</h2>
        <button
          type="button"
          onClick={handleClose}
          aria-label="Cancel adding subject"
          className="text-on-surface-variant hover:text-on-surface transition-colors"
        >
          <span className="material-symbols-outlined" aria-hidden="true">
            close
          </span>
        </button>
      </div>

      <div className="flex flex-col gap-4">
        {/* Subject name */}
        <div className="flex flex-col gap-1">
          <label
            htmlFor="add-subject-name"
            className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider"
          >
            Subject name <span aria-hidden="true">*</span>
          </label>
          <input
            id="add-subject-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Mathematics"
            maxLength={100}
            className="border border-outline-variant rounded-lg px-3 py-2 font-body-md text-body-md text-on-surface bg-surface focus:border-primary focus:outline-none"
          />
        </div>

        {/* Exam date */}
        <div className="flex flex-col gap-1">
          <label
            htmlFor="add-subject-exam-date"
            className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider"
          >
            Exam date (optional)
          </label>
          <input
            id="add-subject-exam-date"
            type="date"
            value={examDate}
            onChange={(e) => setExamDate(e.target.value)}
            className="border border-outline-variant rounded-lg px-3 py-2 font-body-md text-body-md text-on-surface bg-surface focus:border-primary focus:outline-none w-48"
          />
        </div>

        {/* Topics */}
        <div className="flex flex-col gap-2">
          <span className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider">
            Topics (optional)
          </span>
          {topics.length > 0 && (
            <ul className="flex flex-col gap-1">
              {topics.map((t, i) => (
                <li
                  key={i}
                  className="flex items-center justify-between gap-2 bg-surface-container-low rounded px-3 py-1.5"
                >
                  <span className="font-body-md text-body-md text-on-surface">{t}</span>
                  <button
                    type="button"
                    onClick={() => handleRemoveTopic(i)}
                    aria-label={`Remove topic ${t}`}
                    className="text-on-surface-variant hover:text-error transition-colors"
                  >
                    <span className="material-symbols-outlined text-[16px]" aria-hidden="true">
                      close
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          <div className="flex gap-2">
            <input
              type="text"
              value={topicInput}
              onChange={(e) => setTopicInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleAddTopic();
                }
              }}
              placeholder="e.g. Algebra"
              maxLength={200}
              aria-label="Topic name"
              className="flex-1 border border-outline-variant rounded-lg px-3 py-2 font-body-md text-body-md text-on-surface bg-surface focus:border-primary focus:outline-none"
            />
            <button
              type="button"
              onClick={handleAddTopic}
              disabled={!topicInput.trim()}
              className="font-label-md text-label-md px-3 py-2 rounded-lg border border-outline-variant text-on-surface-variant hover:border-primary hover:text-primary transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Add
            </button>
          </div>
        </div>

        {/* Difficulty */}
        <div className="flex flex-col gap-1">
          <span className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider">
            Difficulty (optional)
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setDifficulty(null)}
              aria-pressed={difficulty === null}
              className={`font-label-md text-label-md px-3 py-1.5 rounded border transition-all ${
                difficulty === null
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

        {/* Confidence */}
        <div className="flex flex-col gap-1">
          <label
            htmlFor="add-subject-confidence"
            className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider"
          >
            Confidence:{" "}
            {confidencePct != null ? `${confidencePct}%` : "not set"}
          </label>
          <div className="flex items-center gap-3">
            <input
              id="add-subject-confidence"
              type="range"
              min={0}
              max={100}
              step={5}
              value={confidencePct ?? 50}
              onChange={(e) => setConfidencePct(Number(e.target.value))}
              className="w-40 accent-primary"
            />
            {confidencePct != null && (
              <button
                type="button"
                onClick={() => setConfidencePct(null)}
                className="font-label-sm text-label-sm text-on-surface-variant hover:text-primary transition-colors"
              >
                Clear
              </button>
            )}
          </div>
        </div>

        {/* Error */}
        {error && (
          <p role="alert" className="font-label-sm text-label-sm text-error">
            {error}
          </p>
        )}

        {/* Actions */}
        <div className="flex gap-3 pt-1">
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isPending || !name.trim()}
            aria-busy={isPending}
            className="font-label-md text-label-md px-6 py-2 rounded-lg bg-primary text-on-primary hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {isPending ? "Saving…" : "Add subject"}
          </button>
          <button
            type="button"
            onClick={handleClose}
            className="font-label-md text-label-md px-4 py-2 rounded-lg border border-outline-variant text-on-surface-variant hover:bg-surface-container-low transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </section>
  );
}
