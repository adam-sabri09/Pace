import { describe, expect, it } from "vitest";
import type { PlanInput, PlanOutput } from "@/server/llm/schema";
import {
  latestExamDateOf,
  sanitizeWarnings,
  validatePlanOutput,
} from "@/server/llm/validate";

const baseInput: PlanInput = {
  timeZone: "Europe/Amsterdam",
  now: new Date("2026-08-25T00:00:00Z"), // early Tuesday in Amsterdam
  sessionLengthMinutes: 45,
  subjects: [
    {
      id: "sub-1",
      name: "Biology",
      examDate: "2026-12-15",
      topics: [
        { id: "top-1", name: "Cellular respiration" },
        { id: "top-2", name: "Photosynthesis" },
      ],
    },
    {
      id: "sub-2",
      name: "Math",
      examDate: null,
      topics: [{ id: "top-3", name: "Quadratic equations" }],
    },
  ],
  availability: [
    { dayOfWeek: 1, startsAt: "16:00", endsAt: "18:00" },
    { dayOfWeek: 3, startsAt: "16:00", endsAt: "18:00" },
  ],
};

const validSession: PlanOutput["sessions"][number] = {
  // 2026-08-25 is Tuesday; availability is Mon (1) and Wed (3). Use Wed.
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

describe("validatePlanOutput", () => {
  it("accepts a valid plan", () => {
    const result = validatePlanOutput(baseInput, validOutput, "2026-12-15");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.sessions).toHaveLength(1);
      expect(result.sessions[0].topicId).toBe("top-1");
      expect(result.sessions[0].startsAtUTC.toISOString()).toBe(
        "2026-08-26T14:00:00.000Z",
      );
    }
  });

  it("rejects unknown subject", () => {
    const out = {
      ...validOutput,
      sessions: [{ ...validSession, subjectName: "Chemistry" }],
    };
    const r = validatePlanOutput(baseInput, out, "2026-12-15");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/Unknown subject/);
  });

  it("rejects topic not under its subject", () => {
    const out = {
      ...validOutput,
      sessions: [{ ...validSession, topicName: "Quadratic equations" }],
    };
    const r = validatePlanOutput(baseInput, out, "2026-12-15");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/not under subject/);
  });

  it("rejects wrong duration", () => {
    const out = {
      ...validOutput,
      sessions: [{ ...validSession, durationMinutes: 30 }],
    };
    const r = validatePlanOutput(baseInput, out, "2026-12-15");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/duration.*does not match/i);
  });

  it("rejects session in the past", () => {
    const out = {
      ...validOutput,
      sessions: [{ ...validSession, startsAt: "2026-08-24T16:00" }],
    };
    const r = validatePlanOutput(baseInput, out, "2026-12-15");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/in the past/i);
  });

  it("rejects session after the latest exam date", () => {
    const out = {
      ...validOutput,
      sessions: [{ ...validSession, startsAt: "2026-12-17T16:00" }],
    };
    const r = validatePlanOutput(baseInput, out, "2026-12-15");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/after the last exam/i);
  });

  it("rejects session outside an availability window", () => {
    // Tuesday isn't in the availability. Try Tue 16:00.
    const out = {
      ...validOutput,
      sessions: [{ ...validSession, startsAt: "2026-08-25T16:00" }],
    };
    const r = validatePlanOutput(baseInput, out, "2026-12-15");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/availability window/i);
  });

  it("rejects session spilling past the window's end", () => {
    // Wed window is 16:00–18:00. Starting at 17:30 → ends 18:15 → over.
    const out = {
      ...validOutput,
      sessions: [{ ...validSession, startsAt: "2026-08-26T17:30" }],
    };
    const r = validatePlanOutput(baseInput, out, "2026-12-15");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/availability window/i);
  });

  it("rejects overlapping sessions", () => {
    const out = {
      ...validOutput,
      sessions: [
        validSession,
        { ...validSession, startsAt: "2026-08-26T16:15" },
      ],
    };
    const r = validatePlanOutput(baseInput, out, "2026-12-15");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/overlap/i);
  });

  it("rejects consecutive same-day sessions with < 5-min break", () => {
    // Wed window is 16:00–18:00. Two 45-min sessions: 16:00-16:45 and
    // 16:47-17:32. The gap is only 2 min.
    const out = {
      ...validOutput,
      sessions: [
        validSession,
        {
          ...validSession,
          startsAt: "2026-08-26T16:47",
          topicName: "Photosynthesis",
        },
      ],
    };
    const r = validatePlanOutput(baseInput, out, "2026-12-15");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/5-min break/i);
  });

  it("accepts two same-day sessions with a >= 5-min break", () => {
    const out = {
      ...validOutput,
      sessions: [
        // Wed window is 16:00–18:00. Doesn't fit two 45s + 5-min break.
        // Move to Mon (dayOfWeek 1) instead which also has a 16-18 window.
        {
          ...validSession,
          startsAt: "2026-08-31T16:00", // Monday
        },
        {
          ...validSession,
          startsAt: "2026-08-31T16:50", // 5-min break after 16:45
          topicName: "Photosynthesis",
        },
      ],
    };
    const r = validatePlanOutput(baseInput, out, "2026-12-15");
    expect(r.ok).toBe(true);
  });
});

describe("sanitizeWarnings", () => {
  it("drops warnings referencing unknown subject/topic", () => {
    const filtered = sanitizeWarnings(baseInput, [
      {
        subjectName: "Biology",
        topicName: "Cellular respiration",
        message: "keep",
      },
      { subjectName: "Chemistry", topicName: "Anything", message: "drop" },
      { subjectName: "Biology", topicName: "Photosynthesis", message: "keep" },
      { subjectName: "Biology", topicName: "Nope", message: "drop" },
    ]);
    expect(filtered.map((w) => w.message)).toEqual(["keep", "keep"]);
  });
});

describe("latestExamDateOf", () => {
  it("returns the max exam date across all subjects", () => {
    expect(latestExamDateOf(baseInput)).toBe("2026-12-15");
  });

  it("returns null when no subject has an exam date", () => {
    expect(
      latestExamDateOf({
        ...baseInput,
        subjects: baseInput.subjects.map((s) => ({ ...s, examDate: null })),
      }),
    ).toBeNull();
  });
});
