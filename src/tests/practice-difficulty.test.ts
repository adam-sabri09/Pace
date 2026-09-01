import { describe, expect, it } from "vitest";
import {
  adjustDifficulty,
  pickQuestionType,
  FAST_THRESHOLD_MS,
  type Difficulty,
} from "@/lib/practice/difficulty";

describe("adjustDifficulty", () => {
  it("increases difficulty when correct and fast", () => {
    const result = adjustDifficulty(2, true, FAST_THRESHOLD_MS - 1);
    expect(result.next).toBe(3);
    expect(result.reason).toBe("correct_fast");
  });

  it("stays same when correct but slow", () => {
    const result = adjustDifficulty(2, true, FAST_THRESHOLD_MS + 1);
    expect(result.next).toBe(2);
    expect(result.reason).toBe("correct_slow");
  });

  it("decreases difficulty when incorrect", () => {
    const result = adjustDifficulty(2, false, 1000);
    expect(result.next).toBe(1);
    expect(result.reason).toBe("incorrect");
  });

  it("does not exceed max difficulty of 3", () => {
    const result = adjustDifficulty(3, true, FAST_THRESHOLD_MS - 1);
    expect(result.next).toBe(3);
    expect(result.reason).toBe("correct_fast");
  });

  it("does not go below min difficulty of 1", () => {
    const result = adjustDifficulty(1, false, 1000);
    expect(result.next).toBe(1);
    expect(result.reason).toBe("incorrect");
  });

  it("boundary: exactly at FAST_THRESHOLD_MS is not fast", () => {
    const result = adjustDifficulty(1, true, FAST_THRESHOLD_MS);
    expect(result.next).toBe(1);
    expect(result.reason).toBe("correct_slow");
  });
});

describe("pickQuestionType", () => {
  it("returns a question type for each difficulty level", () => {
    const types = ["recall", "understanding", "application", "comparison", "problem_solving", "find_mistake", "changed_detail"];
    for (const d of [1, 2, 3] as Difficulty[]) {
      for (let i = 0; i < 10; i++) {
        const type = pickQuestionType(d, i);
        expect(types).toContain(type);
      }
    }
  });

  it("varies the question type as attempt count increases", () => {
    const types = new Set<string>();
    for (let i = 0; i < 20; i++) {
      types.add(pickQuestionType(2, i));
    }
    // Should use more than one type in 20 attempts at medium difficulty
    expect(types.size).toBeGreaterThan(1);
  });

  it("easy difficulty uses simpler types", () => {
    const seenTypes = new Set<string>();
    for (let i = 0; i < 10; i++) {
      seenTypes.add(pickQuestionType(1, i));
    }
    // Easy should not include problem_solving
    expect(seenTypes.has("problem_solving")).toBe(false);
  });

  it("hard difficulty includes advanced types", () => {
    const seenTypes = new Set<string>();
    for (let i = 0; i < 10; i++) {
      seenTypes.add(pickQuestionType(3, i));
    }
    // Hard difficulty includes application or problem_solving
    const hasAdvanced = seenTypes.has("application") || seenTypes.has("problem_solving");
    expect(hasAdvanced).toBe(true);
  });
});
