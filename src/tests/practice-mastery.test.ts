import { describe, expect, it } from "vitest";
import { resolveTopicId } from "@/lib/practice/topic-resolution";

const subjects = [
  { name: "Biology", topics: [{ id: "bio-1" }, { id: "bio-2" }] },
  { name: "Mathematics", topics: [{ id: "math-1" }] },
  { name: "History", topics: [] },
];

describe("resolveTopicId", () => {
  it("returns the first topic id of the matching subject", () => {
    expect(resolveTopicId("Biology", subjects)).toBe("bio-1");
  });

  it("matches case-insensitively", () => {
    expect(resolveTopicId("biology", subjects)).toBe("bio-1");
    expect(resolveTopicId("MATHEMATICS", subjects)).toBe("math-1");
    expect(resolveTopicId("Mathematics", subjects)).toBe("math-1");
  });

  it("returns null when subject name is null", () => {
    expect(resolveTopicId(null, subjects)).toBeNull();
  });

  it("returns null when subject name is undefined", () => {
    expect(resolveTopicId(undefined, subjects)).toBeNull();
  });

  it("returns null when no subject matches", () => {
    expect(resolveTopicId("Physics", subjects)).toBeNull();
  });

  it("returns null when subject has no topics", () => {
    expect(resolveTopicId("History", subjects)).toBeNull();
  });

  it("returns null when subjects list is empty", () => {
    expect(resolveTopicId("Biology", [])).toBeNull();
  });
});
