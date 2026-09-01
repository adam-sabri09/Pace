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

  describe("profile block — new onboarding fields", () => {
    it("omits the profile block when profile is not set", () => {
      expect(buildPrompt(baseInput)).not.toContain("Student profile");
    });

    it("renders age_band label over raw key", () => {
      const prompt = buildPrompt({
        ...baseInput,
        profile: { ageBand: "intermediate" },
      });
      expect(prompt).toContain("Student profile");
      expect(prompt).toContain("Year 12-13 / A-Level");
    });

    it("falls back to old ageGroup when ageBand is absent", () => {
      const prompt = buildPrompt({
        ...baseInput,
        profile: { ageGroup: "younger", topTechnique: "active_recall" },
      });
      expect(prompt).toContain("GCSE / Year 9-11");
      expect(prompt).toContain("active recall");
    });

    it("includes study habits in the profile block", () => {
      const prompt = buildPrompt({
        ...baseInput,
        profile: { studyHabits: ["active_recall", "practice_tests"] },
      });
      expect(prompt).toContain("Study habits: active recall, practice tests");
    });

    it("includes study challenges in the profile block", () => {
      const prompt = buildPrompt({
        ...baseInput,
        profile: { studyChallenges: ["time_management", "staying_focused"] },
      });
      expect(prompt).toContain("Biggest challenges: time management, staying focused");
    });

    it("includes goal ranking in the profile block", () => {
      const prompt = buildPrompt({
        ...baseInput,
        profile: { goalRanking: ["get_top_grades", "reduce_stress", "build_habits"] },
      });
      expect(prompt).toContain("Goals (top 3): get top grades > reduce stress > build habits");
    });

    it("labels memoryScore as strong when >= 80", () => {
      const prompt = buildPrompt({ ...baseInput, profile: { memoryScore: 85 } });
      expect(prompt).toContain("Memory/retention: strong (score 85%)");
    });

    it("labels memoryScore as average when 50-79", () => {
      const prompt = buildPrompt({ ...baseInput, profile: { memoryScore: 65 } });
      expect(prompt).toContain("Memory/retention: average (score 65%)");
    });

    it("labels memoryScore as developing when < 50", () => {
      const prompt = buildPrompt({ ...baseInput, profile: { memoryScore: 35 } });
      expect(prompt).toContain("Memory/retention: developing (score 35%)");
    });

    it("renders all new and old fields together when fully populated", () => {
      const prompt = buildPrompt({
        ...baseInput,
        profile: {
          ageGroup: "older",
          ageBand: "senior",
          topTechnique: "spaced_repetition",
          studyHabits: ["active_recall"],
          studyChallenges: ["procrastination"],
          goalRanking: ["get_top_grades"],
          memoryScore: 70,
          subjectIntelligence: [
            { subjectName: "Biology", difficulty: "hard", confidencePct: 40 },
          ],
        },
      });
      // ageBand takes precedence over ageGroup for the age line
      expect(prompt).toContain("Final year / Pre-university");
      expect(prompt).toContain("spaced repetition");
      expect(prompt).toContain("active recall");
      expect(prompt).toContain("procrastination");
      expect(prompt).toContain("get top grades");
      expect(prompt).toContain("average (score 70%)");
      expect(prompt).toContain("Biology: hard, 40% confident");
    });
  });
});
