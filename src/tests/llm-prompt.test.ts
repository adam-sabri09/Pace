import { describe, expect, it } from "vitest";
import { buildPrompt } from "@/server/llm/prompt";
import type { PlanInput } from "@/server/llm/schema";

const baseInput: PlanInput = {
  timeZone: "Europe/Amsterdam",
  now: new Date("2026-08-25T14:00:00Z"), // 16:00 local
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

describe("buildPrompt", () => {
  it("includes the timezone", () => {
    expect(buildPrompt(baseInput)).toMatch(/Europe\/Amsterdam/);
  });

  it("renders `now` in the user's local wall clock", () => {
    // 14:00 UTC == 16:00 Europe/Amsterdam on 2026-08-25.
    expect(buildPrompt(baseInput)).toMatch(/2026-08-25 16:00 local/);
  });

  it("states the required fixed session length", () => {
    expect(buildPrompt(baseInput)).toMatch(/Fixed session length: 45 minutes/);
    expect(buildPrompt(baseInput)).toMatch(/exactly 45/);
  });

  it("lists every subject with its exam date", () => {
    const prompt = buildPrompt(baseInput);
    expect(prompt).toMatch(/Biology.*exam: 2026-12-15/);
    expect(prompt).toMatch(/Math.*no exam date set/);
  });

  it("lists every topic under its subject", () => {
    const prompt = buildPrompt(baseInput);
    expect(prompt).toContain("Cellular respiration");
    expect(prompt).toContain("Photosynthesis");
    expect(prompt).toContain("Quadratic equations");
  });

  it("renders availability for every weekday", () => {
    const prompt = buildPrompt(baseInput);
    expect(prompt).toMatch(/Sunday: \(unavailable\)/);
    expect(prompt).toMatch(/Monday: 16:00–18:00/);
    expect(prompt).toMatch(/Wednesday: 16:00–18:00/);
    expect(prompt).toMatch(/Tuesday: \(unavailable\)/);
  });

  it("omits the completed-sessions block when there are none", () => {
    expect(buildPrompt(baseInput)).not.toMatch(/Already-completed sessions/);
  });

  it("includes the completed-sessions block when present", () => {
    const prompt = buildPrompt({
      ...baseInput,
      completedSessions: [
        {
          startsAt: "2026-08-24T16:00:00.000Z",
          subjectName: "Biology",
          topicName: "Cellular respiration",
          durationMinutes: 45,
        },
      ],
    });
    expect(prompt).toMatch(/Already-completed sessions/);
    expect(prompt).toMatch(/Biology · Cellular respiration/);
  });

  it("mentions the 5-min break rule and no-overlap rule", () => {
    const prompt = buildPrompt(baseInput);
    expect(prompt).toMatch(/5-minute gap/);
    expect(prompt).toMatch(/must not overlap/i);
  });
});
