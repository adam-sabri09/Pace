import { describe, it, expect } from "vitest";
import { OcrRawSchema } from "@/lib/validation/ocr-raw";

// Regression tests for the raw AI-response schema used in extractScheduleAction.
//
// Root cause of original bug: Gemini returns `topics: null` (not `topics: []`)
// when a simple schedule has no visible topics. The previous schema used
// z.array().default([]) which only handles undefined, not null — so Zod
// validation failed, generateObject threw, and the action returned "Could not
// extract subjects from the file."
//
// Fix: topics is now z.array().nullable().default([]).transform(v => v ?? []).

describe("OcrRawSchema — topics null-handling (regression)", () => {
  it("accepts topics: null and normalises to []", () => {
    const result = OcrRawSchema.safeParse({
      subjects: [{ name: "Mathematics", examDate: null, topics: null }],
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.subjects[0].topics).toEqual([]);
    }
  });

  it("accepts topics: undefined and normalises to []", () => {
    const result = OcrRawSchema.safeParse({
      subjects: [{ name: "Science", examDate: null }],
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.subjects[0].topics).toEqual([]);
    }
  });

  it("accepts topics: [] and keeps it as []", () => {
    const result = OcrRawSchema.safeParse({
      subjects: [{ name: "History", examDate: null, topics: [] }],
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.subjects[0].topics).toEqual([]);
    }
  });

  it("accepts topics: ['Chapter 1'] and keeps the value", () => {
    const result = OcrRawSchema.safeParse({
      subjects: [{ name: "English", examDate: null, topics: ["Chapter 1", "Chapter 2"] }],
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.subjects[0].topics).toEqual(["Chapter 1", "Chapter 2"]);
    }
  });

  it("handles a mix — some subjects have topics, some return null", () => {
    const result = OcrRawSchema.safeParse({
      subjects: [
        { name: "Biology", examDate: "2026-06-01", topics: ["Cell division", "Genetics"] },
        { name: "Art", examDate: null, topics: null },
        { name: "PE", topics: null },
      ],
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.subjects[0].topics).toEqual(["Cell division", "Genetics"]);
      expect(result.data.subjects[1].topics).toEqual([]);
      expect(result.data.subjects[2].topics).toEqual([]);
    }
  });
});

describe("OcrRawSchema — examDate handling", () => {
  it("accepts examDate: null", () => {
    const result = OcrRawSchema.safeParse({
      subjects: [{ name: "Math", examDate: null, topics: [] }],
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.subjects[0].examDate).toBeNull();
    }
  });

  it("accepts examDate: undefined and defaults to null", () => {
    const result = OcrRawSchema.safeParse({
      subjects: [{ name: "Math", topics: [] }],
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.subjects[0].examDate).toBeNull();
    }
  });

  it("accepts a valid date string", () => {
    const result = OcrRawSchema.safeParse({
      subjects: [{ name: "Math", examDate: "2026-11-15", topics: [] }],
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.subjects[0].examDate).toBe("2026-11-15");
    }
  });
});

describe("OcrRawSchema — empty subjects list", () => {
  it("accepts an empty subjects array", () => {
    const result = OcrRawSchema.safeParse({ subjects: [] });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.subjects).toEqual([]);
    }
  });
});
