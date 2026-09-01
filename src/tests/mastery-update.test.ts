import { describe, it, expect } from "vitest";
import { computeNewMastery, applyDecay, MASTERY_ALPHA } from "@/lib/mastery/update";

describe("computeNewMastery", () => {
  it("increases mastery when session is completed", () => {
    const result = computeNewMastery(50, true);
    expect(result).toBeGreaterThan(50);
  });

  it("decreases mastery when session is missed", () => {
    const result = computeNewMastery(50, false);
    expect(result).toBeLessThan(50);
  });

  it("applies exponential smoothing: completed from 0", () => {
    // new = 0.3 * 100 + 0.7 * 0 = 30
    expect(computeNewMastery(0, true)).toBe(30);
  });

  it("applies exponential smoothing: missed from 100", () => {
    // new = 0.3 * 0 + 0.7 * 100 = 70
    expect(computeNewMastery(100, false)).toBe(70);
  });

  it("clamps result to [0, 100]", () => {
    expect(computeNewMastery(0, false)).toBeGreaterThanOrEqual(0);
    expect(computeNewMastery(100, true)).toBeLessThanOrEqual(100);
  });

  it("converges toward 100 with repeated completions", () => {
    let m = 0;
    for (let i = 0; i < 20; i++) m = computeNewMastery(m, true);
    expect(m).toBeGreaterThan(95);
  });

  it("converges toward 0 with repeated misses", () => {
    let m = 100;
    for (let i = 0; i < 20; i++) m = computeNewMastery(m, false);
    expect(m).toBeLessThan(5);
  });

  it("uses the configured MASTERY_ALPHA constant", () => {
    // Verify the constant is in a sensible range.
    expect(MASTERY_ALPHA).toBeGreaterThan(0);
    expect(MASTERY_ALPHA).toBeLessThan(1);
  });
});

describe("applyDecay", () => {
  it("does not decay if lastSessionAt is null", () => {
    expect(applyDecay(80, null)).toBe(80);
  });

  it("does not decay within 7 days", () => {
    const recent = new Date(Date.now() - 3 * 86_400_000);
    expect(applyDecay(80, recent)).toBe(80);
  });

  it("decays after 7 days", () => {
    const old = new Date(Date.now() - 10 * 86_400_000); // 10 days ago → 3 days past grace
    const result = applyDecay(80, old);
    expect(result).toBeLessThan(80);
  });

  it("caps decay at 50%", () => {
    const veryOld = new Date(Date.now() - 200 * 86_400_000);
    const result = applyDecay(80, veryOld);
    expect(result).toBeGreaterThanOrEqual(40); // 80 * 0.5 = 40
  });

  it("never goes below 0", () => {
    const veryOld = new Date(Date.now() - 200 * 86_400_000);
    expect(applyDecay(0, veryOld)).toBeGreaterThanOrEqual(0);
  });
});
