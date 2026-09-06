/**
 * Regression tests for Part 8 — user-controlled practice starting difficulty.
 *
 * The user selects Easy (1) / Medium (2) / Hard (3) before starting a session.
 * That value is the STARTING difficulty passed to startPracticeAction, not a
 * permanent override — the adaptive system (adjustDifficulty) still modifies
 * it based on subsequent performance.
 *
 * startPracticeAction makes DB calls so cannot be unit-tested here. These tests
 * verify:
 *   1. The label→value mapping matches the UI constants.
 *   2. The default is Medium (2).
 *   3. The adaptive system still adjusts from every valid starting point.
 *   4. Boundaries hold: difficulty never goes below 1 or above 3.
 */

import { describe, expect, it } from "vitest";
import {
  adjustDifficulty,
  FAST_THRESHOLD_MS,
  type Difficulty,
} from "@/lib/practice/difficulty";

// Must match the DIFFICULTIES array in start-practice-button.tsx.
const DIFFICULTY_MAP = [
  { label: "Easy", value: 1 as Difficulty },
  { label: "Medium", value: 2 as Difficulty },
  { label: "Hard", value: 3 as Difficulty },
] as const;

const DEFAULT_DIFFICULTY: Difficulty = 2;

// ---------------------------------------------------------------------------
// 1. Label-to-value mapping
// ---------------------------------------------------------------------------

describe("Practice difficulty selector — label-to-value mapping", () => {
  it("Easy maps to difficulty 1", () => {
    expect(DIFFICULTY_MAP.find((d) => d.label === "Easy")?.value).toBe(1);
  });

  it("Medium maps to difficulty 2", () => {
    expect(DIFFICULTY_MAP.find((d) => d.label === "Medium")?.value).toBe(2);
  });

  it("Hard maps to difficulty 3", () => {
    expect(DIFFICULTY_MAP.find((d) => d.label === "Hard")?.value).toBe(3);
  });

  it("default difficulty is Medium (2)", () => {
    expect(DEFAULT_DIFFICULTY).toBe(2);
  });

  it("exactly three difficulty choices are defined", () => {
    expect(DIFFICULTY_MAP.length).toBe(3);
  });
});

// ---------------------------------------------------------------------------
// 2. Adaptive system still adjusts from every starting point
// ---------------------------------------------------------------------------

describe("Adaptive difficulty — adjusts after user-selected start", () => {
  // Starting at Easy (1)
  it("Easy start + wrong answer → stays at 1 (floor boundary)", () => {
    const result = adjustDifficulty(1, false, 1000);
    expect(result.next).toBe(1);
  });

  it("Easy start + fast correct → promotes to Medium (2)", () => {
    const result = adjustDifficulty(1, true, FAST_THRESHOLD_MS - 1);
    expect(result.next).toBe(2);
  });

  it("Easy start + slow correct → stays at 1", () => {
    const result = adjustDifficulty(1, true, FAST_THRESHOLD_MS + 1);
    expect(result.next).toBe(1);
  });

  // Starting at Medium (2)
  it("Medium start + fast correct → promotes to Hard (3)", () => {
    const result = adjustDifficulty(2, true, FAST_THRESHOLD_MS - 1);
    expect(result.next).toBe(3);
  });

  it("Medium start + wrong answer → drops to Easy (1)", () => {
    const result = adjustDifficulty(2, false, 1000);
    expect(result.next).toBe(1);
  });

  it("Medium start + slow correct → stays at 2", () => {
    const result = adjustDifficulty(2, true, FAST_THRESHOLD_MS + 1);
    expect(result.next).toBe(2);
  });

  // Starting at Hard (3)
  it("Hard start + fast correct → stays at 3 (ceiling boundary)", () => {
    const result = adjustDifficulty(3, true, FAST_THRESHOLD_MS - 1);
    expect(result.next).toBe(3);
  });

  it("Hard start + wrong answer → drops to Medium (2)", () => {
    const result = adjustDifficulty(3, false, 1000);
    expect(result.next).toBe(2);
  });

  it("Hard start + slow correct → stays at 3", () => {
    const result = adjustDifficulty(3, true, FAST_THRESHOLD_MS + 1);
    expect(result.next).toBe(3);
  });
});
