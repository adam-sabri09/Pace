import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("server-only", () => ({}));

const mockGetUser = vi.fn();
vi.mock("@/lib/supabase/server", () => ({
  createClient: () =>
    Promise.resolve({ auth: { getUser: () => mockGetUser() } }),
}));

vi.mock("@ai-sdk/google", () => ({
  google: vi.fn(() => "mock-model"),
}));

const mockGenerateObject = vi.fn();
vi.mock("ai", () => ({
  generateObject: (...args: unknown[]) => mockGenerateObject(...args),
}));

import { suggestTopicsAction } from "@/server/actions/suggestions";

const AUTHED = { data: { user: { id: "user-123" } } };
const UNAUTHED = { data: { user: null } };

describe("suggestTopicsAction", () => {
  beforeEach(() => {
    mockGetUser.mockReset();
    mockGenerateObject.mockReset();
    mockGetUser.mockResolvedValue(AUTHED);
  });

  it("returns {} when not authenticated", async () => {
    mockGetUser.mockResolvedValue(UNAUTHED);
    const result = await suggestTopicsAction(["Biology"]);
    expect(result).toEqual({});
    expect(mockGenerateObject).not.toHaveBeenCalled();
  });

  it("returns suggestions keyed by subject name", async () => {
    mockGenerateObject.mockResolvedValue({
      object: {
        suggestions: [
          {
            subjectName: "Biology",
            topics: ["Cell division", "Photosynthesis", "DNA replication"],
          },
          {
            subjectName: "Chemistry",
            topics: ["Atomic structure", "Bonding", "Reactions"],
          },
        ],
      },
    });
    const result = await suggestTopicsAction(["Biology", "Chemistry"]);
    expect(result["Biology"]).toEqual([
      "Cell division",
      "Photosynthesis",
      "DNA replication",
    ]);
    expect(result["Chemistry"]).toEqual([
      "Atomic structure",
      "Bonding",
      "Reactions",
    ]);
  });

  it("caps suggestions at 6 per subject", async () => {
    mockGenerateObject.mockResolvedValue({
      object: {
        suggestions: [
          {
            subjectName: "History",
            topics: [
              "Topic 1",
              "Topic 2",
              "Topic 3",
              "Topic 4",
              "Topic 5",
              "Topic 6",
              "Topic 7",
            ],
          },
        ],
      },
    });
    const result = await suggestTopicsAction(["History"]);
    expect(result["History"]).toHaveLength(6);
  });

  it("returns {} for empty input", async () => {
    const result = await suggestTopicsAction([]);
    expect(result).toEqual({});
    expect(mockGenerateObject).not.toHaveBeenCalled();
  });

  it("returns {} when input exceeds 20 subjects", async () => {
    const names = Array.from({ length: 21 }, (_, i) => `Subject ${i + 1}`);
    const result = await suggestTopicsAction(names);
    expect(result).toEqual({});
    expect(mockGenerateObject).not.toHaveBeenCalled();
  });

  it("returns {} when generateObject throws", async () => {
    mockGenerateObject.mockRejectedValue(new Error("Network error"));
    const result = await suggestTopicsAction(["Biology"]);
    expect(result).toEqual({});
  });

  it("ignores suggestions for unknown subject names", async () => {
    mockGenerateObject.mockResolvedValue({
      object: {
        suggestions: [{ subjectName: "UnknownSubject", topics: ["Topic A"] }],
      },
    });
    const result = await suggestTopicsAction(["Biology"]);
    expect(result["UnknownSubject"]).toBeUndefined();
    expect(result["Biology"]).toBeUndefined();
  });

  it("matches subject names case-insensitively", async () => {
    mockGenerateObject.mockResolvedValue({
      object: {
        suggestions: [{ subjectName: "BIOLOGY", topics: ["Cells"] }],
      },
    });
    const result = await suggestTopicsAction(["Biology"]);
    expect(result["Biology"]).toEqual(["Cells"]);
  });

  it("returns {} when a subject name exceeds 100 characters", async () => {
    const result = await suggestTopicsAction(["a".repeat(101)]);
    expect(result).toEqual({});
    expect(mockGenerateObject).not.toHaveBeenCalled();
  });

  it("passes subject names to the model prompt", async () => {
    mockGenerateObject.mockResolvedValue({
      object: { suggestions: [] },
    });
    await suggestTopicsAction(["Maths", "Physics"]);
    const call = mockGenerateObject.mock.calls[0][0] as { prompt: string };
    expect(call.prompt).toContain("Maths");
    expect(call.prompt).toContain("Physics");
  });
});
