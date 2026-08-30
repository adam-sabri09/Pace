import { z } from "zod";

export const PersonalizationAnswersSchema = z.object({
  ageGroup: z.enum(["younger", "older", "adult"]),
  focusBand: z.enum(["short", "medium", "long", "very_long"]),
  studyHabit: z.enum(["passive", "note_taking", "active", "flashcards", "passive_media"]),
  studyChallenge: z.enum(["focus", "memory", "understanding", "prioritization"]),
  studyGoal: z.enum(["pass", "excel", "mastery", "habits"]),
  memoryRating: z.enum(["strong", "average", "weak", "very_weak"]),
});

export type PersonalizationAnswersInput = z.infer<typeof PersonalizationAnswersSchema>;

export const OcrSubjectSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Subject name is required.")
    .max(100, "Subject name is too long."),
  examDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Dates must be YYYY-MM-DD.")
    .nullable(),
  topics: z
    .array(
      z.object({ name: z.string().trim().min(1).max(200) }),
    )
    .min(1, "Add at least one topic per subject."),
  difficulty: z.enum(["easy", "medium", "hard"]).nullable().default(null),
  confidencePct: z.number().int().min(0).max(100).nullable().default(null),
});

export const OcrSubjectsSchema = z
  .array(OcrSubjectSchema)
  .min(1, "Add at least one subject.");

export type OcrSubjectInput = z.infer<typeof OcrSubjectSchema>;

// Schema for the confirmed OCR subjects submitted from the upload-schedule form.
// Topics are plain strings here (not objects) — the form edits them as strings.
export const ConfirmedOcrSubjectSchema = z.object({
  name: z.string().trim().min(1, "Subject name is required.").max(100, "Subject name is too long."),
  examDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD.").nullable(),
  topics: z.array(z.string().trim().min(1).max(200)).min(1, "Add at least one topic."),
  difficulty: z.enum(["easy", "medium", "hard"]).nullable(),
  confidencePct: z.number().int().min(0).max(100).nullable(),
});

export const ConfirmedOcrSubjectsSchema = z
  .array(ConfirmedOcrSubjectSchema)
  .min(1, "Add at least one subject.");

export type ConfirmedOcrSubjectInput = z.infer<typeof ConfirmedOcrSubjectSchema>;
