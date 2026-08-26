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

  it("rejects when the latest exam date is in the past", () => {
    const r = checkPlanFeasibility(
      base({ subjects: [{ id: "s1", name: "Biology", examDate: "2026-08-20", topics: [] }] }),
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/future/i);
  });

  it("rejects when the exam date is today (too tight)", () => {
    const r = checkPlanFeasibility(
      base({ subjects: [{ id: "s1", name: "Biology", examDate: "2026-08-25", topics: [] }] }),
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/future/i);
  });

  it("rejects when no subject has an exam date", () => {
    const r = checkPlanFeasibility(
      base({ subjects: [{ id: "s1", name: "Biology", examDate: null, topics: [] }] }),
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/future/i);
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

  it("uses the user's timezone for 'today' (exam date compared to local date)", () => {
    // now is 2026-08-25T09:00Z; in Africa/Casablanca that's 2026-08-25 local.
    const r = checkPlanFeasibility(
      base({ subjects: [{ id: "s1", name: "Biology", examDate: "2026-08-25", topics: [] }] }),
    );
    expect(r.ok).toBe(false);
  });
});

describe("checkPlanFeasibility check 3 — short scheduling window", () => {
  it("rejects when exam is tomorrow and today's only window has already closed", () => {
    // Tuesday 18:30 UTC; Tue window closes at 18:00 — too late for a 45-min session.
    // Exam is Wednesday; no Wednesday availability. Zero schedulable slots.
    const r = checkPlanFeasibility(
      base({
        timeZone: "UTC",
        now: new Date("2026-08-25T18:30:00Z"),
        subjects: [{ id: "s1", name: "Biology", examDate: "2026-08-26", topics: [] }],
        availability: [{ dayOfWeek: 2, startsAt: "16:00", endsAt: "18:00" }],
      }),
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/no study slots/i);
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
