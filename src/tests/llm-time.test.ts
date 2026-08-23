import { describe, expect, it } from "vitest";
import { hhmmToMinutes, localWallClockToUTC, utcToLocalParts } from "@/server/llm/time";

/**
 * Round-trip and DST tests for the timezone helpers.
 */

describe("localWallClockToUTC", () => {
  it("interprets Amsterdam summer time correctly (CEST = UTC+2)", () => {
    // 2026-08-25 is well inside CEST.
    const utc = localWallClockToUTC("2026-08-25T16:00", "Europe/Amsterdam");
    expect(utc.toISOString()).toBe("2026-08-25T14:00:00.000Z");
  });

  it("interprets Amsterdam winter time correctly (CET = UTC+1)", () => {
    const utc = localWallClockToUTC("2026-01-15T09:30", "Europe/Amsterdam");
    expect(utc.toISOString()).toBe("2026-01-15T08:30:00.000Z");
  });

  it("interprets New York summer time correctly (EDT = UTC-4)", () => {
    const utc = localWallClockToUTC("2026-07-04T12:00", "America/New_York");
    expect(utc.toISOString()).toBe("2026-07-04T16:00:00.000Z");
  });

  it("interprets UTC as itself", () => {
    const utc = localWallClockToUTC("2026-08-25T16:00", "UTC");
    expect(utc.toISOString()).toBe("2026-08-25T16:00:00.000Z");
  });

  it("rejects malformed input", () => {
    expect(() => localWallClockToUTC("not a date", "UTC")).toThrow();
    expect(() => localWallClockToUTC("2026-08-25 16:00", "UTC")).toThrow();
  });
});

describe("utcToLocalParts", () => {
  it("round-trips with localWallClockToUTC", () => {
    const tzs = ["UTC", "Europe/Amsterdam", "America/New_York", "Asia/Tokyo"];
    const inputs = [
      "2026-08-25T16:00",
      "2026-01-15T09:30",
      "2026-03-30T02:30",
      "2026-11-01T23:45",
    ];
    for (const tz of tzs) {
      for (const iso of inputs) {
        const utc = localWallClockToUTC(iso, tz);
        const parts = utcToLocalParts(utc, tz);
        expect(`${parts.dateString}T${parts.timeString}`).toBe(iso);
      }
    }
  });

  it("returns the correct day-of-week", () => {
    // 2026-08-25 is a Tuesday.
    const utc = localWallClockToUTC("2026-08-25T10:00", "Europe/Amsterdam");
    const parts = utcToLocalParts(utc, "Europe/Amsterdam");
    expect(parts.dayOfWeek).toBe(2);
  });
});

describe("hhmmToMinutes", () => {
  it("converts HH:MM to minutes-in-day", () => {
    expect(hhmmToMinutes("00:00")).toBe(0);
    expect(hhmmToMinutes("09:30")).toBe(570);
    expect(hhmmToMinutes("16:00")).toBe(960);
    expect(hhmmToMinutes("23:59")).toBe(1439);
  });
});
