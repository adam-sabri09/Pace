import { describe, it, expect } from "vitest";
import { AddSubjectSchema } from "@/lib/validation/subjects";

const VALID = {
  name: "Mathematics",
  examDate: "2026-11-15",
  topics: ["Algebra", "Calculus"],
  difficulty: "hard" as const,
  confidencePct: 60,
};

describe("AddSubjectSchema", () => {
  it("accepts a fully populated subject", () => {
    expect(AddSubjectSchema.safeParse(VALID).success).toBe(true);
  });

  it("accepts minimal subject with only a name", () => {
    expect(
      AddSubjectSchema.safeParse({
        name: "Biology",
        examDate: null,
        topics: [],
        difficulty: null,
        confidencePct: null,
      }).success,
    ).toBe(true);
  });

  it("rejects an empty name", () => {
    expect(
      AddSubjectSchema.safeParse({ ...VALID, name: "" }).success,
    ).toBe(false);
  });

  it("rejects a name that is only whitespace", () => {
    expect(
      AddSubjectSchema.safeParse({ ...VALID, name: "   " }).success,
    ).toBe(false);
  });

  it("rejects a name longer than 100 chars", () => {
    expect(
      AddSubjectSchema.safeParse({ ...VALID, name: "A".repeat(101) }).success,
    ).toBe(false);
  });

  it("accepts null examDate", () => {
    expect(
      AddSubjectSchema.safeParse({ ...VALID, examDate: null }).success,
    ).toBe(true);
  });

  it("rejects a badly formatted exam date", () => {
    expect(
      AddSubjectSchema.safeParse({ ...VALID, examDate: "15/11/2026" }).success,
    ).toBe(false);
    expect(
      AddSubjectSchema.safeParse({ ...VALID, examDate: "November 15" }).success,
    ).toBe(false);
  });

  it("defaults topics to [] when omitted", () => {
    const result = AddSubjectSchema.safeParse({
      name: "Physics",
      examDate: null,
      difficulty: null,
      confidencePct: null,
    });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.topics).toEqual([]);
  });

  it("accepts all valid difficulty values", () => {
    for (const difficulty of ["easy", "medium", "hard"] as const) {
      expect(
        AddSubjectSchema.safeParse({ ...VALID, difficulty }).success,
      ).toBe(true);
    }
  });

  it("accepts null difficulty", () => {
    expect(
      AddSubjectSchema.safeParse({ ...VALID, difficulty: null }).success,
    ).toBe(true);
  });

  it("rejects an unknown difficulty value", () => {
    expect(
      AddSubjectSchema.safeParse({ ...VALID, difficulty: "extreme" }).success,
    ).toBe(false);
  });

  it("accepts null confidencePct", () => {
    expect(
      AddSubjectSchema.safeParse({ ...VALID, confidencePct: null }).success,
    ).toBe(true);
  });

  it("rejects confidencePct below 0", () => {
    expect(
      AddSubjectSchema.safeParse({ ...VALID, confidencePct: -1 }).success,
    ).toBe(false);
  });

  it("rejects confidencePct above 100", () => {
    expect(
      AddSubjectSchema.safeParse({ ...VALID, confidencePct: 101 }).success,
    ).toBe(false);
  });

  it("accepts boundary confidencePct values 0 and 100", () => {
    expect(
      AddSubjectSchema.safeParse({ ...VALID, confidencePct: 0 }).success,
    ).toBe(true);
    expect(
      AddSubjectSchema.safeParse({ ...VALID, confidencePct: 100 }).success,
    ).toBe(true);
  });

  it("schema uses same fields as personalization system expects (name, difficulty, confidence_pct shape)", () => {
    const result = AddSubjectSchema.safeParse(VALID);
    expect(result.success).toBe(true);
    if (!result.success) return;
    const { data } = result;
    // These are exactly the fields read by today/page.tsx → buildTodayRecommendation
    expect(typeof data.name).toBe("string");
    expect(["easy", "medium", "hard", null]).toContain(data.difficulty);
    expect(
      data.confidencePct === null ||
        (typeof data.confidencePct === "number" &&
          data.confidencePct >= 0 &&
          data.confidencePct <= 100),
    ).toBe(true);
  });
});
