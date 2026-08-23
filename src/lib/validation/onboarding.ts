import { z } from "zod";

/**
 * Zod schemas + pure helpers for the onboarding wizard.
 *
 * Shape mirrors USER-FLOWS.md Flow 1 and DATABASE.md's tables. The client
 * wizard holds a superset (with clientIds for React keys) — the server
 * strips those away before validating, so the schema below is the canonical
 * "what we persist" contract.
 */

export const DAYS_OF_WEEK = [0, 1, 2, 3, 4, 5, 6] as const;
export const SESSION_LENGTHS = [25, 45, 60] as const;
export type SessionLength = (typeof SESSION_LENGTHS)[number];

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

export const SubjectDraftSchema = z.object({
  name: trimmedName(100, "Subject name"),
  examDate: DateString,
  topics: z
    .array(TopicDraftSchema)
    .min(1, "Add at least one topic per subject."),
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
  })
  .refine((o) => o.subjects.some((s) => s.examDate !== null), {
    message: "At least one subject needs an exam or target date.",
    path: ["subjects"],
  })
  .refine((o) => !hasOverlappingWindows(o.availability), {
    message: "Availability windows overlap on the same day.",
    path: ["availability"],
  });
export type OnboardingInput = z.infer<typeof OnboardingSchema>;
