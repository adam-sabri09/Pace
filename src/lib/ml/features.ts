/**
 * Feature encoding for ML models.
 *
 * All features are normalised to [0, 1] so that Euclidean distance in
 * KNN is not dominated by high-magnitude columns.
 *
 * Categorical features use one-hot encoding; ordinal features are mapped
 * linearly to [0, 1].
 */

import type { TechniqueKey } from "@/lib/personalization/types";

// ---------------------------------------------------------------------------
// Student feature vector
// ---------------------------------------------------------------------------

export type StudentFeatures = {
  /** age_band encoded: junior=0, intermediate=0.25, senior=0.5, university=0.75, adult=1 */
  ageBand: number;
  /** memory_score / 100 (0-1). 0.5 if unknown. */
  memoryScore: number;
  /** 1 if study_habits includes flashcards, else 0 */
  usesFlashcards: number;
  /** 1 if study_habits includes practice_questions, else 0 */
  usesPracticeQuestions: number;
  /** 1 if study_habits includes notes, else 0 */
  usesNotes: number;
  /** 1 if study_habits includes videos, else 0 */
  usesVideos: number;
  /** session completion rate 0-1 across all sessions. 0.5 if no data. */
  completionRate: number;
  /** average confidence_pct / 100 across subjects. 0.5 if no data. */
  avgConfidence: number;
};

const AGE_BAND_MAP: Record<string, number> = {
  junior: 0,
  intermediate: 0.25,
  senior: 0.5,
  university: 0.75,
  adult: 1,
};

export function encodeFeatures(opts: {
  ageBand: string | null;
  memoryScore: number | null;
  studyHabits: string[];
  completionRate: number | null;
  avgConfidence: number | null;
}): StudentFeatures {
  return {
    ageBand: AGE_BAND_MAP[opts.ageBand ?? ""] ?? 0.5,
    memoryScore: opts.memoryScore != null ? opts.memoryScore / 100 : 0.5,
    usesFlashcards: opts.studyHabits.includes("flashcards") ? 1 : 0,
    usesPracticeQuestions: opts.studyHabits.includes("practice_questions") ? 1 : 0,
    usesNotes: opts.studyHabits.includes("notes") ? 1 : 0,
    usesVideos: opts.studyHabits.includes("videos") ? 1 : 0,
    completionRate: opts.completionRate ?? 0.5,
    avgConfidence: opts.avgConfidence != null ? opts.avgConfidence / 100 : 0.5,
  };
}

export function featureVector(f: StudentFeatures): number[] {
  return [
    f.ageBand,
    f.memoryScore,
    f.usesFlashcards,
    f.usesPracticeQuestions,
    f.usesNotes,
    f.usesVideos,
    f.completionRate,
    f.avgConfidence,
  ];
}

// ---------------------------------------------------------------------------
// Labelled training example
// ---------------------------------------------------------------------------

export type TrainingExample = {
  features: StudentFeatures;
  /** The technique that worked best for this student (top technique from scoring). */
  technique: TechniqueKey;
};
