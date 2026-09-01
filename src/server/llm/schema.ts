import { z } from "zod";

/**
 * LLM I/O contract for plan generation (API.md §"LLM I/O contract").
 *
 * The LLM returns `startsAt` as a local wall-clock string in the user's IANA
 * timezone (YYYY-MM-DDTHH:MM, no offset, no seconds). Naive local time keeps
 * the LLM's output stable across timezone offsets and DST transitions; the
 * server converts it to a UTC ISO string using the user's `time_zone` before
 * inserting to Postgres.
 */

const LocalDateTime = z
  .string()
  .regex(
    /^\d{4}-\d{2}-\d{2}T([01]\d|2[0-3]):[0-5]\d$/,
    "startsAt must be YYYY-MM-DDTHH:MM (local time, no offset).",
  );

export const PlanOutputSchema = z.object({
  // NOTE: sessions may legitimately be empty. When the constraints make it
  // impossible to fit even one session (e.g. an exam date that is today/past,
  // or windows shorter than the session length), the model correctly returns
  // an empty array. A `.min(1)` here caused the AI SDK to throw
  // AI_NoObjectGeneratedError on that valid response, which surfaced as the
  // opaque "We couldn't build a valid plan." Empty is handled explicitly in
  // generate.ts (returns a clear, actionable message) and blocked earlier by
  // the feasibility pre-check in validate.ts.
  sessions: z.array(
    z.object({
      startsAt: LocalDateTime,
      durationMinutes: z.number().int().positive().max(180),
      subjectName: z.string().trim().min(1).max(200),
      topicName: z.string().trim().min(1).max(200),
      instruction: z.string().trim().min(1).max(60),
    }),
  ),
  warnings: z
    .array(
      z.object({
        subjectName: z.string().trim().min(1).max(200),
        topicName: z.string().trim().min(1).max(200),
        message: z.string().trim().min(1).max(200),
      }),
    )
    .default([]),
});
export type PlanOutput = z.infer<typeof PlanOutputSchema>;
export type LlmSession = PlanOutput["sessions"][number];
export type LlmWarning = PlanOutput["warnings"][number];

/**
 * The shape the server feeds into the prompt builder + validator. We keep it
 * separate from OnboardingSchema so plan regeneration (Step 7) can call the
 * LLM with the same shape without going through the wizard.
 */
export type PlanInput = {
  timeZone: string;
  now: Date;
  sessionLengthMinutes: 25 | 45 | 60;
  subjects: Array<{
    id: string;
    name: string;
    examDate: string | null; // YYYY-MM-DD
    topics: Array<{ id: string; name: string }>;
  }>;
  availability: Array<{
    dayOfWeek: number; // 0..6
    startsAt: string; // HH:MM
    endsAt: string; // HH:MM
  }>;
  completedSessions?: Array<{
    subjectName: string;
    topicName: string;
    startsAt: string; // ISO
    durationMinutes: number;
  }>;
  /** Upcoming homework / assignments / quizzes / exams from subject_tasks. */
  tasks?: Array<{
    title: string;
    taskType: string; // homework | assignment | project | quiz | exam | other
    subjectName: string;
    dueDate: string | null; // YYYY-MM-DD
    priority: "low" | "medium" | "high";
  }>;
  profile?: {
    ageGroup?: "younger" | "older" | "adult"; // from old questionnaire
    ageBand?: string; // from new onboarding wizard (junior|intermediate|senior|university|adult)
    topTechnique?: string; // TechniqueKey or first study habit
    studyHabits?: string[];
    studyChallenges?: string[];
    goalRanking?: string[];
    memoryScore?: number; // 0-100
    subjectIntelligence?: Array<{
      subjectName: string;
      difficulty?: "easy" | "medium" | "hard";
      confidencePct?: number; // 0-100
    }>;
  };
};
