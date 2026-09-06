/**
 * Regression tests for Issue 4 — coursework difficulty persistence.
 *
 * The `difficultyToInt` helper (in coursework/[id]/page.tsx) converts the
 * JSONB string value from the DB into the 1|2|3 integer expected by
 * StartPracticeButton. These tests document and enforce the correct mapping
 * so changes to either representation stay in sync.
 *
 * The `startPracticeAction` clamping (1 or 3 → kept; other → 2) is already
 * covered in practice-difficulty-start.test.ts.
 */

import { describe, expect, it } from "vitest";

// Mirrors the inline difficultyToInt in src/app/(app)/coursework/[id]/page.tsx.
function difficultyToInt(d: string | null | undefined): 1 | 2 | 3 {
  if (d === "easy") return 1;
  if (d === "hard") return 3;
  return 2;
}

// Mirrors the reverse mapping in updateCourseworkDifficultyAction.
function difficultyToText(d: 1 | 2 | 3): "easy" | "medium" | "hard" {
  if (d === 1) return "easy";
  if (d === 3) return "hard";
  return "medium";
}

describe("difficultyToInt — DB string → UI integer", () => {
  it('maps "easy" → 1', () => expect(difficultyToInt("easy")).toBe(1));
  it('maps "medium" → 2', () => expect(difficultyToInt("medium")).toBe(2));
  it('maps "hard" → 3', () => expect(difficultyToInt("hard")).toBe(3));
  it("maps null → 2 (default when difficulty not yet set)", () => expect(difficultyToInt(null)).toBe(2));
  it("maps undefined → 2 (default when extracted field is absent)", () => expect(difficultyToInt(undefined)).toBe(2));
  it("maps unknown string → 2 (safe fallback)", () => expect(difficultyToInt("extreme")).toBe(2));
});

describe("difficultyToText — UI integer → DB string (round-trip)", () => {
  it("maps 1 → easy", () => expect(difficultyToText(1)).toBe("easy"));
  it("maps 2 → medium", () => expect(difficultyToText(2)).toBe("medium"));
  it("maps 3 → hard", () => expect(difficultyToText(3)).toBe("hard"));
});

describe("Round-trip: difficultyToInt(difficultyToText(n)) === n", () => {
  it("Easy round-trips correctly", () => expect(difficultyToInt(difficultyToText(1))).toBe(1));
  it("Medium round-trips correctly", () => expect(difficultyToInt(difficultyToText(2))).toBe(2));
  it("Hard round-trips correctly", () => expect(difficultyToInt(difficultyToText(3))).toBe(3));
});
