import { z } from "zod";

/**
 * Zod schemas + pure helpers for the onboarding wizard.
 *
 * Shape mirrors USER-FLOWS.md Flow 1 and DATABASE.md's tables. The client
 * wizard holds a superset (with clientIds for React keys) — the server
 * strips those away before validating, so the schema below is the canonical
 * "what we persist" contract.
 *
 * New optional fields added in 0004_extended_onboarding.sql are all nullable /
 * optional so existing rows and existing test payloads continue to work.
 */

export const DAYS_OF_WEEK = [0, 1, 2, 3, 4, 5, 6] as const;
export const SESSION_LENGTHS = [25, 45, 60] as const;
export type SessionLength = (typeof SESSION_LENGTHS)[number];

export const AGE_BANDS = [
  "junior",
  "intermediate",
  "senior",
  "university",
  "adult",
] as const;
export type AgeBand = (typeof AGE_BANDS)[number];

export const AGE_BAND_LABELS: Record<AgeBand, string> = {
  junior: "Junior (11–13)",
  intermediate: "Intermediate (14–15)",
  senior: "Senior (16–18)",
  university: "University (18–24)",
  adult: "Adult (24+)",
};

export const DIFFICULTY_LEVELS = ["easy", "medium", "hard"] as const;
export type DifficultyLevel = (typeof DIFFICULTY_LEVELS)[number];

export const STUDY_HABITS = [
  { key: "flashcards", label: "Flashcards" },
  { key: "reading", label: "Reading" },
  { key: "practice_questions", label: "Practice questions" },
  { key: "videos", label: "Videos" },
  { key: "notes", label: "Notes" },
  { key: "group_study", label: "Group study" },
  { key: "other", label: "Other" },
  { key: "none", label: "I don't currently use a study method" },
] as const;

export const CHALLENGES = [
  { key: "focus", label: "Staying focused" },
  { key: "memory", label: "Remembering what I study" },
  { key: "understanding", label: "Understanding difficult topics" },
  { key: "starting", label: "Starting my work" },
  { key: "time", label: "Managing my time" },
  { key: "motivation", label: "Staying motivated" },
  { key: "homework", label: "Keeping up with homework" },
  { key: "exams", label: "Preparing for exams" },
  { key: "other", label: "Other" },
] as const;

export const GOALS = [
  "Improve my grades",
  "Pass my exams",
  "Improve my focus",
  "Build better study habits",
  "Manage my time better",
  "Get help from an AI coach",
] as const;

const TimeString = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Times must be HH:MM.");
const DateString = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Dates must be YYYY-MM-DD.")
  .nullable();

const trimmedName = (max: number, label: string) =>
  z
    .string({ error: `${label} is required.` })
    .trim()
    .min(1, `${label} is required.`)
    .max(max, `${label} is too long.`);

export const TopicDraftSchema = z.object({
  name: trimmedName(200, "Topic name"),
});
export type TopicDraft = z.infer<typeof TopicDraftSchema>;

export const TASK_TYPES = [
  { key: "homework", label: "Homework" },
  { key: "assignment", label: "Assignment" },
  { key: "project", label: "Project" },
  { key: "quiz", label: "Quiz/Test" },
  { key: "exam", label: "Exam" },
  { key: "other", label: "Other" },
] as const;

export const TASK_FREQUENCIES = [
  { key: "daily", label: "Daily" },
  { key: "few_per_week", label: "3×/week" },
  { key: "weekly", label: "Weekly" },
  { key: "monthly", label: "Monthly" },
  { key: "once", label: "Once" },
] as const;

export type TaskType = (typeof TASK_TYPES)[number]["key"];
export type TaskFrequency = (typeof TASK_FREQUENCIES)[number]["key"];

export const WorkloadItemDraftSchema = z.object({
  taskType: z.enum(["homework", "assignment", "project", "quiz", "exam", "other"]),
  dueDate: DateString,
  frequency: z.enum(["daily", "few_per_week", "weekly", "monthly", "once"]).nullable().optional(),
  priority: z.enum(["low", "medium", "high"]).default("medium"),
});

export type WorkloadItemDraft = z.infer<typeof WorkloadItemDraftSchema>;

export const SubjectDraftSchema = z.object({
  name: trimmedName(100, "Subject name"),
  examDate: DateString,
  topics: z
    .array(TopicDraftSchema)
    .min(1, "Add at least one topic per subject."),
  // Optional — collected during onboarding step 2.
  difficulty: z.enum(["easy", "medium", "hard"]).nullable().optional(),
  confidencePct: z.number().int().min(0).max(100).nullable().optional(),
  workloadItems: z.array(WorkloadItemDraftSchema).optional().default([]),
});
export type SubjectDraft = z.infer<typeof SubjectDraftSchema>;

export const AvailabilityWindowSchema = z
  .object({
    dayOfWeek: z.number().int().min(0).max(6),
    startsAt: TimeString,
    endsAt: TimeString,
  })
  .refine((w) => w.endsAt > w.startsAt, {
    message: "Each availability window must end after it starts.",
    path: ["endsAt"],
  });
export type AvailabilityWindowDraft = z.infer<typeof AvailabilityWindowSchema>;

/**
 * Pure overlap detector for availability windows within a single day.
 * Exported so the client wizard and the server action both use the same
 * definition of "overlap".
 */
export function hasOverlappingWindows(
  windows: readonly AvailabilityWindowDraft[],
): boolean {
  const byDay = new Map<number, AvailabilityWindowDraft[]>();
  for (const w of windows) {
    const list = byDay.get(w.dayOfWeek);
    if (list) list.push(w);
    else byDay.set(w.dayOfWeek, [w]);
  }
  for (const list of byDay.values()) {
    const sorted = [...list].sort((a, b) => a.startsAt.localeCompare(b.startsAt));
    for (let i = 1; i < sorted.length; i++) {
      if (sorted[i].startsAt < sorted[i - 1].endsAt) return true;
    }
  }
  return false;
}

export const OnboardingSchema = z
  .object({
    subjects: z
      .array(SubjectDraftSchema)
      .min(1, "Add at least one subject."),
    availability: z
      .array(AvailabilityWindowSchema)
      .min(1, "Add at least one availability window."),
    sessionLengthMinutes: z.union([
      z.literal(25),
      z.literal(45),
      z.literal(60),
    ]),
    // Extended fields — all optional so existing data and tests remain valid.
    ageBand: z.enum(["junior", "intermediate", "senior", "university", "adult"]).nullable().optional(),
    studyHabits: z.array(z.string()).optional(),
    biggestChallenge: z.string().nullable().optional(),
    studyChallenges: z.array(z.string()).optional(),
    goalRanking: z.array(z.string()).optional(),
    memoryScore: z.number().int().min(0).max(100).nullable().optional(),
  })
  .refine((o) => !hasOverlappingWindows(o.availability), {
    message: "Availability windows overlap on the same day.",
    path: ["availability"],
  });
export type OnboardingInput = z.infer<typeof OnboardingSchema>;
