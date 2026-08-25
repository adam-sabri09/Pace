import { describe, expect, it } from "vitest";
import { friendlyAuthError } from "@/lib/auth/errors";

describe("friendlyAuthError", () => {
  it("maps invalid credentials", () => {
    expect(friendlyAuthError("invalid_credentials", "fallback")).toMatch(
      /didn't work/i,
    );
    expect(friendlyAuthError("invalid_grant", "fallback")).toMatch(
      /didn't work/i,
    );
  });

  it("maps existing-account codes", () => {
    for (const code of [
      "email_exists",
      "user_already_exists",
      "user_already_registered",
    ]) {
      expect(friendlyAuthError(code, "fallback")).toMatch(/already exists/i);
    }
  });

  it("maps invalid email", () => {
    expect(friendlyAuthError("email_address_invalid", "fallback")).toMatch(
      /email address isn't accepted/i,
    );
    expect(friendlyAuthError("invalid_email", "fallback")).toMatch(
      /email address isn't accepted/i,
    );
  });

  it("maps email_not_confirmed to a clear, actionable message (new)", () => {
    const msg = friendlyAuthError("email_not_confirmed", "fallback");
    expect(msg).toMatch(/confirm your email/i);
    // Must NOT fall through to the generic fallback.
    expect(msg).not.toBe("fallback");
  });

  it("maps weak password", () => {
    expect(friendlyAuthError("weak_password", "fallback")).toMatch(
      /too weak/i,
    );
  });

  it("maps rate-limit codes", () => {
    expect(friendlyAuthError("over_request_rate_limit", "fallback")).toMatch(
      /too many attempts/i,
    );
    expect(friendlyAuthError("over_email_send_rate_limit", "fallback")).toMatch(
      /too many attempts/i,
    );
  });

  it("returns the fallback for unknown codes and undefined", () => {
    expect(friendlyAuthError("some_new_code", "the fallback")).toBe(
      "the fallback",
    );
    expect(friendlyAuthError(undefined, "the fallback")).toBe("the fallback");
  });
});
