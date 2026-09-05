/**
 * Tests for calendar conflict detection in validatePlanOutput and
 * generateFallbackPlan.
 *
 * Key fixture facts (Amsterdam = UTC+2 in summer, UTC+1 in winter):
 *   "2026-08-26T16:00" Amsterdam → UTC 2026-08-26T14:00:00Z  (session start)
 *   session end (45 min)         → UTC 2026-08-26T14:45:00Z
 */

import { describe, expect, it } from "vitest";
import type { PlanInput, PlanOutput } from "@/server/llm/schema";
import { validatePlanOutput } from "@/server/llm/validate";
import { generateFallbackPlan } from "@/server/llm/fallback";

// ── Shared fixtures ──────────────────────────────────────────────────────────

const baseInput: PlanInput = {
  timeZone: "Europe/Amsterdam",
  now: new Date("2026-08-25T00:00:00Z"),
  sessionLengthMinutes: 45,
  subjects: [
    {
      id: "sub-1",
      name: "Biology",
      examDate: "2026-12-15",
      topics: [{ id: "top-1", name: "Cellular respiration" }],
    },
  ],
  // Monday (1) and Wednesday (3), 16:00–18:00 Amsterdam
  availability: [
    { dayOfWeek: 1, startsAt: "16:00", endsAt: "18:00" },
    { dayOfWeek: 3, startsAt: "16:00", endsAt: "18:00" },
  ],
};

// Wednesday 2026-08-26 16:00 Amsterdam = UTC 14:00; ends UTC 14:45.
const validSession: PlanOutput["sessions"][number] = {
  startsAt: "2026-08-26T16:00",
  durationMinutes: 45,
  subjectName: "Biology",
  topicName: "Cellular respiration",
  instruction: "Review chapter 4",
};

const validOutput: PlanOutput = {
  sessions: [validSession],
  warnings: [],
};

// Helper: make a PlanInput with specific calendarBusyPeriods.
function withBusy(
  periods: Array<{ startsAt: string; endsAt: string }>,
): PlanInput {
  return { ...baseInput, calendarBusyPeriods: periods };
}

// ── validatePlanOutput — calendar conflict detection ─────────────────────────

describe("validatePlanOutput — calendar busy periods", () => {
  it("(1) rejects a session completely inside a busy period", () => {
    // Session: UTC 14:00–14:45. Busy: UTC 13:30–15:00 → fully contains session.
    const input = withBusy([
      { startsAt: "2026-08-26T13:30:00Z", endsAt: "2026-08-26T15:00:00Z" },
    ]);
    const r = validatePlanOutput(input, validOutput, "2026-12-15");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/conflicts with a Google Calendar event/i);
  });

  it("(2) rejects a session that partially overlaps the start of a busy period", () => {
    // Session: UTC 14:00–14:45. Busy: UTC 14:30–15:30 → session runs into the start.
    const input = withBusy([
      { startsAt: "2026-08-26T14:30:00Z", endsAt: "2026-08-26T15:30:00Z" },
    ]);
    const r = validatePlanOutput(input, validOutput, "2026-12-15");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/conflicts with a Google Calendar event/i);
  });

  it("(3) rejects a session that partially overlaps the end of a busy period", () => {
    // Session: UTC 14:00–14:45. Busy: UTC 13:30–14:15 → session starts during busy.
    const input = withBusy([
      { startsAt: "2026-08-26T13:30:00Z", endsAt: "2026-08-26T14:15:00Z" },
    ]);
    const r = validatePlanOutput(input, validOutput, "2026-12-15");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/conflicts with a Google Calendar event/i);
  });

  it("(4) allows a session that ends exactly when a busy period starts", () => {
    // Session ends UTC 14:45. Busy starts UTC 14:45 → endsAtUTC > busyStart is false.
    const input = withBusy([
      { startsAt: "2026-08-26T14:45:00Z", endsAt: "2026-08-26T16:00:00Z" },
    ]);
    const r = validatePlanOutput(input, validOutput, "2026-12-15");
    expect(r.ok).toBe(true);
  });

  it("(5) allows a session that starts exactly when a busy period ends", () => {
    // Session starts UTC 14:00. Busy ends UTC 14:00 → startsAtUTC < busyEnd is false.
    const input = withBusy([
      { startsAt: "2026-08-26T13:00:00Z", endsAt: "2026-08-26T14:00:00Z" },
    ]);
    const r = validatePlanOutput(input, validOutput, "2026-12-15");
    expect(r.ok).toBe(true);
  });

  it("(6) rejects a session conflicting with one period out of multiple", () => {
    // Busy A: UTC 12:00–13:00 (no conflict). Busy B: UTC 14:20–15:00 (conflict).
    const input = withBusy([
      { startsAt: "2026-08-26T12:00:00Z", endsAt: "2026-08-26T13:00:00Z" },
      { startsAt: "2026-08-26T14:20:00Z", endsAt: "2026-08-26T15:00:00Z" },
    ]);
    const r = validatePlanOutput(input, validOutput, "2026-12-15");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/conflicts with a Google Calendar event/i);
  });

  it("(6b) allows a session when busy periods are all non-overlapping", () => {
    // Busy A: UTC 12:00–13:00. Busy B: UTC 15:00–16:00. Session: UTC 14:00–14:45.
    const input = withBusy([
      { startsAt: "2026-08-26T12:00:00Z", endsAt: "2026-08-26T13:00:00Z" },
      { startsAt: "2026-08-26T15:00:00Z", endsAt: "2026-08-26T16:00:00Z" },
    ]);
    const r = validatePlanOutput(input, validOutput, "2026-12-15");
    expect(r.ok).toBe(true);
  });

  it("(7) compares in UTC, not local time — detects conflict with a winter-timezone session", () => {
    // Winter: Amsterdam is UTC+1.
    // Session "2026-11-16T16:00" Amsterdam (UTC+1) → UTC 15:00–15:45.
    // Availability: Monday (DOW=1) 16:00–18:00 Amsterdam.
    // 2026-11-16 is Monday.
    const winterInput: PlanInput = {
      ...baseInput,
      timeZone: "Europe/Amsterdam",
      now: new Date("2026-11-15T00:00:00Z"), // Sunday
      calendarBusyPeriods: [
        // UTC 15:15–16:00 → overlaps UTC 15:00–15:45
        { startsAt: "2026-11-16T15:15:00Z", endsAt: "2026-11-16T16:00:00Z" },
      ],
    };
    const winterSession: PlanOutput["sessions"][number] = {
      startsAt: "2026-11-16T16:00", // Amsterdam UTC+1 → UTC 15:00
      durationMinutes: 45,
      subjectName: "Biology",
      topicName: "Cellular respiration",
      instruction: "Review chapter 4",
    };
    const r = validatePlanOutput(
      winterInput,
      { sessions: [winterSession], warnings: [] },
      "2026-12-15",
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/conflicts with a Google Calendar event/i);
  });

  it("(7b) does not detect conflict when the UTC offset shifts the session clear of the busy period", () => {
    // Summer (UTC+2): "2026-08-26T16:00" Amsterdam → UTC 14:00.
    // Busy period is UTC 15:15–16:00. No overlap with UTC 14:00–14:45.
    const input = withBusy([
      { startsAt: "2026-08-26T15:15:00Z", endsAt: "2026-08-26T16:00:00Z" },
    ]);
    const r = validatePlanOutput(input, validOutput, "2026-12-15");
    expect(r.ok).toBe(true);
  });

  it("(9) when no calendarBusyPeriods are present, existing behavior is unchanged", () => {
    // No calendarBusyPeriods key at all.
    const r = validatePlanOutput(baseInput, validOutput, "2026-12-15");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.sessions).toHaveLength(1);
  });

  it("(9b) when calendarBusyPeriods is an empty array, existing behavior is unchanged", () => {
    const input: PlanInput = { ...baseInput, calendarBusyPeriods: [] };
    const r = validatePlanOutput(input, validOutput, "2026-12-15");
    expect(r.ok).toBe(true);
  });
});

// ── generateFallbackPlan — calendar busy period avoidance ────────────────────

describe("generateFallbackPlan — calendar busy periods", () => {
  // Wednesday 2026-08-26, Amsterdam window 16:00–18:00 (UTC 14:00–16:00).
  // Session length 45 min. First slot would be UTC 14:00–14:45.
  const fallbackBase: PlanInput = {
    timeZone: "Europe/Amsterdam",
    now: new Date("2026-08-25T10:00:00Z"), // Tuesday morning
    sessionLengthMinutes: 45,
    subjects: [
      {
        id: "sub-1",
        name: "Physics",
        examDate: "2026-09-30",
        topics: [
          { id: "top-1", name: "Mechanics" },
          { id: "top-2", name: "Thermodynamics" },
        ],
      },
    ],
    availability: [{ dayOfWeek: 3, startsAt: "16:00", endsAt: "18:00" }], // Wed only
  };

  it("(8) fallback skips a slot blocked by a busy period and uses the next valid slot", () => {
    // Busy: UTC 14:00–14:30 (Amsterdam 16:00–16:30).
    // First slot (UTC 14:00–14:45) overlaps → must advance.
    // Next slot after busy ends at UTC 14:30 → slot starts UTC 14:30.
    // UTC 14:30 + 45 min = UTC 15:15 ≤ wEnd UTC 16:00 → fits.
    const input: PlanInput = {
      ...fallbackBase,
      calendarBusyPeriods: [
        { startsAt: "2026-08-26T14:00:00Z", endsAt: "2026-08-26T14:30:00Z" },
      ],
    };
    const sessions = generateFallbackPlan(input);

    expect(sessions.length).toBeGreaterThan(0);
    // No session should overlap the busy period.
    for (const s of sessions) {
      const busyStart = new Date("2026-08-26T14:00:00Z").getTime();
      const busyEnd = new Date("2026-08-26T14:30:00Z").getTime();
      const overlaps =
        s.startsAtUTC.getTime() < busyEnd && s.endsAtUTC.getTime() > busyStart;
      expect(overlaps).toBe(false);
    }
    // The first session on Wed should start at UTC 14:30 (Amsterdam 16:30).
    const wedSessions = sessions.filter(
      (s) =>
        s.startsAtUTC >= new Date("2026-08-26T00:00:00Z") &&
        s.startsAtUTC < new Date("2026-08-27T00:00:00Z"),
    );
    expect(wedSessions.length).toBeGreaterThan(0);
    expect(wedSessions[0].startsAtUTC.toISOString()).toBe(
      "2026-08-26T14:30:00.000Z",
    );
  });

  it("(8b) fallback skips an entire window when it is fully blocked", () => {
    // Busy period covers the full Wednesday window (UTC 14:00–16:00).
    const input: PlanInput = {
      ...fallbackBase,
      calendarBusyPeriods: [
        { startsAt: "2026-08-26T14:00:00Z", endsAt: "2026-08-26T16:00:00Z" },
      ],
    };
    const sessions = generateFallbackPlan(input);

    // No session on 2026-08-26.
    const blockedDay = sessions.filter(
      (s) =>
        s.startsAtUTC >= new Date("2026-08-26T00:00:00Z") &&
        s.startsAtUTC < new Date("2026-08-27T00:00:00Z"),
    );
    expect(blockedDay).toHaveLength(0);
  });

  it("(9) fallback produces sessions normally when calendarBusyPeriods is absent", () => {
    const sessions = generateFallbackPlan(fallbackBase);
    expect(sessions.length).toBeGreaterThan(0);
    // All sessions should start at or after the window start (UTC 14:00) on Wednesdays.
    for (const s of sessions) {
      expect(s.startsAtUTC.getTime()).toBeGreaterThanOrEqual(
        fallbackBase.now.getTime(),
      );
    }
  });
});
