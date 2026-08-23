import { describe, expect, it } from "vitest";
import { LogInSchema, SignUpSchema } from "@/lib/validation/auth";

/**
 * Tests focus on the boundary the server action enforces. We intentionally
 * don't test the Supabase call itself here — that's covered by the live
 * verification we did in Step 2 and (future) integration tests.
 */

describe("SignUpSchema", () => {
  const valid = {
    firstName: "Alex",
    email: "alex@example.com",
    password: "correcthorse",
    ageConfirmed13Plus: true,
    timeZone: "Europe/Amsterdam",
  };

  it("accepts a valid payload", () => {
    const parsed = SignUpSchema.safeParse(valid);
    expect(parsed.success).toBe(true);
  });

  it("trims first name and rejects whitespace-only", () => {
    const parsed = SignUpSchema.safeParse({ ...valid, firstName: "   " });
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(parsed.error.issues[0].message).toMatch(/first name/i);
    }
  });

  it("caps first name length at 50", () => {
    const parsed = SignUpSchema.safeParse({ ...valid, firstName: "a".repeat(51) });
    expect(parsed.success).toBe(false);
  });

  it("rejects invalid email", () => {
    const parsed = SignUpSchema.safeParse({ ...valid, email: "not-an-email" });
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(parsed.error.issues[0].message).toMatch(/email/i);
    }
  });

  it("requires password >= 8 chars", () => {
    const parsed = SignUpSchema.safeParse({ ...valid, password: "short" });
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(parsed.error.issues[0].message).toMatch(/8 characters/i);
    }
  });

  it("caps password at 72 chars (bcrypt max)", () => {
    const parsed = SignUpSchema.safeParse({ ...valid, password: "a".repeat(73) });
    expect(parsed.success).toBe(false);
  });

  it("REJECTS signup when the age-13+ box is not ticked", () => {
    const parsed = SignUpSchema.safeParse({ ...valid, ageConfirmed13Plus: false });
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(parsed.error.issues[0].message).toMatch(/13 or older/i);
    }
  });

  it("REJECTS signup when the age-13+ field is missing", () => {
    const missing = Object.fromEntries(
      Object.entries(valid).filter(([k]) => k !== "ageConfirmed13Plus"),
    );
    const parsed = SignUpSchema.safeParse(missing);
    expect(parsed.success).toBe(false);
  });

  it("falls back to UTC when timezone is empty", () => {
    // z.catch("UTC") kicks in when the string fails min(1) — verified via a
    // whitespace-only value that fails trim's min(1).
    const parsed = SignUpSchema.safeParse({ ...valid, timeZone: "" });
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.timeZone).toBe("UTC");
  });
});

describe("LogInSchema", () => {
  it("accepts a valid payload", () => {
    const parsed = LogInSchema.safeParse({
      email: "alex@example.com",
      password: "anything-nonempty",
    });
    expect(parsed.success).toBe(true);
  });

  it("rejects missing email", () => {
    const parsed = LogInSchema.safeParse({ email: "", password: "x" });
    expect(parsed.success).toBe(false);
  });

  it("rejects missing password", () => {
    const parsed = LogInSchema.safeParse({ email: "x@example.com", password: "" });
    expect(parsed.success).toBe(false);
  });
});
