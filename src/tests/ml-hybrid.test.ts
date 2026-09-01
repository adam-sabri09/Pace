import { describe, it, expect } from "vitest";
import {
  selectTechnique,
  estimateConfidence,
  KNN_MIN_SAMPLES,
  LR_MIN_SAMPLES,
} from "@/lib/ml/hybrid";
import type { TrainingExample } from "@/lib/ml/features";
import type { TechniqueKey } from "@/lib/personalization/types";

const TARGET = {
  ageBand: "senior",
  memoryScore: 60,
  studyHabits: ["flashcards"],
  completionRate: 0.7,
  avgConfidence: 55,
};

describe("selectTechnique — rule-based fallback", () => {
  it("uses rules when examples < KNN_MIN_SAMPLES", () => {
    const result = selectTechnique({
      target: TARGET,
      examples: [],
      rulesTopTechnique: "active_recall",
      rulesConfidence: 70,
    });
    expect(result.source).toBe("rules");
    expect(result.technique).toBe("active_recall");
  });

  it("confirms KNN_MIN_SAMPLES threshold is at least 5", () => {
    expect(KNN_MIN_SAMPLES).toBeGreaterThanOrEqual(5);
  });
});

describe("selectTechnique — ML path", () => {
  function makeExamples(technique: TechniqueKey, n: number): TrainingExample[] {
    return Array.from({ length: n }, () => ({
      features: {
        ageBand: 0.5,
        memoryScore: 0.6,
        usesFlashcards: 1,
        usesPracticeQuestions: 0,
        usesNotes: 0,
        usesVideos: 0,
        completionRate: 0.7,
        avgConfidence: 0.55,
      },
      technique,
    }));
  }

  it("uses ML when examples >= KNN_MIN_SAMPLES", () => {
    const examples = makeExamples("spaced_repetition", KNN_MIN_SAMPLES);
    const result = selectTechnique({
      target: TARGET,
      examples,
      rulesTopTechnique: "active_recall",
      rulesConfidence: 50,
    });
    expect(result.source).toBe("ml");
    expect(result.technique).toBe("spaced_repetition");
  });

  it("returns system confidence between 0 and 100", () => {
    const examples = makeExamples("feynman", KNN_MIN_SAMPLES);
    const result = selectTechnique({
      target: TARGET,
      examples,
      rulesTopTechnique: "active_recall",
      rulesConfidence: 50,
    });
    expect(result.systemConfidence).toBeGreaterThanOrEqual(0);
    expect(result.systemConfidence).toBeLessThanOrEqual(100);
  });
});

describe("estimateConfidence — fallback to manual", () => {
  it("uses manual confidence when dataPoints < LR_MIN_SAMPLES", () => {
    const result = estimateConfidence({
      manualConfidence: 72,
      dataPoints: [],
      targetCompletionRate: 0.8,
    });
    expect(result.source).toBe("manual");
    expect(result.estimatedConfidence).toBe(72);
  });

  it("defaults manual to 50 when null and below threshold", () => {
    const result = estimateConfidence({
      manualConfidence: null,
      dataPoints: [[0.5, 50]],
      targetCompletionRate: 0.5,
    });
    expect(result.estimatedConfidence).toBe(50);
  });

  it("confirms LR_MIN_SAMPLES threshold", () => {
    expect(LR_MIN_SAMPLES).toBeGreaterThanOrEqual(3);
  });
});

describe("estimateConfidence — ML regression path", () => {
  it("blends model prediction with manual confidence", () => {
    // Perfect data: confidence = 100 * completion_rate
    const dataPoints: Array<[number, number]> = [
      [0, 0], [0.25, 25], [0.5, 50], [0.75, 75], [1, 100],
    ];
    const result = estimateConfidence({
      manualConfidence: 60,
      dataPoints,
      targetCompletionRate: 0.7,
    });
    expect(result.source).toBe("ml");
    // model predicts ~70, manual=60 → blend = 0.6*70 + 0.4*60 = 66
    expect(result.estimatedConfidence).toBeCloseTo(66, 0);
  });

  it("clamps result to [0, 100]", () => {
    const dataPoints: Array<[number, number]> = [
      [0, 0], [0.2, 20], [0.4, 40], [0.6, 60], [0.8, 80], [1, 100],
    ];
    const result = estimateConfidence({
      manualConfidence: 100,
      dataPoints,
      targetCompletionRate: 1.5, // extrapolation beyond 1
    });
    expect(result.estimatedConfidence).toBeLessThanOrEqual(100);
    expect(result.estimatedConfidence).toBeGreaterThanOrEqual(0);
  });
});
