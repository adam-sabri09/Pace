"use server";

import "server-only";

import { z } from "zod";
import { google } from "@ai-sdk/google";
import { generateObject } from "ai";

import { createClient } from "@/lib/supabase/server";
import { ConfirmedOcrSubjectsSchema } from "@/lib/validation/personalization";
import { rePlanForUser } from "./plan";

// Max 5 MB to keep LLM costs manageable.
const MAX_FILE_BYTES = 5 * 1024 * 1024;

const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "application/pdf",
]);

const OcrRawSchema = z.object({
  subjects: z.array(
    z.object({
      name: z.string(),
      examDate: z.string().nullable().default(null),
      topics: z.array(z.string()).default([]),
    }),
  ),
});

export type OcrExtracted = {
  subjects: Array<{
    name: string;
    examDate: string | null;
    topics: string[];
  }>;
};

export type OcrResult =
  | { ok: true; extracted: OcrExtracted }
  | { ok: false; error: string };

export async function extractScheduleAction(formData: FormData): Promise<OcrResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "You need to be signed in." };

  const file = formData.get("schedule") as File | null;
  if (!file || file.size === 0) {
    return { ok: false, error: "Please select an image or PDF to upload." };
  }
  if (file.size > MAX_FILE_BYTES) {
    return { ok: false, error: "File is too large. Maximum size is 5 MB." };
  }
  if (!ALLOWED_MIME_TYPES.has(file.type)) {
    return {
      ok: false,
      error: "Unsupported file type. Please upload a JPEG, PNG, WebP, GIF, or PDF.",
    };
  }

  const bytes = await file.arrayBuffer();
  const buffer = new Uint8Array(bytes);

  try {
    const model = google("gemini-2.0-flash");
    const { object } = await generateObject({
      model,
      schema: OcrRawSchema,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              image: buffer,
              mediaType: file.type as "image/jpeg" | "image/png" | "image/webp" | "image/gif" | "application/pdf",
            },
            {
              type: "text",
              text: buildOcrPrompt(),
            },
          ],
        },
      ],
    });

    return {
      ok: true,
      extracted: {
        subjects: object.subjects.map((s) => ({
          name: s.name.trim(),
          examDate: s.examDate?.match(/^\d{4}-\d{2}-\d{2}$/) ? s.examDate : null,
          topics: s.topics.map((t) => t.trim()).filter((t) => t.length > 0),
        })),
      },
    };
  } catch {
    return {
      ok: false,
      error: "Could not extract subjects from the image. Try a clearer photo.",
    };
  }
}

function buildOcrPrompt(): string {
  const thisYear = new Date().getFullYear();
  return `Extract study schedule information from this image.

Look for:
1. Subject or course names (e.g. "Mathematics", "Biology", "English Literature", "History")
2. Exam dates or assessment dates for each subject (format as YYYY-MM-DD)
3. Topics, units, or chapters listed under each subject (if visible)

Rules:
- Only extract what is actually visible in the image. Never invent content.
- Format all dates as YYYY-MM-DD. If the year is not shown, assume ${thisYear} or ${thisYear + 1} (whichever is in the future).
- If no exam dates are visible, set examDate to null.
- If no topics are visible, leave the topics array empty.
- Return an empty subjects array if you cannot find any subject names.
- Keep subject names concise and standard (e.g. "Chemistry" not "Mrs Smith's Chemistry Group 4B").`;
}

// ---------------------------------------------------------------------------
// Save OCR-confirmed subjects — replaces existing subjects + triggers replan
// ---------------------------------------------------------------------------

export type SaveOcrResult =
  | { ok: true }
  | { ok: false; error: string };

export async function saveOcrSubjectsAction(raw: unknown): Promise<SaveOcrResult> {
  const parsed = ConfirmedOcrSubjectsSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message };
  }
  const subjects = parsed.data;

  if (subjects.length === 0) {
    return { ok: false, error: "Add at least one subject." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "You need to be signed in." };

  // Verify user is onboarded (active plan must exist for re-plan to work).
  const { data: profile } = await supabase
    .from("profiles")
    .select("session_length_minutes")
    .eq("id", user.id)
    .maybeSingle();
  if (profile?.session_length_minutes == null) {
    return { ok: false, error: "Complete onboarding first." };
  }

  // Replace all subjects (topics cascade via FK).
  const { error: delErr } = await supabase
    .from("subjects")
    .delete()
    .eq("user_id", user.id);
  if (delErr) return { ok: false, error: "Could not reset your subjects. Try again." };

  // Insert new subjects one at a time (same pattern as commitOnboardingAction).
  const subjectIds: string[] = [];
  for (const s of subjects) {
    const { data, error } = await supabase
      .from("subjects")
      .insert({
        user_id: user.id,
        name: s.name,
        exam_date: s.examDate,
        difficulty: s.difficulty,
        confidence_pct: s.confidencePct,
      })
      .select("id")
      .single();
    if (error || !data) {
      await supabase.from("subjects").delete().eq("user_id", user.id);
      return { ok: false, error: "Could not save your subjects." };
    }
    subjectIds.push(data.id as string);
  }

  // Insert topics.
  const topicsPayload = subjects.flatMap((s, i) =>
    s.topics.map((name) => ({
      user_id: user.id,
      subject_id: subjectIds[i],
      name,
    })),
  );
  if (topicsPayload.length > 0) {
    const { error } = await supabase.from("topics").insert(topicsPayload);
    if (error) {
      await supabase.from("subjects").delete().eq("user_id", user.id);
      return { ok: false, error: "Could not save your topics." };
    }
  }

  // Regenerate the plan with the new subjects.
  const replanResult = await rePlanForUser(supabase, user.id);
  if (!replanResult.ok) {
    return { ok: false, error: replanResult.error };
  }

  return { ok: true };
}
