"use client";

import { useState, useTransition, useRef } from "react";
import { useRouter } from "next/navigation";

import {
  extractScheduleAction,
  saveOcrSubjectsAction,
  type OcrExtracted,
} from "@/server/actions/ocr";
import type { Difficulty } from "@/lib/personalization/types";

// ---------------------------------------------------------------------------
// Local types
// ---------------------------------------------------------------------------

interface EditableSubject {
  name: string;
  examDate: string; // empty string = null
  topics: string[];
  difficulty: Difficulty | null;
  confidencePct: number | null;
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function UploadForm() {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [subjects, setSubjects] = useState<EditableSubject[] | null>(null);
  const [extractError, setExtractError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isExtracting, startExtract] = useTransition();
  const [isSaving, startSave] = useTransition();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setExtractError(null);
    setSubjects(null);
    if (file.type.startsWith("image/")) {
      const url = URL.createObjectURL(file);
      setFilePreview(url);
    } else {
      setFilePreview(null);
    }
  };

  const handleExtract = () => {
    const file = fileRef.current?.files?.[0];
    if (!file) {
      setExtractError("Please choose a file first.");
      return;
    }
    setExtractError(null);
    const fd = new FormData();
    fd.append("schedule", file);
    startExtract(async () => {
      const result = await extractScheduleAction(fd);
      if (!result.ok) {
        setExtractError(result.error);
        return;
      }
      setSubjects(mapExtracted(result.extracted));
    });
  };

  const handleSave = () => {
    if (!subjects) return;
    setSaveError(null);
    const payload = subjects.map((s) => ({
      name: s.name,
      examDate: s.examDate.trim() || null,
      topics: s.topics.filter((t) => t.trim().length > 0),
      difficulty: s.difficulty,
      confidencePct: s.confidencePct,
    }));
    startSave(async () => {
      const result = await saveOcrSubjectsAction(payload);
      if (!result.ok) {
        setSaveError(result.error);
        return;
      }
      router.push("/today");
    });
  };

  return (
    <div className="flex flex-col gap-stack-lg">
      {/* File picker */}
      <section className="border-2 border-dashed border-outline-variant rounded-xl p-8 flex flex-col items-center gap-4 text-center">
        {filePreview && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={filePreview}
            alt="Schedule preview"
            className="max-h-64 rounded-lg border border-outline-variant object-contain"
          />
        )}
        {fileName && !filePreview && (
          <div className="flex items-center gap-2 text-on-surface-variant">
            <span className="material-symbols-outlined">description</span>
            <span className="font-body-md text-body-md">{fileName}</span>
          </div>
        )}
        <input
          ref={fileRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif,application/pdf,text/plain"
          className="sr-only"
          id="schedule-file"
          onChange={handleFileChange}
        />
        <label
          htmlFor="schedule-file"
          className="cursor-pointer font-label-md text-label-md text-primary border border-primary/30 px-4 py-2 rounded-lg hover:bg-primary/5 transition-colors"
        >
          {fileName ? "Choose a different file" : "Choose a photo or PDF"}
        </label>
        <p className="font-label-sm text-label-sm text-on-surface-variant">
          JPEG, PNG, WebP, GIF, or PDF — max 5 MB
        </p>
      </section>

      {fileName && !subjects && (
        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={handleExtract}
            disabled={isExtracting}
            aria-busy={isExtracting}
            className="bg-primary text-on-primary font-label-md text-label-md px-6 py-3 rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50 shadow-sm"
          >
            {isExtracting ? "Reading your schedule…" : "Extract subjects"}
          </button>
          {extractError && (
            <p role="alert" className="font-label-md text-label-md text-error">
              {extractError}
            </p>
          )}
        </div>
      )}

      {/* Confirmation / edit UI */}
      {subjects && (
        <ConfirmationSection
          subjects={subjects}
          onChange={setSubjects}
          onSave={handleSave}
          isSaving={isSaving}
          saveError={saveError}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Subject confirmation + edit section
// ---------------------------------------------------------------------------

function ConfirmationSection({
  subjects,
  onChange,
  onSave,
  isSaving,
  saveError,
}: {
  subjects: EditableSubject[];
  onChange: (s: EditableSubject[]) => void;
  onSave: () => void;
  isSaving: boolean;
  saveError: string | null;
}) {
  const updateSubject = (i: number, patch: Partial<EditableSubject>) => {
    const next = subjects.map((s, idx) => (idx === i ? { ...s, ...patch } : s));
    onChange(next);
  };

  const removeSubject = (i: number) => {
    onChange(subjects.filter((_, idx) => idx !== i));
  };

  const addSubject = () => {
    onChange([
      ...subjects,
      { name: "", examDate: "", topics: [""], difficulty: null, confidencePct: null },
    ]);
  };

  const hasErrors = subjects.some(
    (s) =>
      !s.name.trim() ||
      s.topics.filter((t) => t.trim()).length === 0,
  );

  return (
    <section className="flex flex-col gap-stack-md">
      <div className="flex items-center justify-between">
        <h2 className="font-headline-md text-headline-md text-on-surface">
          Review and confirm
        </h2>
        <p className="font-label-sm text-label-sm text-on-surface-variant">
          {subjects.length} subject{subjects.length === 1 ? "" : "s"} found
        </p>
      </div>
      <p className="font-body-md text-body-md text-on-surface-variant -mt-2">
        Check each subject carefully. Edit names, dates, and topics before saving. Nothing is saved until you click &ldquo;Save and replan&rdquo;.
      </p>

      <div className="flex flex-col gap-4">
        {subjects.map((s, i) => (
          <SubjectCard
            key={i}
            subject={s}
            onUpdate={(patch) => updateSubject(i, patch)}
            onRemove={() => removeSubject(i)}
          />
        ))}
      </div>

      <button
        type="button"
        onClick={addSubject}
        className="font-label-md text-label-md text-primary border border-primary/30 px-4 py-2 rounded-lg hover:bg-primary/5 transition-colors self-start"
      >
        + Add subject
      </button>

      {saveError && (
        <p role="alert" className="font-label-md text-label-md text-error">
          {saveError}
        </p>
      )}

      <button
        type="button"
        onClick={onSave}
        disabled={isSaving || hasErrors || subjects.length === 0}
        aria-busy={isSaving}
        className="bg-primary text-on-primary font-label-md text-label-md px-6 py-3 rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed shadow-sm self-end"
      >
        {isSaving ? "Saving and replanning…" : "Save and replan"}
      </button>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Individual subject card
// ---------------------------------------------------------------------------

function SubjectCard({
  subject,
  onUpdate,
  onRemove,
}: {
  subject: EditableSubject;
  onUpdate: (patch: Partial<EditableSubject>) => void;
  onRemove: () => void;
}) {
  const updateTopic = (i: number, value: string) => {
    const next = subject.topics.map((t, idx) => (idx === i ? value : t));
    onUpdate({ topics: next });
  };

  const removeTopic = (i: number) => {
    onUpdate({ topics: subject.topics.filter((_, idx) => idx !== i) });
  };

  const addTopic = () => {
    onUpdate({ topics: [...subject.topics, ""] });
  };

  const DIFFICULTY_OPTIONS: { value: Difficulty; label: string }[] = [
    { value: "easy", label: "Easy" },
    { value: "medium", label: "Medium" },
    { value: "hard", label: "Hard" },
  ];

  return (
    <div className="border border-outline-variant rounded-xl p-4 bg-surface-container-lowest flex flex-col gap-3">
      {/* Name + remove */}
      <div className="flex items-start gap-2">
        <div className="flex-grow">
          <label className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider block mb-1">
            Subject name
          </label>
          <input
            type="text"
            value={subject.name}
            onChange={(e) => onUpdate({ name: e.target.value })}
            placeholder="e.g. Mathematics"
            className="w-full border border-outline-variant rounded-lg px-3 py-2 font-body-md text-body-md text-on-surface bg-surface focus:border-primary focus:outline-none"
          />
        </div>
        <button
          type="button"
          onClick={onRemove}
          aria-label="Remove subject"
          className="text-on-surface-variant hover:text-error transition-colors mt-6"
        >
          <span className="material-symbols-outlined">delete</span>
        </button>
      </div>

      {/* Exam date */}
      <div>
        <label className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider block mb-1">
          Exam date (YYYY-MM-DD) — optional
        </label>
        <input
          type="date"
          value={subject.examDate}
          onChange={(e) => onUpdate({ examDate: e.target.value })}
          className="border border-outline-variant rounded-lg px-3 py-2 font-body-md text-body-md text-on-surface bg-surface focus:border-primary focus:outline-none"
        />
      </div>

      {/* Topics */}
      <div>
        <p className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider mb-2">
          Topics
        </p>
        <div className="flex flex-col gap-2">
          {subject.topics.map((topic, i) => (
            <div key={i} className="flex items-center gap-2">
              <input
                type="text"
                value={topic}
                onChange={(e) => updateTopic(i, e.target.value)}
                placeholder="Topic name"
                className="flex-grow border border-outline-variant rounded-lg px-3 py-1.5 font-body-md text-body-md text-on-surface bg-surface focus:border-primary focus:outline-none"
              />
              {subject.topics.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeTopic(i)}
                  aria-label="Remove topic"
                  className="text-on-surface-variant hover:text-error transition-colors"
                >
                  <span className="material-symbols-outlined text-base">close</span>
                </button>
              )}
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={addTopic}
          className="mt-2 font-label-sm text-label-sm text-primary hover:underline"
        >
          + Add topic
        </button>
      </div>

      {/* Difficulty + confidence (optional, collapsible in spirit — just shown inline) */}
      <div className="pt-2 border-t border-outline-variant flex flex-col sm:flex-row gap-4">
        <div>
          <p className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider mb-1">
            Difficulty
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onUpdate({ difficulty: null })}
              className={`font-label-sm text-label-sm px-2.5 py-1 rounded border transition-all ${
                subject.difficulty == null
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-outline-variant text-on-surface-variant hover:border-primary"
              }`}
            >
              —
            </button>
            {DIFFICULTY_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => onUpdate({ difficulty: opt.value })}
                aria-pressed={subject.difficulty === opt.value}
                className={`font-label-sm text-label-sm px-2.5 py-1 rounded border transition-all ${
                  subject.difficulty === opt.value
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
          <label className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider">
            Confidence: {subject.confidencePct != null ? `${subject.confidencePct}%` : "not set"}
          </label>
          <div className="flex items-center gap-2">
            <input
              type="range"
              min={0}
              max={100}
              step={5}
              value={subject.confidencePct ?? 50}
              onChange={(e) => onUpdate({ confidencePct: Number(e.target.value) })}
              className="w-28 accent-primary"
            />
            {subject.confidencePct != null && (
              <button
                type="button"
                onClick={() => onUpdate({ confidencePct: null })}
                className="font-label-sm text-label-sm text-on-surface-variant hover:text-primary transition-colors"
              >
                Clear
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

function mapExtracted(extracted: OcrExtracted): EditableSubject[] {
  return extracted.subjects.map((s) => ({
    name: s.name,
    examDate: s.examDate ?? "",
    topics: s.topics.length > 0 ? s.topics : [""],
    difficulty: null,
    confidencePct: null,
  }));
}
