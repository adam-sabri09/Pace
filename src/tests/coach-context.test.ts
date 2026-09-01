import { describe, expect, it } from "vitest";
import { buildSystemPrompt, type CoachContext } from "@/lib/coach/prompt";

const baseCtx: CoachContext = {
  firstName: "Alex",
  ageBand: "intermediate",
  subjects: [
    { name: "Biology", examDate: "2026-12-15", confidence: 60, difficulty: "medium" },
  ],
  sessionLength: 45,
  completionRate: 0.8,
  topTechnique: null,
  upcomingTasks: [],
  recentCoursework: [],
  recentPractice: null,
  weakTopics: [],
};

describe("buildSystemPrompt", () => {
  it("includes the student name and date", () => {
    const prompt = buildSystemPrompt(baseCtx, "2026-09-01");
    expect(prompt).toContain("Alex");
    expect(prompt).toContain("2026-09-01");
  });

  it("includes subject info", () => {
    const prompt = buildSystemPrompt(baseCtx, "2026-09-01");
    expect(prompt).toContain("Biology");
    expect(prompt).toContain("exam 2026-12-15");
    expect(prompt).toContain("60% confidence");
  });

  it("omits weak topics section when weakTopics is empty", () => {
    const prompt = buildSystemPrompt(baseCtx, "2026-09-01");
    expect(prompt).not.toContain("Topics needing attention");
  });

  it("includes real topic names when weakTopics are present", () => {
    const ctx: CoachContext = {
      ...baseCtx,
      weakTopics: [
        { name: "Cell Biology", mastery: 30 },
        { name: "Photosynthesis", mastery: 42 },
      ],
    };
    const prompt = buildSystemPrompt(ctx, "2026-09-01");
    expect(prompt).toContain("Topics needing attention");
    expect(prompt).toContain("Cell Biology (30% mastery)");
    expect(prompt).toContain("Photosynthesis (42% mastery)");
  });

  it("does not contain the old placeholder format", () => {
    const ctx: CoachContext = {
      ...baseCtx,
      weakTopics: [{ name: "Differentiation", mastery: 25 }],
    };
    const prompt = buildSystemPrompt(ctx, "2026-09-01");
    // Old bug produced "topic (mastery 25%)" — the real name must appear instead
    expect(prompt).not.toMatch(/topic \(mastery \d+%\)/);
    expect(prompt).toContain("Differentiation");
  });

  it("includes practice stats when present", () => {
    const ctx: CoachContext = {
      ...baseCtx,
      recentPractice: { sessionsLast7Days: 3, avgAccuracy: 72 },
    };
    const prompt = buildSystemPrompt(ctx, "2026-09-01");
    expect(prompt).toContain("3 session(s) this week");
    expect(prompt).toContain("72%");
  });
});
