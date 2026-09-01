import { describe, expect, it } from "vitest";
import { checkPlanFeasibility } from "@/server/llm/validate";
import { generateFallbackPlan } from "@/server/llm/fallback";
import type { PlanInput } from "@/server/llm/schema";

// Base input: Biology, no exam date, Mon+Wed windows, 09:00 UTC on a Tuesday.
const base = (over: Partial<PlanInput> = {}): PlanInput => ({
  timeZone: "UTC",
  now: new Date("2026-08-25T09:00:00Z"),
  sessionLengthMinutes: 45,
  subjects: [
    { id: "s1", name: "Biology", examDate: null, topics: [{ id: "t1", name: "Cells" }] },
  ],
  availability: [
    { dayOfWeek: 1, startsAt: "16:00", endsAt: "18:00" }, // Monday
    { dayOfWeek: 3, startsAt: "16:00", endsAt: "18:00" }, // Wednesday
  ],
  ...over,
});

// ── Feasibility: exams are optional ─────────────────────────────────────────

describe("checkPlanFeasibility — no exam required", () => {
  it("homework task only (no exam) → feasible", () => {
    expect(
      checkPlanFeasibility(
        base({
          tasks: [
            { title: "HW ch 3", taskType: "homework", subjectName: "Biology", dueDate: "2026-08-27", priority: "high" },
          ],
        }),
      ).ok,
    ).toBe(true);
  });

  it("assignment task only (no exam) → feasible", () => {
    expect(
      checkPlanFeasibility(
        base({
          tasks: [
            { title: "Lab report", taskType: "assignment", subjectName: "Biology", dueDate: "2026-09-01", priority: "medium" },
          ],
        }),
      ).ok,
    ).toBe(true);
  });

  it("quiz task only (no exam) → feasible", () => {
    expect(
      checkPlanFeasibility(
        base({
          tasks: [
            { title: "Quiz ch 5", taskType: "quiz", subjectName: "Biology", dueDate: "2026-08-28", priority: "high" },
          ],
        }),
      ).ok,
    ).toBe(true);
  });

  it("project task only (no exam) → feasible", () => {
    expect(
      checkPlanFeasibility(
        base({
          tasks: [
            { title: "Science fair project", taskType: "project", subjectName: "Biology", dueDate: "2026-09-15", priority: "medium" },
          ],
        }),
      ).ok,
    ).toBe(true);
  });

  it("exam only (no tasks) → feasible", () => {
    expect(
      checkPlanFeasibility(
        base({
          subjects: [
            { id: "s1", name: "Biology", examDate: "2026-09-10", topics: [{ id: "t1", name: "Cells" }] },
          ],
        }),
      ).ok,
    ).toBe(true);
  });

  it("multiple task types with no exam → feasible", () => {
    expect(
      checkPlanFeasibility(
        base({
          tasks: [
            { title: "HW ch 3", taskType: "homework", subjectName: "Biology", dueDate: "2026-08-27", priority: "high" },
            { title: "Quiz ch 5", taskType: "quiz", subjectName: "Biology", dueDate: "2026-08-28", priority: "high" },
            { title: "Science project", taskType: "project", subjectName: "Biology", dueDate: "2026-09-10", priority: "medium" },
          ],
        }),
      ).ok,
    ).toBe(true);
  });

  it("no deadlines at all → feasible (28-day horizon)", () => {
    expect(checkPlanFeasibility(base()).ok).toBe(true);
  });

  it("weak subject (hard, low confidence) with no deadlines → feasible", () => {
    expect(
      checkPlanFeasibility(
        base({
          profile: {
            ageGroup: "older",
            topTechnique: "active_recall",
            subjectIntelligence: [
              { subjectName: "Biology", difficulty: "hard", confidencePct: 15 },
            ],
          },
        }),
      ).ok,
    ).toBe(true);
  });

  it("mixed exam + homework → feasible", () => {
    expect(
      checkPlanFeasibility(
        base({
          subjects: [
            { id: "s1", name: "Biology", examDate: "2026-09-10", topics: [{ id: "t1", name: "Cells" }] },
          ],
          tasks: [
            { title: "HW ch 3", taskType: "homework", subjectName: "Biology", dueDate: "2026-08-27", priority: "high" },
          ],
        }),
      ).ok,
    ).toBe(true);
  });

  it("overdue task → feasible (overdue does not block planning)", () => {
    expect(
      checkPlanFeasibility(
        base({
          tasks: [
            { title: "Overdue HW", taskType: "homework", subjectName: "Biology", dueDate: "2026-08-23", priority: "high" },
          ],
        }),
      ).ok,
    ).toBe(true);
  });
});

// ── Fallback planner: generates sessions without exam dates ──────────────────

describe("generateFallbackPlan — task-driven and no-deadline cases", () => {
  it("generates sessions with no exam and no tasks", () => {
    const sessions = generateFallbackPlan(base());
    expect(sessions.length).toBeGreaterThan(0);
    expect(sessions[0].subjectName).toBe("Biology");
  });

  it("generates sessions for homework-only input", () => {
    const sessions = generateFallbackPlan(
      base({
        tasks: [
          { title: "HW ch 3", taskType: "homework", subjectName: "Biology", dueDate: "2026-08-27", priority: "high" },
        ],
      }),
    );
    expect(sessions.length).toBeGreaterThan(0);
  });

  it("generates sessions for quiz-only input", () => {
    const sessions = generateFallbackPlan(
      base({
        tasks: [
          { title: "Quiz ch 5", taskType: "quiz", subjectName: "Biology", dueDate: "2026-08-28", priority: "high" },
        ],
      }),
    );
    expect(sessions.length).toBeGreaterThan(0);
  });

  it("stays within the 28-day horizon when no exam or task dates", () => {
    const sessions = generateFallbackPlan(base());
    // Horizon = today + 28 days = 2026-09-22. Sessions must end by then.
    const horizonMs = new Date("2026-09-22T23:59:00Z").getTime();
    for (const s of sessions) {
      expect(s.endsAtUTC.getTime()).toBeLessThanOrEqual(horizonMs);
    }
  });

  it("prioritises subject with an upcoming task over one without", () => {
    // Biology has a task due in 2 days; English has no tasks.
    const sessions = generateFallbackPlan(
      base({
        subjects: [
          { id: "s1", name: "Biology", examDate: null, topics: [{ id: "t1", name: "Cells" }] },
          { id: "s2", name: "English", examDate: null, topics: [{ id: "t2", name: "Essays" }] },
        ],
        tasks: [
          { title: "Bio HW", taskType: "homework", subjectName: "Biology", dueDate: "2026-08-27", priority: "high" },
        ],
      }),
    );
    expect(sessions.length).toBeGreaterThan(0);
    // Biology's task urgency (10) beats English's default score, so Biology appears first.
    expect(sessions[0].subjectName).toBe("Biology");
  });

  it("prioritises subject with an overdue task as highest urgency", () => {
    // English has an overdue task (score 15); Biology has no tasks (score 1).
    const sessions = generateFallbackPlan(
      base({
        subjects: [
          { id: "s1", name: "Biology", examDate: null, topics: [{ id: "t1", name: "Cells" }] },
          { id: "s2", name: "English", examDate: null, topics: [{ id: "t2", name: "Essays" }] },
        ],
        tasks: [
          { title: "Overdue essay", taskType: "homework", subjectName: "English", dueDate: "2026-08-23", priority: "high" },
        ],
      }),
    );
    expect(sessions.length).toBeGreaterThan(0);
    expect(sessions[0].subjectName).toBe("English");
  });

  it("generates sessions for mixed exam + homework input", () => {
    const sessions = generateFallbackPlan(
      base({
        subjects: [
          { id: "s1", name: "Biology", examDate: "2026-09-10", topics: [{ id: "t1", name: "Cells" }] },
        ],
        tasks: [
          { title: "HW ch 3", taskType: "homework", subjectName: "Biology", dueDate: "2026-08-27", priority: "high" },
        ],
      }),
    );
    expect(sessions.length).toBeGreaterThan(0);
  });

  it("generates sessions when all exam dates are in the past", () => {
    // Past exam → horizon falls back to 28 days. Should still produce sessions.
    const sessions = generateFallbackPlan(
      base({
        subjects: [
          { id: "s1", name: "Biology", examDate: "2026-08-20", topics: [{ id: "t1", name: "Cells" }] },
        ],
      }),
    );
    expect(sessions.length).toBeGreaterThan(0);
  });
});
