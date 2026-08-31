import { describe, it, expect } from "vitest";
import { knnRecommend } from "@/lib/ml/knn";
import type { TrainingExample, StudentFeatures } from "@/lib/ml/features";
import type { TechniqueKey } from "@/lib/personalization/types";

function makeFeatures(partial: Partial<StudentFeatures> = {}): StudentFeatures {
  return {
    ageBand: 0.5,
    memoryScore: 0.5,
    usesFlashcards: 0,
    usesPracticeQuestions: 0,
    usesNotes: 0,
    usesVideos: 0,
    completionRate: 0.5,
    avgConfidence: 0.5,
    ...partial,
  };
}

function makeExamples(
  technique: TechniqueKey,
  n: number,
  features: Partial<StudentFeatures> = {},
): TrainingExample[] {
  return Array.from({ length: n }, () => ({ features: makeFeatures(features), technique }));
}

describe("knnRecommend", () => {
  it("returns null for empty examples", () => {
    expect(knnRecommend(makeFeatures(), [])).toBeNull();
  });

  it("picks the dominant technique from identical neighbours", () => {
    const examples: TrainingExample[] = [
      ...makeExamples("active_recall", 5),
      ...makeExamples("spaced_repetition", 2),
    ];
    const result = knnRecommend(makeFeatures(), examples, 5);
    expect(result).not.toBeNull();
    expect(result!.technique).toBe("active_recall");
  });

  it("picks the nearest neighbour when k=1", () => {
    const target = makeFeatures({ ageBand: 0, memoryScore: 0 });
    const examples: TrainingExample[] = [
      { features: makeFeatures({ ageBand: 0, memoryScore: 0 }), technique: "feynman" },
      { features: makeFeatures({ ageBand: 1, memoryScore: 1 }), technique: "deep_work" },
    ];
    const result = knnRecommend(target, examples, 1);
    expect(result!.technique).toBe("feynman");
  });

  it("caps k to the number of available examples", () => {
    const examples = makeExamples("practice_testing", 3);
    const result = knnRecommend(makeFeatures(), examples, 10);
    expect(result).not.toBeNull();
    expect(result!.k).toBe(3);
  });

  it("returns confidence between 0 and 1", () => {
    const examples = makeExamples("pomodoro", 5);
    const result = knnRecommend(makeFeatures(), examples, 5);
    expect(result!.confidence).toBeGreaterThanOrEqual(0);
    expect(result!.confidence).toBeLessThanOrEqual(1);
  });

  it("gives confidence of 1 when all neighbours agree", () => {
    const examples = makeExamples("interleaving", 5);
    const result = knnRecommend(makeFeatures(), examples, 5);
    expect(result!.confidence).toBeCloseTo(1, 2);
  });

  it("weights closer neighbours more heavily", () => {
    const target = makeFeatures({ ageBand: 0 });
    const examples: TrainingExample[] = [
      // 4 close neighbours (ageBand=0) → active_recall
      ...Array.from({ length: 4 }, () => ({
        features: makeFeatures({ ageBand: 0 }),
        technique: "active_recall" as TechniqueKey,
      })),
      // 1 far neighbour (ageBand=1) → deep_work
      { features: makeFeatures({ ageBand: 1 }), technique: "deep_work" as TechniqueKey },
    ];
    const result = knnRecommend(target, examples, 5);
    expect(result!.technique).toBe("active_recall");
  });
});
