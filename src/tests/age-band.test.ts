/**
 * Regression tests for Part 2 — age-band visual + experience personalization.
 *
 * Verifies that the centralized config resolves correctly for all five bands
 * and that every differentiation axis holds across the Junior → Adult spectrum.
 * CSS variable overrides in globals.css are intentionally NOT tested here —
 * they are presentation-layer CSS, not JS logic.
 */

import { describe, expect, it } from "vitest";
import { AGE_BAND_UI, getAgeBandUI, type AgeBand } from "@/lib/personalization/age-band";

const ALL_BANDS: AgeBand[] = ["junior", "intermediate", "senior", "university", "adult"];

// ---------------------------------------------------------------------------
// 1. Every band resolves without throwing and has the required shape
// ---------------------------------------------------------------------------

describe("AGE_BAND_UI — all bands resolve with valid shape", () => {
  it.each(ALL_BANDS)("%s resolves to a complete config", (band) => {
    const config = getAgeBandUI(band);
    expect(config).toBeDefined();
    // Messaging
    expect(typeof config.greeting("Alex")).toBe("string");
    expect(config.greeting("Alex").length).toBeGreaterThan(0);
    expect(config.sessionCompleteMessage).toBeTruthy();
    expect(config.sessionCompleteSubtitle).toBeTruthy();
    expect(config.welcomeBack).toBeTruthy();
    // Today states
    expect(config.allDoneTitle).toBeTruthy();
    expect(config.allDoneBody).toBeTruthy();
    expect(config.freeDayTitle).toBeTruthy();
    expect(config.freeDayBody).toBeTruthy();
    expect(config.noSubjectsTitle).toBeTruthy();
    expect(config.noSubjectsBody).toBeTruthy();
    expect(config.noSubjectsCta).toBeTruthy();
    // Subjects page
    expect(config.subjectsEmptyTitle).toBeTruthy();
    expect(config.subjectsEmptyBody).toBeTruthy();
    // Density + gamification
    expect(["simple", "standard", "dense"]).toContain(config.uiDensity);
    expect(["prominent", "standard", "subtle"]).toContain(config.gamification);
    expect(typeof config.streakMinForBadge).toBe("number");
    expect(config.streakMinForBadge).toBeGreaterThanOrEqual(1);
    expect(typeof config.showDailyProgress).toBe("boolean");
    expect(typeof config.showStreakMilestone).toBe("boolean");
    expect(["high", "medium", "low", "minimal"]).toContain(config.celebrationIntensity);
    // Animation + experience
    expect(["high", "medium", "low", "none"]).toContain(config.animationIntensity);
    expect(["confetti", "sparkle", "pulse", "subtle", "none"]).toContain(config.celebrationStyle);
    expect(["fire-animated", "energetic", "standard", "quiet"]).toContain(config.streakBadgeStyle);
    expect(["bouncy", "smooth", "static"]).toContain(config.progressBarStyle);
    expect(["illustrated-playful", "illustrated-modern", "icon-clean", "minimal"]).toContain(config.emptyStateStyle);
    expect(typeof config.showMascot).toBe("boolean");
    expect(["rich", "moderate", "subtle", "minimal"]).toContain(config.microInteractionLevel);
  });
});

// ---------------------------------------------------------------------------
// 2. Density spectrum
// ---------------------------------------------------------------------------

describe("AGE_BAND_UI — density spectrum", () => {
  it("junior has 'simple' density", () => {
    expect(AGE_BAND_UI.junior.uiDensity).toBe("simple");
  });
  it("adult has 'dense' density", () => {
    expect(AGE_BAND_UI.adult.uiDensity).toBe("dense");
  });
  it("university has 'dense' density", () => {
    expect(AGE_BAND_UI.university.uiDensity).toBe("dense");
  });
  it("senior has 'standard' density", () => {
    expect(AGE_BAND_UI.senior.uiDensity).toBe("standard");
  });
});

// ---------------------------------------------------------------------------
// 3. Gamification spectrum
// ---------------------------------------------------------------------------

describe("AGE_BAND_UI — gamification spectrum", () => {
  it("junior has 'prominent' gamification", () => {
    expect(AGE_BAND_UI.junior.gamification).toBe("prominent");
  });
  it("intermediate has 'standard' gamification", () => {
    expect(AGE_BAND_UI.intermediate.gamification).toBe("standard");
  });
  it("senior has 'standard' gamification", () => {
    expect(AGE_BAND_UI.senior.gamification).toBe("standard");
  });
  it("university has 'subtle' gamification", () => {
    expect(AGE_BAND_UI.university.gamification).toBe("subtle");
  });
  it("adult has 'subtle' gamification", () => {
    expect(AGE_BAND_UI.adult.gamification).toBe("subtle");
  });
});

// ---------------------------------------------------------------------------
// 4. Streak badge threshold
// ---------------------------------------------------------------------------

describe("AGE_BAND_UI — streak badge threshold", () => {
  it("junior shows streak badge from day 1", () => {
    expect(AGE_BAND_UI.junior.streakMinForBadge).toBe(1);
  });
  it("intermediate requires a real streak (>= 2)", () => {
    expect(AGE_BAND_UI.intermediate.streakMinForBadge).toBeGreaterThanOrEqual(2);
  });
  it("senior requires a real streak (>= 2)", () => {
    expect(AGE_BAND_UI.senior.streakMinForBadge).toBeGreaterThanOrEqual(2);
  });
  it("university has a higher threshold than junior", () => {
    expect(AGE_BAND_UI.university.streakMinForBadge).toBeGreaterThan(
      AGE_BAND_UI.junior.streakMinForBadge,
    );
  });
  it("adult has a higher threshold than junior", () => {
    expect(AGE_BAND_UI.adult.streakMinForBadge).toBeGreaterThan(
      AGE_BAND_UI.junior.streakMinForBadge,
    );
  });
});

// ---------------------------------------------------------------------------
// 5. Greeting distinctness
// ---------------------------------------------------------------------------

describe("AGE_BAND_UI — greeting distinctness", () => {
  it("each band produces a distinct greeting for the same name", () => {
    const greetings = ALL_BANDS.map((b) => AGE_BAND_UI[b].greeting("Sam"));
    const unique = new Set(greetings);
    expect(unique.size).toBe(ALL_BANDS.length);
  });
});

// ---------------------------------------------------------------------------
// 6. Fallback behaviour
// ---------------------------------------------------------------------------

describe("getAgeBandUI — fallback behaviour", () => {
  it("returns senior config for null", () => {
    expect(getAgeBandUI(null)).toBe(AGE_BAND_UI.senior);
  });
  it("returns senior config for undefined", () => {
    expect(getAgeBandUI(undefined)).toBe(AGE_BAND_UI.senior);
  });
  it("returns senior config for an unrecognised string", () => {
    expect(getAgeBandUI("graduate")).toBe(AGE_BAND_UI.senior);
  });
  it("returns the exact config object for a known band", () => {
    expect(getAgeBandUI("junior")).toBe(AGE_BAND_UI.junior);
    expect(getAgeBandUI("adult")).toBe(AGE_BAND_UI.adult);
  });
});

// ---------------------------------------------------------------------------
// 7. Celebration intensity
// ---------------------------------------------------------------------------

describe("AGE_BAND_UI — celebration intensity", () => {
  it("junior has 'high' celebration", () => {
    expect(AGE_BAND_UI.junior.celebrationIntensity).toBe("high");
  });
  it("intermediate has 'medium' celebration", () => {
    expect(AGE_BAND_UI.intermediate.celebrationIntensity).toBe("medium");
  });
  it("university has 'minimal' celebration", () => {
    expect(AGE_BAND_UI.university.celebrationIntensity).toBe("minimal");
  });
  it("adult has 'minimal' celebration", () => {
    expect(AGE_BAND_UI.adult.celebrationIntensity).toBe("minimal");
  });
  it("junior is more celebratory than adult", () => {
    const order = ["minimal", "low", "medium", "high"] as const;
    const juniorRank = order.indexOf(AGE_BAND_UI.junior.celebrationIntensity);
    const adultRank = order.indexOf(AGE_BAND_UI.adult.celebrationIntensity);
    expect(juniorRank).toBeGreaterThan(adultRank);
  });
});

// ---------------------------------------------------------------------------
// 8. Daily progress + streak milestone flags
// ---------------------------------------------------------------------------

describe("AGE_BAND_UI — progress and milestone flags", () => {
  it("junior shows daily progress bar", () => {
    expect(AGE_BAND_UI.junior.showDailyProgress).toBe(true);
  });
  it("intermediate shows daily progress bar", () => {
    expect(AGE_BAND_UI.intermediate.showDailyProgress).toBe(true);
  });
  it("senior does not show daily progress bar", () => {
    expect(AGE_BAND_UI.senior.showDailyProgress).toBe(false);
  });
  it("university does not show daily progress bar", () => {
    expect(AGE_BAND_UI.university.showDailyProgress).toBe(false);
  });
  it("adult does not show daily progress bar", () => {
    expect(AGE_BAND_UI.adult.showDailyProgress).toBe(false);
  });
  it("junior shows streak milestones", () => {
    expect(AGE_BAND_UI.junior.showStreakMilestone).toBe(true);
  });
  it("intermediate shows streak milestones", () => {
    expect(AGE_BAND_UI.intermediate.showStreakMilestone).toBe(true);
  });
  it("senior does not show streak milestones", () => {
    expect(AGE_BAND_UI.senior.showStreakMilestone).toBe(false);
  });
  it("university does not show streak milestones", () => {
    expect(AGE_BAND_UI.university.showStreakMilestone).toBe(false);
  });
  it("adult does not show streak milestones", () => {
    expect(AGE_BAND_UI.adult.showStreakMilestone).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 9. State text distinctness
// ---------------------------------------------------------------------------

describe("AGE_BAND_UI — today-page state text distinctness", () => {
  it("allDoneTitle is distinct across bands", () => {
    const titles = ALL_BANDS.map((b) => AGE_BAND_UI[b].allDoneTitle);
    expect(new Set(titles).size).toBeGreaterThan(2);
  });
  it("freeDayTitle varies between junior and adult", () => {
    expect(AGE_BAND_UI.junior.freeDayTitle).not.toBe(AGE_BAND_UI.adult.freeDayTitle);
  });
  it("noSubjectsTitle varies between junior and university", () => {
    expect(AGE_BAND_UI.junior.noSubjectsTitle).not.toBe(AGE_BAND_UI.university.noSubjectsTitle);
  });
  it("noSubjectsCta is provided for all bands", () => {
    ALL_BANDS.forEach((b) => {
      expect(AGE_BAND_UI[b].noSubjectsCta.length).toBeGreaterThan(0);
    });
  });
});

// ---------------------------------------------------------------------------
// 10. Animation intensity spectrum
// ---------------------------------------------------------------------------

describe("AGE_BAND_UI — animation intensity spectrum", () => {
  it("junior has 'high' animation intensity", () => {
    expect(AGE_BAND_UI.junior.animationIntensity).toBe("high");
  });
  it("intermediate has 'medium' animation intensity", () => {
    expect(AGE_BAND_UI.intermediate.animationIntensity).toBe("medium");
  });
  it("senior has 'low' animation intensity", () => {
    expect(AGE_BAND_UI.senior.animationIntensity).toBe("low");
  });
  it("university has 'none' animation intensity", () => {
    expect(AGE_BAND_UI.university.animationIntensity).toBe("none");
  });
  it("adult has 'none' animation intensity", () => {
    expect(AGE_BAND_UI.adult.animationIntensity).toBe("none");
  });
  it("junior is more animated than adult", () => {
    const order = ["none", "low", "medium", "high"] as const;
    const juniorRank = order.indexOf(AGE_BAND_UI.junior.animationIntensity);
    const adultRank = order.indexOf(AGE_BAND_UI.adult.animationIntensity);
    expect(juniorRank).toBeGreaterThan(adultRank);
  });
});

// ---------------------------------------------------------------------------
// 11. Celebration style spectrum
// ---------------------------------------------------------------------------

describe("AGE_BAND_UI — celebration style", () => {
  it("junior uses confetti celebration", () => {
    expect(AGE_BAND_UI.junior.celebrationStyle).toBe("confetti");
  });
  it("intermediate uses sparkle celebration", () => {
    expect(AGE_BAND_UI.intermediate.celebrationStyle).toBe("sparkle");
  });
  it("adult uses no celebration effect", () => {
    expect(AGE_BAND_UI.adult.celebrationStyle).toBe("none");
  });
  it("every band has a valid celebration style", () => {
    const valid = ["confetti", "sparkle", "pulse", "subtle", "none"];
    ALL_BANDS.forEach((b) => {
      expect(valid).toContain(AGE_BAND_UI[b].celebrationStyle);
    });
  });
});

// ---------------------------------------------------------------------------
// 12. Progress bar style
// ---------------------------------------------------------------------------

describe("AGE_BAND_UI — progress bar style", () => {
  it("junior has bouncy progress bar", () => {
    expect(AGE_BAND_UI.junior.progressBarStyle).toBe("bouncy");
  });
  it("intermediate has smooth progress bar", () => {
    expect(AGE_BAND_UI.intermediate.progressBarStyle).toBe("smooth");
  });
  it("senior has static progress bar", () => {
    expect(AGE_BAND_UI.senior.progressBarStyle).toBe("static");
  });
  it("university has static progress bar", () => {
    expect(AGE_BAND_UI.university.progressBarStyle).toBe("static");
  });
  it("adult has static progress bar", () => {
    expect(AGE_BAND_UI.adult.progressBarStyle).toBe("static");
  });
});

// ---------------------------------------------------------------------------
// 13. Empty state style
// ---------------------------------------------------------------------------

describe("AGE_BAND_UI — empty state style", () => {
  it("junior uses illustrated-playful empty states", () => {
    expect(AGE_BAND_UI.junior.emptyStateStyle).toBe("illustrated-playful");
  });
  it("intermediate uses illustrated-modern empty states", () => {
    expect(AGE_BAND_UI.intermediate.emptyStateStyle).toBe("illustrated-modern");
  });
  it("senior uses icon-clean empty states", () => {
    expect(AGE_BAND_UI.senior.emptyStateStyle).toBe("icon-clean");
  });
  it("university uses minimal empty states", () => {
    expect(AGE_BAND_UI.university.emptyStateStyle).toBe("minimal");
  });
  it("adult uses minimal empty states", () => {
    expect(AGE_BAND_UI.adult.emptyStateStyle).toBe("minimal");
  });
});

// ---------------------------------------------------------------------------
// 14. Mascot flag
// ---------------------------------------------------------------------------

describe("AGE_BAND_UI — mascot flag", () => {
  it("junior shows mascot", () => {
    expect(AGE_BAND_UI.junior.showMascot).toBe(true);
  });
  it("intermediate does not show mascot", () => {
    expect(AGE_BAND_UI.intermediate.showMascot).toBe(false);
  });
  it("senior does not show mascot", () => {
    expect(AGE_BAND_UI.senior.showMascot).toBe(false);
  });
  it("university does not show mascot", () => {
    expect(AGE_BAND_UI.university.showMascot).toBe(false);
  });
  it("adult does not show mascot", () => {
    expect(AGE_BAND_UI.adult.showMascot).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 15. Micro-interaction level spectrum
// ---------------------------------------------------------------------------

describe("AGE_BAND_UI — micro-interaction level", () => {
  it("junior has 'rich' micro-interactions", () => {
    expect(AGE_BAND_UI.junior.microInteractionLevel).toBe("rich");
  });
  it("intermediate has 'moderate' micro-interactions", () => {
    expect(AGE_BAND_UI.intermediate.microInteractionLevel).toBe("moderate");
  });
  it("senior has 'subtle' micro-interactions", () => {
    expect(AGE_BAND_UI.senior.microInteractionLevel).toBe("subtle");
  });
  it("university has 'minimal' micro-interactions", () => {
    expect(AGE_BAND_UI.university.microInteractionLevel).toBe("minimal");
  });
  it("adult has 'minimal' micro-interactions", () => {
    expect(AGE_BAND_UI.adult.microInteractionLevel).toBe("minimal");
  });
  it("junior is richer than adult", () => {
    const order = ["minimal", "subtle", "moderate", "rich"] as const;
    const jRank = order.indexOf(AGE_BAND_UI.junior.microInteractionLevel);
    const aRank = order.indexOf(AGE_BAND_UI.adult.microInteractionLevel);
    expect(jRank).toBeGreaterThan(aRank);
  });
});

// ---------------------------------------------------------------------------
// 16. Streak badge style
// ---------------------------------------------------------------------------

describe("AGE_BAND_UI — streak badge style", () => {
  it("junior has fire-animated streak badge", () => {
    expect(AGE_BAND_UI.junior.streakBadgeStyle).toBe("fire-animated");
  });
  it("intermediate has energetic streak badge", () => {
    expect(AGE_BAND_UI.intermediate.streakBadgeStyle).toBe("energetic");
  });
  it("university has quiet streak badge", () => {
    expect(AGE_BAND_UI.university.streakBadgeStyle).toBe("quiet");
  });
  it("adult has quiet streak badge", () => {
    expect(AGE_BAND_UI.adult.streakBadgeStyle).toBe("quiet");
  });
});
