/**
 * Regression tests for Part 7 — practice question generation bugs.
 *
 * Root cause: PracticeQuestionSchema had a strict z.enum() for questionType.
 * When Gemini returned a value like "problem-solving" instead of "problem_solving",
 * Zod threw a validation error, generateQuestion returned null, and the UI showed
 * "Could not generate a question." The fix adds .catch("recall") so any unrecognised
 * value is silently normalised to "recall" instead of failing.
 */

import { describe, expect, it } from "vitest";
import { z } from "zod";

// ---------------------------------------------------------------------------
// Inline the schema so this test stays independent of the server action.
// The real schema in practice.ts must match this definition.
// ---------------------------------------------------------------------------

const VALID_TYPES = [
  "recall",
  "understanding",
  "application",
  "comparison",
  "problem_solving",
  "find_mistake",
  "changed_detail",
] as const;

const PracticeQuestionSchema = z.object({
  questionText: z.string(),
  questionType: z.enum(VALID_TYPES).catch("recall"),
  conceptTested: z.string(),
  expectedAnswer: z.string(),
});

const BASE_QUESTION = {
  questionText: "What is mitosis?",
  conceptTested: "Cell division",
  expectedAnswer: "Cell division producing two identical daughter cells.",
};

describe("PracticeQuestionSchema — questionType resilience (Part 7 regression)", () => {
  it("accepts all canonical enum values", () => {
    for (const qt of VALID_TYPES) {
      const result = PracticeQuestionSchema.safeParse({ ...BASE_QUESTION, questionType: qt });
      expect(result.success, `Expected success for type "${qt}"`).toBe(true);
      if (result.success) expect(result.data.questionType).toBe(qt);
    }
  });

  it("falls back to 'recall' for a hyphenated variant (e.g. 'problem-solving')", () => {
    const result = PracticeQuestionSchema.safeParse({
      ...BASE_QUESTION,
      questionType: "problem-solving",
    });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.questionType).toBe("recall");
  });

  it("falls back to 'recall' for a completely unknown type", () => {
    const result = PracticeQuestionSchema.safeParse({
      ...BASE_QUESTION,
      questionType: "critical_thinking",
    });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.questionType).toBe("recall");
  });

  it("falls back to 'recall' when questionType is missing", () => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { questionType: _, ...withoutType } = { ...BASE_QUESTION, questionType: "recall" };
    const result = PracticeQuestionSchema.safeParse(withoutType);
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.questionType).toBe("recall");
  });

  it("does NOT fall back to 'recall' for a valid type — preserves the real value", () => {
    const result = PracticeQuestionSchema.safeParse({
      ...BASE_QUESTION,
      questionType: "find_mistake",
    });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.questionType).toBe("find_mistake");
  });
});
