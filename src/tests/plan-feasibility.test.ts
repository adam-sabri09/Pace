import { describe, expect, it } from "vitest";
import { checkPlanFeasibility } from "@/server/llm/validate";
import { PlanOutputSchema, type PlanInput } from "@/server/llm/schema";

const base = (over: Partial<PlanInput> = {}): PlanInput => ({
  timeZone: "Africa/Casablanca",
  now: new Date("2026-08-25T09:00:00Z"),
  sessionLengthMinutes: 45,
  subjects: [
    { id: "s1", name: "Biology", examDate: "2026-09-08", topics: [{ id: "t1", name: "Cells" }] },
  ],
  availability: [
    { dayOfWeek: 1, startsAt: "16:00", endsAt: "18:00" },
    { dayOfWeek: 3, startsAt: "16:00", endsAt: "18:00" },
  ],
  ...over,
});

describe("checkPlanFeasibility", () => {
  it("accepts a feasible input", () => {
    expect(checkPlanFeasibility(base()).ok).toBe(true);
  });

  it("accepts when the latest exam date is in the past (falls back to 28-day horizon)", () => {
    // Past exam → use 28-day default. Pace still plans for the subject.
    expect(
      checkPlanFeasibility(
        base({ subjects: [{ id: "s1", name: "Biology", examDate: "2026-08-20", topics: [] }] }),
      ).ok,
    ).toBe(true);
  });

  it("accepts when the exam date is today (falls back to 28-day horizon)", () => {
    // Exam today has passed as a planning target; 28-day default takes over.
    expect(
      checkPlanFeasibility(
        base({ subjects: [{ id: "s1", name: "Biology", examDate: "2026-08-25", topics: [] }] }),
      ).ok,
    ).toBe(true);
  });

  it("accepts when no subject has an exam date (uses 28-day default horizon)", () => {
    // Exams are optional — tasks or general study drive the plan.
    expect(
      checkPlanFeasibility(
        base({ subjects: [{ id: "s1", name: "Biology", examDate: null, topics: [] }] }),
      ).ok,
    ).toBe(true);
  });

  it("accepts an exam date one day in the future", () => {
    expect(
      checkPlanFeasibility(
        base({ subjects: [{ id: "s1", name: "Biology", examDate: "2026-08-26", topics: [] }] }),
      ).ok,
    ).toBe(true);
  });

  it("rejects when every window is shorter than the session length", () => {
    const r = checkPlanFeasibility(
      base({
        sessionLengthMinutes: 60,
        availability: [
          { dayOfWeek: 1, startsAt: "16:00", endsAt: "16:30" },
          { dayOfWeek: 3, startsAt: "17:00", endsAt: "17:45" },
        ],
      }),
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/shorter than your 60-minute/i);
  });

  it("accepts a window exactly equal to the session length", () => {
    expect(
      checkPlanFeasibility(
        base({
          sessionLengthMinutes: 45,
          availability: [{ dayOfWeek: 1, startsAt: "16:00", endsAt: "16:45" }],
        }),
      ).ok,
    ).toBe(true);
  });

  it("falls back to 28-day horizon even when exam date matches today in local timezone", () => {
    // now is 2026-08-25T09:00Z; in Africa/Casablanca that's 2026-08-25 local.
    // Exam today is not a future exam, so Pace uses the 28-day default — still feasible.
    expect(
      checkPlanFeasibility(
        base({ subjects: [{ id: "s1", name: "Biology", examDate: "2026-08-25", topics: [] }] }),
      ).ok,
    ).toBe(true);
  });
});

describe("checkPlanFeasibility check 3 — short scheduling window", () => {
  it("accepts when exam is tomorrow and today's only window closed (28-day horizon includes future slots)", () => {
    // Tuesday 18:30 UTC; Tue window closes at 18:00. Exam is Wednesday with no Wed slot.
    // Old logic rejected this because no slots existed before the exam date.
    // New logic: horizon = max(2026-08-26, 28 days) = 28 days. Next Tuesday is feasible.
    expect(
      checkPlanFeasibility(
        base({
          timeZone: "UTC",
          now: new Date("2026-08-25T18:30:00Z"),
          subjects: [{ id: "s1", name: "Biology", examDate: "2026-08-26", topics: [] }],
          availability: [{ dayOfWeek: 2, startsAt: "16:00", endsAt: "18:00" }],
        }),
      ).ok,
    ).toBe(true);
  });

  it("accepts when exam is tomorrow and tomorrow has its own availability", () => {
    // Tuesday 18:30 UTC — today's window passed. Exam is Wednesday.
    // Wednesday has a morning slot: still feasible.
    expect(
      checkPlanFeasibility(
        base({
          timeZone: "UTC",
          now: new Date("2026-08-25T18:30:00Z"),
          subjects: [{ id: "s1", name: "Biology", examDate: "2026-08-26", topics: [] }],
          availability: [
            { dayOfWeek: 2, startsAt: "16:00", endsAt: "18:00" }, // Tuesday (passed)
            { dayOfWeek: 3, startsAt: "09:00", endsAt: "11:00" }, // Wednesday (free)
          ],
        }),
      ).ok,
    ).toBe(true);
  });

  it("accepts when today still has remaining time before the window closes", () => {
    // Tuesday 14:30 UTC; window is 16:00–18:00 — session can start at 16:00 (future).
    // Exam is Wednesday. Feasible.
    expect(
      checkPlanFeasibility(
        base({
          timeZone: "UTC",
          now: new Date("2026-08-25T14:30:00Z"),
          subjects: [{ id: "s1", name: "Biology", examDate: "2026-08-26", topics: [] }],
          availability: [{ dayOfWeek: 2, startsAt: "16:00", endsAt: "18:00" }],
        }),
      ).ok,
    ).toBe(true);
  });

  it("accepts a Monday slot for UTC+12 users (regression: noon-UTC anchor bug)", () => {
    // Pacific/Auckland NZST = UTC+12. now = 2026-08-23T21:00Z = Mon 2026-08-24 09:00 local.
    // The old anchor (todayDateStr+"T12:00:00Z") placed noon-UTC on Aug 24, which in UTC+12
    // is midnight Aug 25 (Tuesday) — so d=0 was mapped to Tuesday, skipping Monday's slot
    // and incorrectly returning { ok: false }.
    expect(
      checkPlanFeasibility({
        timeZone: "Pacific/Auckland",
        now: new Date("2026-08-23T21:00:00Z"),
        sessionLengthMinutes: 45,
        subjects: [{ id: "s1", name: "Biology", examDate: "2026-08-25", topics: [] }],
        availability: [{ dayOfWeek: 1, startsAt: "10:00", endsAt: "12:00" }],
      }).ok,
    ).toBe(true);
  });
});

describe("PlanOutputSchema now permits an empty plan", () => {
  it("accepts sessions: [] (handled downstream, not a schema crash)", () => {
    const parsed = PlanOutputSchema.safeParse({ sessions: [], warnings: [] });
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.sessions).toHaveLength(0);
  });

  it("still accepts a normal plan", () => {
    const parsed = PlanOutputSchema.safeParse({
      sessions: [
        {
          startsAt: "2026-08-26T16:00",
          durationMinutes: 45,
          subjectName: "Biology",
          topicName: "Cells",
          instruction: "Review",
        },
      ],
      warnings: [],
    });
    expect(parsed.success).toBe(true);
  });
});
