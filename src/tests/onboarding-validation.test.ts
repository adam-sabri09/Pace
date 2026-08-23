import { describe, expect, it } from "vitest";
import {
  AvailabilityWindowSchema,
  OnboardingSchema,
  SubjectDraftSchema,
  hasOverlappingWindows,
} from "@/lib/validation/onboarding";

const baseSubject = {
  name: "Biology",
  examDate: "2026-12-01",
  topics: [{ name: "Cellular respiration" }],
};

const baseAvailability = [
  { dayOfWeek: 1, startsAt: "16:00", endsAt: "18:00" },
];

const baseOnboarding = {
  subjects: [baseSubject],
  availability: baseAvailability,
  sessionLengthMinutes: 45 as const,
};

describe("SubjectDraftSchema", () => {
  it("accepts a valid subject", () => {
    expect(SubjectDraftSchema.safeParse(baseSubject).success).toBe(true);
  });

  it("requires at least one topic", () => {
    const parsed = SubjectDraftSchema.safeParse({ ...baseSubject, topics: [] });
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(parsed.error.issues[0].message).toMatch(/topic/i);
    }
  });

  it("trims and rejects whitespace-only subject name", () => {
    const parsed = SubjectDraftSchema.safeParse({
      ...baseSubject,
      name: "   ",
    });
    expect(parsed.success).toBe(false);
  });

  it("caps subject name length at 100 chars", () => {
    const parsed = SubjectDraftSchema.safeParse({
      ...baseSubject,
      name: "a".repeat(101),
    });
    expect(parsed.success).toBe(false);
  });

  it("allows null exam date", () => {
    const parsed = SubjectDraftSchema.safeParse({
      ...baseSubject,
      examDate: null,
    });
    expect(parsed.success).toBe(true);
  });

  it("rejects malformed exam date", () => {
    const parsed = SubjectDraftSchema.safeParse({
      ...baseSubject,
      examDate: "12/01/2026",
    });
    expect(parsed.success).toBe(false);
  });
});

describe("AvailabilityWindowSchema", () => {
  it("accepts a valid window", () => {
    expect(
      AvailabilityWindowSchema.safeParse({
        dayOfWeek: 3,
        startsAt: "09:00",
        endsAt: "12:00",
      }).success,
    ).toBe(true);
  });

  it("requires HH:MM time strings", () => {
    expect(
      AvailabilityWindowSchema.safeParse({
        dayOfWeek: 1,
        startsAt: "9",
        endsAt: "10",
      }).success,
    ).toBe(false);
  });

  it("rejects day_of_week out of range", () => {
    expect(
      AvailabilityWindowSchema.safeParse({
        dayOfWeek: 7,
        startsAt: "09:00",
        endsAt: "10:00",
      }).success,
    ).toBe(false);
  });

  it("rejects when ends_at is not after starts_at", () => {
    expect(
      AvailabilityWindowSchema.safeParse({
        dayOfWeek: 1,
        startsAt: "10:00",
        endsAt: "10:00",
      }).success,
    ).toBe(false);
    expect(
      AvailabilityWindowSchema.safeParse({
        dayOfWeek: 1,
        startsAt: "10:00",
        endsAt: "09:00",
      }).success,
    ).toBe(false);
  });
});

describe("hasOverlappingWindows", () => {
  it("returns false for a single window", () => {
    expect(
      hasOverlappingWindows([
        { dayOfWeek: 1, startsAt: "16:00", endsAt: "18:00" },
      ]),
    ).toBe(false);
  });

  it("returns false for non-overlapping windows on the same day", () => {
    expect(
      hasOverlappingWindows([
        { dayOfWeek: 1, startsAt: "09:00", endsAt: "10:00" },
        { dayOfWeek: 1, startsAt: "10:00", endsAt: "11:00" },
        { dayOfWeek: 1, startsAt: "14:00", endsAt: "15:00" },
      ]),
    ).toBe(false);
  });

  it("returns true for overlapping windows on the same day", () => {
    expect(
      hasOverlappingWindows([
        { dayOfWeek: 2, startsAt: "09:00", endsAt: "11:00" },
        { dayOfWeek: 2, startsAt: "10:00", endsAt: "12:00" },
      ]),
    ).toBe(true);
  });

  it("ignores overlap ACROSS different days", () => {
    expect(
      hasOverlappingWindows([
        { dayOfWeek: 1, startsAt: "09:00", endsAt: "11:00" },
        { dayOfWeek: 2, startsAt: "09:00", endsAt: "11:00" },
      ]),
    ).toBe(false);
  });
});

describe("OnboardingSchema", () => {
  it("accepts a valid onboarding payload", () => {
    expect(OnboardingSchema.safeParse(baseOnboarding).success).toBe(true);
  });

  it("rejects when subjects is empty", () => {
    const parsed = OnboardingSchema.safeParse({
      ...baseOnboarding,
      subjects: [],
    });
    expect(parsed.success).toBe(false);
  });

  it("rejects when no subject has an exam date", () => {
    const parsed = OnboardingSchema.safeParse({
      ...baseOnboarding,
      subjects: [{ ...baseSubject, examDate: null }],
    });
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(parsed.error.issues[0].message).toMatch(/exam/i);
    }
  });

  it("rejects when availability is empty", () => {
    const parsed = OnboardingSchema.safeParse({
      ...baseOnboarding,
      availability: [],
    });
    expect(parsed.success).toBe(false);
  });

  it("rejects overlapping availability windows on the same day", () => {
    const parsed = OnboardingSchema.safeParse({
      ...baseOnboarding,
      availability: [
        { dayOfWeek: 1, startsAt: "09:00", endsAt: "11:00" },
        { dayOfWeek: 1, startsAt: "10:00", endsAt: "12:00" },
      ],
    });
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(parsed.error.issues[0].message).toMatch(/overlap/i);
    }
  });

  it("only accepts session_length in {25, 45, 60}", () => {
    for (const invalid of [10, 20, 30, 90, 120]) {
      expect(
        OnboardingSchema.safeParse({
          ...baseOnboarding,
          sessionLengthMinutes: invalid,
        }).success,
      ).toBe(false);
    }
    for (const valid of [25, 45, 60]) {
      expect(
        OnboardingSchema.safeParse({
          ...baseOnboarding,
          sessionLengthMinutes: valid,
        }).success,
      ).toBe(true);
    }
  });
});
