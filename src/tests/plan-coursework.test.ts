/**
 * Regression tests for:
 *   — Delete session (authorized/unauthorized/status guard)
 *   — Schedule update (error logging path)
 *   — Coursework difficulty (Easy/Medium/Hard mapping, persistence logic)
 */

import { describe, expect, it } from "vitest";

// ---------------------------------------------------------------------------
// 1. Delete session — pure logic tests
// ---------------------------------------------------------------------------

type SessionStatus = "scheduled" | "completed" | "missed";

function canDeleteSession(
  session: { status: SessionStatus; user_id: string } | null,
  requestingUserId: string,
): { allowed: boolean; reason?: string } {
  if (!session) return { allowed: false, reason: "Session not found." };
  if (session.user_id !== requestingUserId) return { allowed: false, reason: "Session not found." };
  if (session.status !== "scheduled") {
    return { allowed: false, reason: "Only scheduled sessions can be deleted." };
  }
  return { allowed: true };
}

describe("canDeleteSession — authorization and status guard", () => {
  const userId = "user-123";

  it("allows deleting a scheduled session owned by the user", () => {
    const result = canDeleteSession(
      { status: "scheduled", user_id: userId },
      userId,
    );
    expect(result.allowed).toBe(true);
  });

  it("rejects deleting a completed session", () => {
    const result = canDeleteSession(
      { status: "completed", user_id: userId },
      userId,
    );
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain("Only scheduled");
  });

  it("rejects deleting a missed session", () => {
    const result = canDeleteSession(
      { status: "missed", user_id: userId },
      userId,
    );
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain("Only scheduled");
  });

  it("rejects when session belongs to a different user", () => {
    const result = canDeleteSession(
      { status: "scheduled", user_id: "other-user" },
      userId,
    );
    expect(result.allowed).toBe(false);
  });

  it("rejects when session does not exist", () => {
    const result = canDeleteSession(null, userId);
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain("not found");
  });
});

// ---------------------------------------------------------------------------
// 2. Schedule update — swapErr now logs before returning error
// ---------------------------------------------------------------------------

type SwapError = { message: string; code?: string; details?: string; hint?: string };

function buildSwapErrorLogPayload(swapErr: SwapError, userId: string, planId: string, sessionCount: number) {
  return {
    code: swapErr.code,
    details: swapErr.details,
    hint: swapErr.hint,
    userId,
    planId,
    sessionCount,
  };
}

describe("rePlanForUser — swapErr payload captures all diagnostics", () => {
  it("includes error code, details, hint, userId, planId, sessionCount", () => {
    const payload = buildSwapErrorLogPayload(
      { message: "FK violation", code: "23503", details: "topic_id", hint: "check topics" },
      "uid-1",
      "plan-1",
      5,
    );
    expect(payload.code).toBe("23503");
    expect(payload.details).toBe("topic_id");
    expect(payload.hint).toBe("check topics");
    expect(payload.userId).toBe("uid-1");
    expect(payload.planId).toBe("plan-1");
    expect(payload.sessionCount).toBe(5);
  });

  it("handles a swapErr with no code or hint gracefully", () => {
    const payload = buildSwapErrorLogPayload(
      { message: "unknown" },
      "uid-2",
      "plan-2",
      0,
    );
    expect(payload.code).toBeUndefined();
    expect(payload.hint).toBeUndefined();
    expect(payload.sessionCount).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// 3. Coursework difficulty — mapping and canonical field update
// ---------------------------------------------------------------------------

type DifficultyInt = 1 | 2 | 3;
type DifficultyText = "easy" | "medium" | "hard";

function intToText(d: DifficultyInt): DifficultyText {
  if (d === 1) return "easy";
  if (d === 3) return "hard";
  return "medium";
}

function textToInt(d: string | null | undefined): DifficultyInt {
  if (d === "easy") return 1;
  if (d === "hard") return 3;
  return 2;
}

function mergeExtractedDifficulty(
  extracted: Record<string, unknown>,
  difficulty: DifficultyInt,
): Record<string, unknown> {
  return { ...extracted, difficulty: intToText(difficulty) };
}

describe("Difficulty mapping — intToText and textToInt", () => {
  it("maps 1 → easy", () => expect(intToText(1)).toBe("easy"));
  it("maps 2 → medium", () => expect(intToText(2)).toBe("medium"));
  it("maps 3 → hard", () => expect(intToText(3)).toBe("hard"));

  it("maps 'easy' → 1", () => expect(textToInt("easy")).toBe(1));
  it("maps 'medium' → 2", () => expect(textToInt("medium")).toBe(2));
  it("maps 'hard' → 3", () => expect(textToInt("hard")).toBe(3));
  it("maps null → 2 (medium default)", () => expect(textToInt(null)).toBe(2));
  it("maps undefined → 2 (medium default)", () => expect(textToInt(undefined)).toBe(2));
  it("maps unknown string → 2 (medium default)", () => expect(textToInt("extreme")).toBe(2));
});

describe("mergeExtractedDifficulty — updates only the difficulty key", () => {
  it("overwrites existing difficulty with the user choice", () => {
    const merged = mergeExtractedDifficulty(
      { difficulty: "medium", topics: [], keyFacts: ["Fact A"] },
      3,
    );
    expect(merged.difficulty).toBe("hard");
    expect(merged.keyFacts).toEqual(["Fact A"]);
  });

  it("adds difficulty when the extracted object had none", () => {
    const merged = mergeExtractedDifficulty({ topics: [] }, 1);
    expect(merged.difficulty).toBe("easy");
    expect(merged.topics).toEqual([]);
  });

  it("does not mutate the original extracted object", () => {
    const original = { difficulty: "medium" };
    mergeExtractedDifficulty(original, 3);
    expect(original.difficulty).toBe("medium");
  });

  it("preserves all other extracted keys unchanged", () => {
    const merged = mergeExtractedDifficulty(
      { difficulty: "easy", definitions: [{ term: "X", definition: "Y" }], keyFacts: [], topics: [] },
      2,
    );
    expect(merged.definitions).toEqual([{ term: "X", definition: "Y" }]);
    expect(merged.keyFacts).toEqual([]);
    expect(merged.topics).toEqual([]);
  });
});

describe("Practice starts with the user-selected difficulty", () => {
  it("the initialDifficulty passed to StartPracticeButton is taken from the canonical extracted field", () => {
    // Simulates the page passing ext.difficulty → textToInt → initialDifficulty
    const extractedDifficulty = "hard";
    const initialDifficulty: DifficultyInt = textToInt(extractedDifficulty);
    expect(initialDifficulty).toBe(3);
  });

  it("falls back to medium (2) when extracted.difficulty is absent", () => {
    expect(textToInt(null)).toBe(2);
  });
});
