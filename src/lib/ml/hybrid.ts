/**
 * Hybrid rule-based + ML recommendation system.
 *
 * Strategy:
 *  - When the platform has fewer than KNN_MIN_SAMPLES labelled students,
 *    fall back to the hand-authored static scoring (scoring.ts).
 *  - When enough data exists, use KNN to recommend a technique based on
 *    similar students' outcomes.
 *
 * The two paths produce the same output type (TechniqueKey + confidence)
 * so callers don't need to distinguish them.
 *
 * For confidence estimation via linear regression:
 *  - When fewer than LR_MIN_SAMPLES (subject, completion_rate, confidence_pct)
 *    triples exist, use the student's manually-set confidence_pct directly.
 *  - When enough data exists, blend: 0.6 × model_prediction + 0.4 × manual.
 */

import type { TechniqueKey } from "@/lib/personalization/types";
import { encodeFeatures, type TrainingExample } from "./features";
import { knnRecommend } from "./knn";
import { fitLinearRegression, predict } from "./linear-regression";

/** Minimum labelled users needed before switching to KNN. */
export const KNN_MIN_SAMPLES = 10;

/** Minimum (completion_rate, confidence_pct) pairs for linear regression. */
export const LR_MIN_SAMPLES = 5;

// ---------------------------------------------------------------------------
// KNN technique selection
// ---------------------------------------------------------------------------

export type HybridTechniqueResult = {
  technique: TechniqueKey;
  /** 0-100 system confidence in the recommendation. */
  systemConfidence: number;
  /** "ml" | "rules" */
  source: "ml" | "rules";
};

/**
 * Select the best study technique for the target student.
 *
 * @param target        - target student's raw profile data
 * @param examples      - labelled training data from other students
 * @param rulesTopTechnique - the technique the rule-based scorer recommends
 * @param rulesConfidence   - 0-100 rule-based system confidence
 */
export function selectTechnique(opts: {
  target: {
    ageBand: string | null;
    memoryScore: number | null;
    studyHabits: string[];
    completionRate: number | null;
    avgConfidence: number | null;
  };
  examples: TrainingExample[];
  rulesTopTechnique: TechniqueKey;
  rulesConfidence: number;
}): HybridTechniqueResult {
  if (opts.examples.length < KNN_MIN_SAMPLES) {
    return {
      technique: opts.rulesTopTechnique,
      systemConfidence: opts.rulesConfidence,
      source: "rules",
    };
  }

  const targetFeatures = encodeFeatures(opts.target);
  const knnResult = knnRecommend(targetFeatures, opts.examples, 7);

  if (!knnResult) {
    return {
      technique: opts.rulesTopTechnique,
      systemConfidence: opts.rulesConfidence,
      source: "rules",
    };
  }

  // Blend KNN confidence with rule confidence (70/30 once we have data).
  const blendedConfidence = Math.round(
    0.7 * knnResult.confidence * 100 + 0.3 * opts.rulesConfidence,
  );

  return {
    technique: knnResult.technique,
    systemConfidence: Math.min(100, blendedConfidence),
    source: "ml",
  };
}

// ---------------------------------------------------------------------------
// Linear-regression confidence estimation
// ---------------------------------------------------------------------------

export type HybridConfidenceResult = {
  /** Blended confidence estimate 0-100. */
  estimatedConfidence: number;
  source: "ml" | "manual";
};

/**
 * Estimate a subject's confidence level from session completion history.
 *
 * @param manualConfidence - student's self-reported confidence (or null)
 * @param dataPoints       - [completion_rate, manual_confidence] pairs from other students
 * @param targetCompletionRate - this student's completion rate for this subject
 */
export function estimateConfidence(opts: {
  manualConfidence: number | null;
  dataPoints: Array<[number, number]>; // [completion_rate 0-1, confidence_pct 0-100]
  targetCompletionRate: number;
}): HybridConfidenceResult {
  const manual = opts.manualConfidence ?? 50;

  if (opts.dataPoints.length < LR_MIN_SAMPLES) {
    return { estimatedConfidence: manual, source: "manual" };
  }

  const X = opts.dataPoints.map(([cr]) => [cr]);
  const y = opts.dataPoints.map(([, conf]) => conf);
  const model = fitLinearRegression(X, y);

  if (!model) {
    return { estimatedConfidence: manual, source: "manual" };
  }

  const predicted = predict(model, [opts.targetCompletionRate]);
  // Blend: 60% model + 40% manual (trust the student's self-assessment).
  const blended = Math.round(0.6 * predicted + 0.4 * manual);

  return {
    estimatedConfidence: Math.max(0, Math.min(100, blended)),
    source: "ml",
  };
}
