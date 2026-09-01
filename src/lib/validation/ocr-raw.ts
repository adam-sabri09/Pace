import { z } from "zod";

// Schema for the raw JSON returned by generateObject in the OCR action.
// Must be permissive about what the model returns:
//
// - topics: Gemini returns null (not []) when no topics are visible in the
//   schedule. z.array().default([]) only fills undefined — it does not handle
//   null — so we accept null and normalise to [] via transform.
// - examDate: already nullable; the model returns null when no date is found.
export const OcrRawSchema = z.object({
  // Gemini can return null for subjects when no schedule content is found.
  // z.array() alone rejects null, so we accept null and normalise to [].
  subjects: z
    .array(
      z.object({
        name: z.string(),
        examDate: z.string().nullable().default(null),
        topics: z
          .array(z.string())
          .nullable()
          .default([])
          .transform((v) => v ?? []),
      }),
    )
    .nullable()
    .default([])
    .transform((v) => v ?? []),
});

export type OcrRaw = z.infer<typeof OcrRawSchema>;
