import { describe, it, expect } from "vitest";
import {
  daysUntilExam,
  computeSubjectProgress,
} from "@/lib/progress";

const TODAY = "2026-08-26";

// ---------------------------------------------------------------------------
// daysUntilExam
// ---------------------------------------------------------------------------

describe("daysUntilExam", () => {
  it("returns a positive number for a future exam", () => {
    expect(daysUntilExam("2026-09-05", TODAY)).toBe(10);
  });

  it("returns 0 when exam is today", () => {
    expect(daysUntilExam(TODAY, TODAY)).toBe(0);
  });

  it("returns a negative number for a past exam", () => {
    expect(daysUntilExam("2026-08-16", TODAY)).toBe(-10);
  });

  it("handles month and year boundaries correctly", () => {
    expect(daysUntilExam("2027-01-01", "2026-12-31")).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// computeSubjectProgress — helper builders
// ---------------------------------------------------------------------------

type TopicInput = { sessions: Array<{ status: string }> };
type SubjectInput = {
  id: string;
  name: string;
  examDate: string;
  topics: TopicInput[];
};

function makeSubject(
  name: string,
  examDate: string,
  sessions: Array<{ status: string }>,
  id = "s1",
): SubjectInput {
  return { id, name, examDate, topics: [{ sessions }] };
}

// ---------------------------------------------------------------------------
// computeSubjectProgress
// ---------------------------------------------------------------------------

describe("computeSubjectProgress", () => {
  it("counts completed and scheduled sessions correctly", () => {
    const subject = makeSubject("Chemistry", "2026-09-10", [
      { status: "completed" },
      { status: "completed" },
      { status: "scheduled" },
      { status: "missed" }, // excluded from total
    ]);
    const [result] = computeSubjectProgress([subject], [], TODAY);
    expect(result.completedSessions).toBe(2);
    expect(result.totalSessions).toBe(3); // completed + scheduled, not missed
  });

  it("excludes missed sessions from the total", () => {
    const subject = makeSubject("Biology", "2026-09-15", [
      { status: "missed" },
      { status: "missed" },
      { status: "scheduled" },
    ]);
    const [result] = computeSubjectProgress([subject], [], TODAY);
    expect(result.completedSessions).toBe(0);
    expect(result.totalSessions).toBe(1);
  });

  it("computes progress percentage correctly", () => {
    const subject = makeSubject("Maths", "2026-09-20", [
      { status: "completed" },
      { status: "completed" },
      { status: "scheduled" },
      { status: "scheduled" },
    ]);
    const [result] = computeSubjectProgress([subject], [], TODAY);
    expect(result.progressPct).toBe(50);
  });

  it("rounds progress percentage to the nearest integer", () => {
    // 1 completed out of 3 total = 33.33...% → rounds to 33
    const subject = makeSubject("History", "2026-09-30", [
      { status: "completed" },
      { status: "scheduled" },
      { status: "scheduled" },
    ]);
    const [result] = computeSubjectProgress([subject], [], TODAY);
    expect(result.progressPct).toBe(33);
  });

  it("returns 0% progress for a zero-session subject", () => {
    const subject = makeSubject("Art", "2026-10-01", []);
    const [result] = computeSubjectProgress([subject], [], TODAY);
    expect(result.completedSessions).toBe(0);
    expect(result.totalSessions).toBe(0);
    expect(result.progressPct).toBe(0);
  });

  it("returns 100% when all sessions are completed", () => {
    const subject = makeSubject("Physics", "2026-09-05", [
      { status: "completed" },
      { status: "completed" },
    ]);
    const [result] = computeSubjectProgress([subject], [], TODAY);
    expect(result.progressPct).toBe(100);
  });

  it("computes correct daysToExam for a future exam", () => {
    const subject = makeSubject("Geography", "2026-09-05", []);
    const [result] = computeSubjectProgress([subject], [], TODAY);
    expect(result.daysToExam).toBe(10);
  });

  it("computes daysToExam as 0 when the exam is today", () => {
    const subject = makeSubject("French", TODAY, []);
    const [result] = computeSubjectProgress([subject], [], TODAY);
    expect(result.daysToExam).toBe(0);
  });

  it("computes negative daysToExam for a past exam", () => {
    const subject = makeSubject("Music", "2026-08-16", []);
    const [result] = computeSubjectProgress([subject], [], TODAY);
    expect(result.daysToExam).toBeLessThan(0);
  });

  it("sets hasWarning when the active plan warns about a subject by name", () => {
    const subject = makeSubject("Chemistry", "2026-09-10", []);
    const warnings = [
      { subjectName: "Chemistry", topicName: "Atomic structure", message: "Not enough time." },
    ];
    const [result] = computeSubjectProgress([subject], warnings, TODAY);
    expect(result.hasWarning).toBe(true);
  });

  it("does not set hasWarning when warnings reference a different subject", () => {
    const subject = makeSubject("Chemistry", "2026-09-10", []);
    const warnings = [
      { subjectName: "Biology", topicName: "Cells", message: "Not enough time." },
    ];
    const [result] = computeSubjectProgress([subject], warnings, TODAY);
    expect(result.hasWarning).toBe(false);
  });

  it("handles multiple subjects independently", () => {
    const subjects: SubjectInput[] = [
      makeSubject("Chemistry", "2026-09-10", [
        { status: "completed" },
        { status: "scheduled" },
      ], "s1"),
      makeSubject("Biology", "2026-09-20", [
        { status: "scheduled" },
        { status: "scheduled" },
      ], "s2"),
    ];
    const warnings = [{ subjectName: "Biology", topicName: "Cells", message: "Tight." }];
    const results = computeSubjectProgress(subjects, warnings, TODAY);

    expect(results).toHaveLength(2);
    expect(results[0].name).toBe("Chemistry");
    expect(results[0].progressPct).toBe(50);
    expect(results[0].hasWarning).toBe(false);
    expect(results[1].name).toBe("Biology");
    expect(results[1].progressPct).toBe(0);
    expect(results[1].hasWarning).toBe(true);
  });

  it("aggregates sessions across multiple topics for a subject", () => {
    const subject: SubjectInput = {
      id: "s1",
      name: "Chemistry",
      examDate: "2026-09-10",
      topics: [
        { sessions: [{ status: "completed" }, { status: "completed" }] },
        { sessions: [{ status: "scheduled" }, { status: "scheduled" }] },
      ],
    };
    const [result] = computeSubjectProgress([subject], [], TODAY);
    expect(result.completedSessions).toBe(2);
    expect(result.totalSessions).toBe(4);
    expect(result.progressPct).toBe(50);
  });
});
