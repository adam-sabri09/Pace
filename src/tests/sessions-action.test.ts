import { describe, expect, it } from "vitest";
import { SessionIdSchema } from "@/lib/validation/sessions";

describe("SessionIdSchema", () => {
  it("accepts a valid UUID", () => {
    expect(
      SessionIdSchema.safeParse({
        sessionId: "12345678-1234-4234-a234-123456789012",
      }).success,
    ).toBe(true);
  });

  it("rejects a missing sessionId", () => {
    const r = SessionIdSchema.safeParse({});
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues[0].message).toMatch(/required/i);
  });

  it("rejects a non-UUID string", () => {
    const r = SessionIdSchema.safeParse({ sessionId: "not-a-uuid" });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues[0].message).toMatch(/invalid/i);
  });

  it("rejects an empty string", () => {
    const r = SessionIdSchema.safeParse({ sessionId: "" });
    expect(r.success).toBe(false);
  });
});
