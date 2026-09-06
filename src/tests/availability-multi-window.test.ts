/**
 * Regression tests for Part 5 — multiple study availability blocks per day.
 *
 * The database schema (availability_windows) has no UNIQUE constraint on
 * (user_id, day_of_week), so multiple rows per day are valid.  These tests
 * verify that the three layers that consume availability data all handle
 * multiple windows per day correctly:
 *
 *   1. hasOverlappingWindows  — overlap detection must allow non-overlapping
 *      blocks on the same day and reject overlapping ones.
 *   2. buildPrompt            — the LLM prompt must list every block for a day
 *      so the model can schedule sessions inside any of them.
 *   3. checkPlanFeasibility   — feasibility must pass when at least one block
 *      is long enough, even when others are short.
 *   4. OnboardingSchema       — multiple non-overlapping windows on the same
 *      day must parse successfully end-to-end.
 */

import { describe, expect, it } from "vitest";
import { hasOverlappingWindows, OnboardingSchema } from "@/lib/validation/onboarding";
import { buildPrompt } from "@/server/llm/prompt";
import { checkPlanFeasibility } from "@/server/llm/validate";
import type { PlanInput } from "@/server/llm/schema";

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

const baseSubject = {
  id: "s1",
  name: "Maths",
  examDate: "2026-12-01",
  topics: [{ id: "t1", name: "Calculus" }],
};

const now = new Date("2026-09-06T10:00:00Z");

function makePlanInput(
  availability: PlanInput["availability"],
  sessionLength: 25 | 45 | 60 = 45,
): PlanInput {
  return {
    now,
    timeZone: "UTC",
    subjects: [baseSubject],
    availability,
    sessionLengthMinutes: sessionLength,
    tasks: [],
  };
}

// ---------------------------------------------------------------------------
// 1. hasOverlappingWindows — multi-block same-day scenarios
// ---------------------------------------------------------------------------

describe("hasOverlappingWindows — multiple blocks on the same day", () => {
  it("allows two non-overlapping blocks on the same day", () => {
    expect(
      hasOverlappingWindows([
        { dayOfWeek: 1, startsAt: "09:00", endsAt: "10:00" },
        { dayOfWeek: 1, startsAt: "17:00", endsAt: "18:00" },
      ]),
    ).toBe(false);
  });

  it("allows three non-overlapping blocks on the same day", () => {
    expect(
      hasOverlappingWindows([
        { dayOfWeek: 1, startsAt: "07:00", endsAt: "08:00" },
        { dayOfWeek: 1, startsAt: "12:00", endsAt: "13:00" },
        { dayOfWeek: 1, startsAt: "20:00", endsAt: "21:30" },
      ]),
    ).toBe(false);
  });

  it("allows same-time blocks on DIFFERENT days", () => {
    expect(
      hasOverlappingWindows([
        { dayOfWeek: 1, startsAt: "17:00", endsAt: "19:00" },
        { dayOfWeek: 2, startsAt: "17:00", endsAt: "19:00" },
        { dayOfWeek: 3, startsAt: "17:00", endsAt: "19:00" },
      ]),
    ).toBe(false);
  });

  it("allows adjacent blocks (end == next start is NOT an overlap)", () => {
    // 10:00–11:00 and 11:00–12:00 are adjacent, not overlapping.
    expect(
      hasOverlappingWindows([
        { dayOfWeek: 5, startsAt: "10:00", endsAt: "11:00" },
        { dayOfWeek: 5, startsAt: "11:00", endsAt: "12:00" },
      ]),
    ).toBe(false);
  });

  it("detects an overlap when a block starts before the previous one ends", () => {
    expect(
      hasOverlappingWindows([
        { dayOfWeek: 3, startsAt: "17:00", endsAt: "19:00" },
        { dayOfWeek: 3, startsAt: "18:00", endsAt: "20:00" },
      ]),
    ).toBe(true);
  });

  it("detects overlap even when blocks are entered out of time order", () => {
    // 18:00–20:00 then 17:00–19:00 — overlap at 18:00–19:00.
    expect(
      hasOverlappingWindows([
        { dayOfWeek: 4, startsAt: "18:00", endsAt: "20:00" },
        { dayOfWeek: 4, startsAt: "17:00", endsAt: "19:00" },
      ]),
    ).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 2. buildPrompt — multiple blocks must appear in the LLM prompt
// ---------------------------------------------------------------------------

describe("buildPrompt — multiple availability blocks per day", () => {
  it("lists both blocks for a day with two windows", () => {
    const input = makePlanInput([
      { dayOfWeek: 1, startsAt: "09:00", endsAt: "10:00" }, // Monday morning
      { dayOfWeek: 1, startsAt: "17:00", endsAt: "18:00" }, // Monday evening
    ]);
    const prompt = buildPrompt(input);
    // The prompt must show both windows for Monday, not just one.
    expect(prompt).toContain("09:00–10:00");
    expect(prompt).toContain("17:00–18:00");
    // Both should appear on the Monday line.
    const mondayLine = prompt.split("\n").find((l) => l.includes("Monday"));
    expect(mondayLine).toBeDefined();
    expect(mondayLine).toContain("09:00–10:00");
    expect(mondayLine).toContain("17:00–18:00");
  });

  it("separates blocks for different days correctly", () => {
    const input = makePlanInput([
      { dayOfWeek: 1, startsAt: "17:00", endsAt: "18:00" }, // Monday
      { dayOfWeek: 2, startsAt: "16:00", endsAt: "18:00" }, // Tuesday
    ]);
    const prompt = buildPrompt(input);
    const lines = prompt.split("\n");
    const mondayLine = lines.find((l) => l.includes("Monday"));
    const tuesdayLine = lines.find((l) => l.includes("Tuesday"));
    expect(mondayLine).toContain("17:00–18:00");
    expect(mondayLine).not.toContain("16:00–18:00");
    expect(tuesdayLine).toContain("16:00–18:00");
    expect(tuesdayLine).not.toContain("17:00–18:00");
  });

  it("marks a day as unavailable when it has no windows", () => {
    const input = makePlanInput([
      { dayOfWeek: 1, startsAt: "09:00", endsAt: "10:00" }, // Monday only
    ]);
    const prompt = buildPrompt(input);
    const tuesdayLine = prompt.split("\n").find((l) => l.includes("Tuesday"));
    expect(tuesdayLine).toContain("(unavailable)");
  });
});

// ---------------------------------------------------------------------------
// 3. checkPlanFeasibility — must pass with at least one long-enough block
// ---------------------------------------------------------------------------

describe("checkPlanFeasibility — multiple blocks per day", () => {
  it("passes when at least one block fits the session length", () => {
    // Monday: 09:00–09:30 (30 min — too short for 45-min sessions) +
    //         17:00–18:00 (60 min — fits).
    const result = checkPlanFeasibility(
      makePlanInput(
        [
          { dayOfWeek: 1, startsAt: "09:00", endsAt: "09:30" },
          { dayOfWeek: 1, startsAt: "17:00", endsAt: "18:00" },
        ],
        45,
      ),
    );
    expect(result.ok).toBe(true);
  });

  it("fails when no single block fits the session length", () => {
    // All blocks are 30 min but session length is 45 min.
    const result = checkPlanFeasibility(
      makePlanInput(
        [
          { dayOfWeek: 1, startsAt: "09:00", endsAt: "09:30" },
          { dayOfWeek: 3, startsAt: "17:00", endsAt: "17:30" },
        ],
        45,
      ),
    );
    expect(result.ok).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 4. OnboardingSchema — multiple non-overlapping windows on same day
// ---------------------------------------------------------------------------

describe("OnboardingSchema — multiple windows per day end-to-end", () => {
  const baseOnboarding = {
    subjects: [
      {
        name: "Biology",
        examDate: "2026-12-01",
        topics: [{ name: "Photosynthesis" }],
      },
    ],
    sessionLengthMinutes: 45 as const,
  };

  it("accepts two non-overlapping blocks on the same day", () => {
    const result = OnboardingSchema.safeParse({
      ...baseOnboarding,
      availability: [
        { dayOfWeek: 1, startsAt: "09:00", endsAt: "10:00" },
        { dayOfWeek: 1, startsAt: "17:00", endsAt: "18:00" },
      ],
    });
    expect(result.success).toBe(true);
  });

  it("accepts multiple non-overlapping blocks across multiple days", () => {
    const result = OnboardingSchema.safeParse({
      ...baseOnboarding,
      availability: [
        { dayOfWeek: 1, startsAt: "17:00", endsAt: "18:00" }, // Mon evening
        { dayOfWeek: 1, startsAt: "20:00", endsAt: "21:00" }, // Mon night
        { dayOfWeek: 2, startsAt: "16:00", endsAt: "18:00" }, // Tue afternoon
        { dayOfWeek: 6, startsAt: "10:00", endsAt: "12:00" }, // Sat morning
        { dayOfWeek: 6, startsAt: "14:00", endsAt: "16:00" }, // Sat afternoon
      ],
    });
    expect(result.success).toBe(true);
  });

  it("still rejects overlapping windows on the same day", () => {
    const result = OnboardingSchema.safeParse({
      ...baseOnboarding,
      availability: [
        { dayOfWeek: 1, startsAt: "09:00", endsAt: "11:00" },
        { dayOfWeek: 1, startsAt: "10:00", endsAt: "12:00" },
      ],
    });
    expect(result.success).toBe(false);
  });
});
