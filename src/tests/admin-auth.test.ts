import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// We test the helper by controlling process.env directly.
// The module is not "use server" so it can be imported in a test context.
import { isAdminEmail } from "@/lib/auth/admin";

describe("isAdminEmail", () => {
  const originalEnv = process.env.ADMIN_EMAILS;

  afterEach(() => {
    if (originalEnv === undefined) {
      delete process.env.ADMIN_EMAILS;
    } else {
      process.env.ADMIN_EMAILS = originalEnv;
    }
    vi.unstubAllEnvs();
  });

  it("returns false when ADMIN_EMAILS is not set", () => {
    delete process.env.ADMIN_EMAILS;
    expect(isAdminEmail("anyone@example.com")).toBe(false);
  });

  it("returns false when ADMIN_EMAILS is empty", () => {
    vi.stubEnv("ADMIN_EMAILS", "");
    expect(isAdminEmail("anyone@example.com")).toBe(false);
  });

  it("returns true for an exact match", () => {
    vi.stubEnv("ADMIN_EMAILS", "admin@example.com");
    expect(isAdminEmail("admin@example.com")).toBe(true);
  });

  it("matches case-insensitively", () => {
    vi.stubEnv("ADMIN_EMAILS", "admin@example.com");
    expect(isAdminEmail("ADMIN@EXAMPLE.COM")).toBe(true);
    expect(isAdminEmail("Admin@Example.Com")).toBe(true);
  });

  it("returns true when email is in a comma-separated list", () => {
    vi.stubEnv("ADMIN_EMAILS", "alice@example.com,bob@example.com,carol@example.com");
    expect(isAdminEmail("bob@example.com")).toBe(true);
  });

  it("returns false for an email not in the list", () => {
    vi.stubEnv("ADMIN_EMAILS", "alice@example.com,bob@example.com");
    expect(isAdminEmail("eve@example.com")).toBe(false);
  });

  it("handles whitespace around commas", () => {
    vi.stubEnv("ADMIN_EMAILS", " alice@example.com , bob@example.com ");
    expect(isAdminEmail("alice@example.com")).toBe(true);
    expect(isAdminEmail("bob@example.com")).toBe(true);
  });

  it("returns false for undefined email", () => {
    vi.stubEnv("ADMIN_EMAILS", "admin@example.com");
    expect(isAdminEmail(undefined)).toBe(false);
  });

  it("returns false for null email", () => {
    vi.stubEnv("ADMIN_EMAILS", "admin@example.com");
    expect(isAdminEmail(null)).toBe(false);
  });

  it("returns false for empty string email", () => {
    vi.stubEnv("ADMIN_EMAILS", "admin@example.com");
    expect(isAdminEmail("")).toBe(false);
  });
});
