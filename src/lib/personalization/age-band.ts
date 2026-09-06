/**
 * UI configuration derived from the `age_band` column in profiles.
 * These values drive the full UX experience layer — tone, animation intensity,
 * illustration style, gamification, and micro-interaction level — without
 * touching any functional logic. Components read config values; they never
 * check the age band directly.
 */

export type AgeBand = 'junior' | 'intermediate' | 'senior' | 'university' | 'adult';

export interface AgeBandUIConfig {
  // ── Messaging ──────────────────────────────────────────────────────────────
  greeting: (name: string) => string;
  sessionCompleteMessage: string;
  sessionCompleteSubtitle: string;
  welcomeBack: string;

  // ── Today dashboard state copy ─────────────────────────────────────────────
  allDoneTitle: string;
  allDoneBody: string;
  freeDayTitle: string;
  freeDayBody: string;
  noSubjectsTitle: string;
  noSubjectsBody: string;
  noSubjectsCta: string;

  // ── Subjects page ──────────────────────────────────────────────────────────
  subjectsEmptyTitle: string;
  subjectsEmptyBody: string;

  // ── Density & gamification ─────────────────────────────────────────────────
  uiDensity: 'simple' | 'standard' | 'dense';
  gamification: 'prominent' | 'standard' | 'subtle';
  streakMinForBadge: number;
  showDailyProgress: boolean;
  showStreakMilestone: boolean;
  celebrationIntensity: 'high' | 'medium' | 'low' | 'minimal';

  // ── Animation & interaction experience ────────────────────────────────────
  /**
   * Overall animation budget.
   * high   — bouncy progress bars, popping badges, confetti bursts, hover lifts
   * medium — smooth entrances, energetic badge pop, sparkle burst, subtle hover
   * low    — minimal entrance fades, no confetti, very restrained hover
   * none   — no animation beyond browser defaults
   */
  animationIntensity: 'high' | 'medium' | 'low' | 'none';
  /**
   * Visual style for the session-completion celebration overlay.
   * confetti — full canvas confetti burst (junior)
   * sparkle  — CSS radial sparkle particles (intermediate)
   * pulse    — subtle icon entrance animation (senior)
   * subtle   — plain fade-in (university)
   * none     — no extra visual (adult)
   */
  celebrationStyle: 'confetti' | 'sparkle' | 'pulse' | 'subtle' | 'none';
  /**
   * How the streak badge is styled.
   * fire-animated — animated fire emoji + badge-pop entrance
   * energetic     — badge-pop entrance, no fire animation
   * standard      — badge-pop entrance for junior/intermediate, plain otherwise
   * quiet         — no entrance animation, small badge
   */
  streakBadgeStyle: 'fire-animated' | 'energetic' | 'standard' | 'quiet';
  /**
   * How the daily progress bar fills.
   * bouncy  — springy overshoot animation (junior)
   * smooth  — ease-out fill animation (intermediate)
   * static  — no animation, fills instantly (senior+)
   */
  progressBarStyle: 'bouncy' | 'smooth' | 'static';
  /**
   * Visual treatment for illustrated empty states.
   * illustrated-playful — SVG illustration (book + sparkles) for junior
   * illustrated-modern  — SVG illustration (stacked books) for intermediate
   * icon-clean          — material symbol, clean styling
   * minimal             — material symbol, subdued styling
   */
  emptyStateStyle: 'illustrated-playful' | 'illustrated-modern' | 'icon-clean' | 'minimal';
  /** Whether to render a mascot/character illustration in empty states. */
  showMascot: boolean;
  /**
   * Level of hover/tap micro-interactions on cards and buttons.
   * rich     — lift + scale on hover, springy transitions
   * moderate — subtle lift on hover, smooth transitions
   * subtle   — colour-only hover, no transform
   * minimal  — browser default only
   */
  microInteractionLevel: 'rich' | 'moderate' | 'subtle' | 'minimal';
}

export const AGE_BAND_UI: Record<AgeBand, AgeBandUIConfig> = {
  junior: {
    // Messaging
    greeting: (name) => `Hey ${name}, ready to study? 🎯`,
    sessionCompleteMessage: "Amazing work!",
    sessionCompleteSubtitle: "Session complete — you did it! Keep going!",
    welcomeBack: "Welcome back! You've got this.",
    // Today states
    allDoneTitle: "You did it! All done for today 🎉",
    allDoneBody: "Every session complete — that's what consistent studying looks like!",
    freeDayTitle: "Free day!",
    freeDayBody: "No sessions today — rest up, you've earned it. See you tomorrow!",
    noSubjectsTitle: "Let's get started!",
    noSubjectsBody: "Add your first subject and exam date. Pace will build a study plan and keep you on track.",
    noSubjectsCta: "Add my first subject",
    // Subjects
    subjectsEmptyTitle: "Add your first subject!",
    subjectsEmptyBody: "Use the form above to add a subject — Pace will build your study plan right away.",
    // Density
    uiDensity: "simple",
    gamification: "prominent",
    streakMinForBadge: 1,
    showDailyProgress: true,
    showStreakMilestone: true,
    celebrationIntensity: "high",
    // Animation & experience
    animationIntensity: "high",
    celebrationStyle: "confetti",
    streakBadgeStyle: "fire-animated",
    progressBarStyle: "bouncy",
    emptyStateStyle: "illustrated-playful",
    showMascot: true,
    microInteractionLevel: "rich",
  },

  intermediate: {
    greeting: (name) => `Hi ${name} — here's your plan for today.`,
    sessionCompleteMessage: "Great work!",
    sessionCompleteSubtitle: "Session complete. Nice effort.",
    welcomeBack: "Welcome back — stay focused.",
    allDoneTitle: "All done — great work today!",
    allDoneBody: "Every session completed. Tomorrow's plan is ready when you need it.",
    freeDayTitle: "Free day",
    freeDayBody: "No sessions scheduled today. Rest up, or use the time to review your notes.",
    noSubjectsTitle: "Start building your plan",
    noSubjectsBody: "Add your subjects and exam dates to generate your personalised study schedule.",
    noSubjectsCta: "Add subjects",
    subjectsEmptyTitle: "No subjects yet",
    subjectsEmptyBody: "Use the form above to add your first subject.",
    uiDensity: "standard",
    gamification: "standard",
    streakMinForBadge: 2,
    showDailyProgress: true,
    showStreakMilestone: true,
    celebrationIntensity: "medium",
    animationIntensity: "medium",
    celebrationStyle: "sparkle",
    streakBadgeStyle: "energetic",
    progressBarStyle: "smooth",
    emptyStateStyle: "illustrated-modern",
    showMascot: false,
    microInteractionLevel: "moderate",
  },

  senior: {
    greeting: (name) => `Good day, ${name}.`,
    sessionCompleteMessage: "Well done.",
    sessionCompleteSubtitle: "Session marked complete.",
    welcomeBack: "Welcome back. Let's continue.",
    allDoneTitle: "That's today done.",
    allDoneBody: "Every session completed. Tomorrow's plan is ready when you need it.",
    freeDayTitle: "Free day",
    freeDayBody: "No sessions scheduled today. Rest up — you've earned it.",
    noSubjectsTitle: "No study plan yet",
    noSubjectsBody: "Add your subjects and exam dates to generate your first plan.",
    noSubjectsCta: "Add subjects",
    subjectsEmptyTitle: "No subjects yet",
    subjectsEmptyBody: "Use the form above to add your first subject.",
    uiDensity: "standard",
    gamification: "standard",
    streakMinForBadge: 2,
    showDailyProgress: false,
    showStreakMilestone: false,
    celebrationIntensity: "low",
    animationIntensity: "low",
    celebrationStyle: "pulse",
    streakBadgeStyle: "standard",
    progressBarStyle: "static",
    emptyStateStyle: "icon-clean",
    showMascot: false,
    microInteractionLevel: "subtle",
  },

  university: {
    greeting: (name) => `${name} — here's your plan.`,
    sessionCompleteMessage: "Done.",
    sessionCompleteSubtitle: "Session marked complete. Keep it up.",
    welcomeBack: "Welcome back. Keep going.",
    allDoneTitle: "Complete.",
    allDoneBody: "All sessions done. Your next session is scheduled for tomorrow.",
    freeDayTitle: "No sessions today",
    freeDayBody: "Use the time to review, consolidate, or prepare for upcoming topics.",
    noSubjectsTitle: "No subjects added",
    noSubjectsBody: "Add subjects and exam dates to generate your study plan.",
    noSubjectsCta: "Add subjects",
    subjectsEmptyTitle: "No subjects yet",
    subjectsEmptyBody: "Add your first subject using the form above.",
    uiDensity: "dense",
    gamification: "subtle",
    streakMinForBadge: 3,
    showDailyProgress: false,
    showStreakMilestone: false,
    celebrationIntensity: "minimal",
    animationIntensity: "none",
    celebrationStyle: "subtle",
    streakBadgeStyle: "quiet",
    progressBarStyle: "static",
    emptyStateStyle: "minimal",
    showMascot: false,
    microInteractionLevel: "minimal",
  },

  adult: {
    greeting: (name) => `${name} — your plan for today.`,
    sessionCompleteMessage: "Session complete.",
    sessionCompleteSubtitle: "Progress recorded.",
    welcomeBack: "Welcome back.",
    allDoneTitle: "All sessions completed.",
    allDoneBody: "Your schedule for tomorrow is already in place.",
    freeDayTitle: "No sessions scheduled",
    freeDayBody: "Your next sessions are planned. Use this time as you see fit.",
    noSubjectsTitle: "No subjects added",
    noSubjectsBody: "Add subjects and exam dates to generate your study schedule.",
    noSubjectsCta: "Add subjects",
    subjectsEmptyTitle: "No subjects yet",
    subjectsEmptyBody: "Use the form above to add your first subject.",
    uiDensity: "dense",
    gamification: "subtle",
    streakMinForBadge: 3,
    showDailyProgress: false,
    showStreakMilestone: false,
    celebrationIntensity: "minimal",
    animationIntensity: "none",
    celebrationStyle: "none",
    streakBadgeStyle: "quiet",
    progressBarStyle: "static",
    emptyStateStyle: "minimal",
    showMascot: false,
    microInteractionLevel: "minimal",
  },
};

const DEFAULT_BAND: AgeBand = 'senior';

export function getAgeBandUI(ageBand: string | null | undefined): AgeBandUIConfig {
  return AGE_BAND_UI[(ageBand as AgeBand) ?? DEFAULT_BAND] ?? AGE_BAND_UI[DEFAULT_BAND];
}
