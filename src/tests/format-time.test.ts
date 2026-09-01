import { describe, expect, it } from "vitest";
import { formatLocalTime } from "@/components/LocalTime";

describe("formatLocalTime", () => {
  it("produces a human-readable string, not a raw ISO string", () => {
    const result = formatLocalTime("2026-09-01T10:39:00Z", "UTC");
    expect(result).not.toBe("2026-09-01T10:39:00Z");
    expect(result.length).toBeGreaterThan(0);
  });

  it("includes the correct hour and minute for UTC", () => {
    const result = formatLocalTime("2026-09-01T10:39:00Z", "UTC");
    expect(result).toMatch(/10:39/);
    expect(result).toMatch(/AM/i);
  });

  it("converts to Africa/Casablanca (UTC+1) correctly", () => {
    // 2026-09-01T10:39Z → 11:39 AM in Africa/Casablanca (UTC+1, no DST)
    const result = formatLocalTime("2026-09-01T10:39:00Z", "Africa/Casablanca");
    expect(result).toMatch(/11:39/);
    expect(result).toMatch(/AM/i);
  });

  it("produces different output for different timezones", () => {
    const utcResult = formatLocalTime("2026-09-01T10:39:00Z", "UTC");
    const nycResult = formatLocalTime("2026-09-01T10:39:00Z", "America/New_York");
    expect(utcResult).not.toBe(nycResult);
  });

  it("handles midnight boundary correctly", () => {
    // 2026-09-01T23:30Z is 11:30 PM UTC → 00:30 AM on Sep 2 in UTC+1
    const utc = formatLocalTime("2026-09-01T23:30:00Z", "UTC");
    const plus1 = formatLocalTime("2026-09-01T23:30:00Z", "Africa/Casablanca");
    expect(utc).toMatch(/11:30/);
    expect(utc).toMatch(/PM/i);
    expect(plus1).toMatch(/12:30/);
    expect(plus1).toMatch(/AM/i);
  });

  it("includes the year, month, and day in the output", () => {
    const result = formatLocalTime("2026-09-01T10:39:00Z", "UTC");
    expect(result).toMatch(/2026/);
    expect(result).toMatch(/Sep/i);
    expect(result).toMatch(/1/);
  });
});
