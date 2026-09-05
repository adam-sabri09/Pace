/**
 * UI configuration derived from the `age_band` column in profiles.
 * These values tune greeting tone, encouragement messages, and interface density
 * without changing any functionality — purely presentation-layer adaptation.
 */

export type AgeBand = 'junior' | 'intermediate' | 'senior' | 'university' | 'adult';

export interface AgeBandUIConfig {
  /** Personalised greeting for the Today dashboard. */
  greeting: (name: string) => string;
  /** Overlay text shown when a study session is marked complete. */
  sessionCompleteMessage: string;
  /** Short motivation line shown when the tab returns to focus. */
  welcomeBack: string;
  /** Subtitle on the completed session overlay. */
  sessionCompleteSubtitle: string;
}

export const AGE_BAND_UI: Record<AgeBand, AgeBandUIConfig> = {
  junior: {
    greeting: (name) => `Hey ${name}, ready to study?`,
    sessionCompleteMessage: "Amazing work!",
    sessionCompleteSubtitle: "Session complete — you did it!",
    welcomeBack: "Welcome back! You've got this.",
  },
  intermediate: {
    greeting: (name) => `Hi ${name} — here's your plan for today.`,
    sessionCompleteMessage: "Great work!",
    sessionCompleteSubtitle: "Session complete.",
    welcomeBack: "Welcome back — stay focused.",
  },
  senior: {
    greeting: (name) => `Good day, ${name}.`,
    sessionCompleteMessage: "Well done.",
    sessionCompleteSubtitle: "Session marked complete.",
    welcomeBack: "Welcome back. Let's continue.",
  },
  university: {
    greeting: (name) => `${name} — here's your plan.`,
    sessionCompleteMessage: "Done.",
    sessionCompleteSubtitle: "Session marked complete. Keep it up.",
    welcomeBack: "Welcome back. Keep going.",
  },
  adult: {
    greeting: (name) => `Good day, ${name}.`,
    sessionCompleteMessage: "Session complete.",
    sessionCompleteSubtitle: "Progress recorded.",
    welcomeBack: "Welcome back.",
  },
};

const DEFAULT_BAND: AgeBand = 'senior';

export function getAgeBandUI(ageBand: string | null | undefined): AgeBandUIConfig {
  return AGE_BAND_UI[(ageBand as AgeBand) ?? DEFAULT_BAND] ?? AGE_BAND_UI[DEFAULT_BAND];
}
