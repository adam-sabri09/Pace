import { z } from "zod";

export const AddSubjectSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Subject name is required.")
    .max(100, "Subject name is too long."),
  examDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD.")
    .nullable(),
  topics: z.array(z.string().trim().min(1).max(200)).default([]),
  difficulty: z.enum(["easy", "medium", "hard"]).nullable(),
  confidencePct: z.number().int().min(0).max(100).nullable(),
});

export type AddSubjectInput = z.infer<typeof AddSubjectSchema>;
