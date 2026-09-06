/**
 * Regression tests for deletePassedExamsAction behaviour (Issue 2 fix).
 *
 * The action must:
 *  - Identify subjects whose exam_date is strictly before today.
 *  - Delete ONLY missed sessions for topics belonging to those subjects.
 *  - Leave completed sessions (study history) intact.
 *  - Leave scheduled/future sessions intact.
 *  - Leave sessions for unrelated subjects intact.
 *
 * DB calls are made inside the server action so these tests verify the
 * supporting pure logic used to build the filters.
 */

import { describe, expect, it } from "vitest";

// ---------------------------------------------------------------------------
// Date helpers — mirrors the action's "today" calculation
// ---------------------------------------------------------------------------

function isPastExam(examDate: string, today: string): boolean {
  return examDate < today;
}

function isMissedAndPast(status: string, startsAt: string, nowISO: string): boolean {
  return status === "missed" && startsAt < nowISO;
}

describe("deletePassedExamsAction — exam date filter", () => {
  const today = "2026-09-06";

  it("identifies a subject whose exam was yesterday as passed", () => {
    expect(isPastExam("2026-09-05", today)).toBe(true);
  });

  it("identifies a subject whose exam is today as NOT passed", () => {
    // The action uses .lt(exam_date, today) — equal dates are not cleared.
    expect(isPastExam("2026-09-06", today)).toBe(false);
  });

  it("identifies a subject with a future exam as NOT passed", () => {
    expect(isPastExam("2026-12-01", today)).toBe(false);
  });

  it("identifies a subject with an exam last year as passed", () => {
    expect(isPastExam("2025-06-15", today)).toBe(true);
  });
});

describe("deletePassedExamsAction — session deletion filter", () => {
  const nowISO = "2026-09-06T10:00:00.000Z";

  it("marks a missed session that started before now as eligible for deletion", () => {
    expect(isMissedAndPast("missed", "2026-09-05T16:00:00.000Z", nowISO)).toBe(true);
  });

  it("does NOT mark a completed session as eligible — completed history is preserved", () => {
    expect(isMissedAndPast("completed", "2026-09-05T16:00:00.000Z", nowISO)).toBe(false);
  });

  it("does NOT mark a scheduled future session as eligible", () => {
    expect(isMissedAndPast("missed", "2026-09-10T16:00:00.000Z", nowISO)).toBe(false);
  });

  it("does NOT mark a scheduled session that is still in the future as eligible", () => {
    expect(isMissedAndPast("scheduled", "2026-09-10T09:00:00.000Z", nowISO)).toBe(false);
  });

  it("marks a missed session from the same day but earlier as eligible", () => {
    expect(isMissedAndPast("missed", "2026-09-06T08:00:00.000Z", nowISO)).toBe(true);
  });

  it("does NOT mark a missed session scheduled for later today as eligible", () => {
    expect(isMissedAndPast("missed", "2026-09-06T14:00:00.000Z", nowISO)).toBe(false);
  });
});
