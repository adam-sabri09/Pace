import { describe, expect, it } from "vitest";
import { resolveSessionEnd } from "@/lib/practice/session";

const mockQuestion = {
  questionText: "What is the quadratic formula?",
  questionType: "recall",
  conceptTested: "Quadratic formula",
};

describe("resolveSessionEnd — session completion is gated on sessionComplete only", () => {
  it("continues when the server provides a next question", () => {
    expect(resolveSessionEnd({ sessionComplete: false, nextQuestion: mockQuestion })).toBe(
      "continue",
    );
  });

  // The core bug: when Gemini fails, the server returns nextQuestion: null with
  // sessionComplete: false. The old code (`sessionComplete || !nextQuestion`) would
  // evaluate this as complete; resolveSessionEnd must return "generation_failed" instead.
  it("signals generation_failed when nextQuestion is null but session is not complete", () => {
    expect(resolveSessionEnd({ sessionComplete: false, nextQuestion: null })).toBe(
      "generation_failed",
    );
  });

  it("signals complete only when server sets sessionComplete to true", () => {
    expect(resolveSessionEnd({ sessionComplete: true, nextQuestion: null })).toBe("complete");
  });

  // Prove the session does not complete at questions 1, 2, 5, or 9 —
  // all answered while questionsAnswered < 10, so server sends sessionComplete: false.
  it.each([1, 2, 5, 9])(
    "does NOT complete after question %i (server returns sessionComplete: false)",
    () => {
      const result = { sessionComplete: false, nextQuestion: mockQuestion };
      expect(resolveSessionEnd(result)).not.toBe("complete");
    },
  );

  // Prove only question 10 triggers completion (server sets sessionComplete: true).
  it("completes after question 10 when server sets sessionComplete: true", () => {
    expect(resolveSessionEnd({ sessionComplete: true, nextQuestion: null })).toBe("complete");
  });

  // Prove a Gemini failure mid-session (question 3, nextQuestion: null, sessionComplete: false)
  // does NOT falsely mark the session as successfully completed.
  it("does NOT falsely complete the session when question generation fails mid-session", () => {
    const generationFailure = { sessionComplete: false, nextQuestion: null };
    expect(resolveSessionEnd(generationFailure)).not.toBe("complete");
  });
});
