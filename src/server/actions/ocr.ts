"use server";

import "server-only";

import { google } from "@ai-sdk/google";
import { generateObject } from "ai";

import { createClient } from "@/lib/supabase/server";
import { logAppError } from "@/lib/errors/log-error";
import { ConfirmedOcrSubjectsSchema } from "@/lib/validation/personalization";
import { OcrRawSchema } from "@/lib/validation/ocr-raw";
import { rePlanForUser } from "./plan";

// Max 5 MB per upload to keep LLM costs manageable.
const MAX_FILE_BYTES = 5 * 1024 * 1024;

const EXT_MIME_MAP: Record<string, string> = {
  jpg: "image/jpeg", jpeg: "image/jpeg",
  png: "image/png", webp: "image/webp", gif: "image/gif",
  pdf: "application/pdf", txt: "text/plain",
};

/** Browsers don't always report file.type correctly (esp. PDFs on mobile). */
function resolveFileType(file: File): string {
  if (file.type && file.type !== "application/octet-stream") return file.type;
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  return EXT_MIME_MAP[ext] ?? file.type ?? "";
}

const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "application/pdf",
  "text/plain",
]);


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
    return { ok: false, error: "Please select a file to upload." };
  }
  if (file.size > MAX_FILE_BYTES) {
    return { ok: false, error: "File is too large. Maximum size is 5 MB." };
  }

  // Resolve MIME type — browsers don't always populate file.type correctly,
  // especially on mobile or for PDFs uploaded from some apps. Use the file
  // extension as a reliable fallback.
  const resolvedType = resolveFileType(file);
  if (!ALLOWED_MIME_TYPES.has(resolvedType)) {
    return {
      ok: false,
      error:
        `Unsupported file type${file.type ? ` (${file.type})` : ""}. Please upload a JPEG, PNG, WebP, GIF, PDF, or plain text file.`,
    };
  }

  const bytes = await file.arrayBuffer();
  const buffer = new Uint8Array(bytes);

  try {
    // Use gemini-3.6-flash — same model as plan generation, confirmed working.
    // gemini-2.0-flash is older and has edge-case differences with structured
    // output + multimodal content.
    const model = google("gemini-3.6-flash");

    // Build the content array based on file type.
    // All binary files (images and PDFs) use FilePart: { type:"file", data, mediaType }.
    // This is the current AI SDK v7 format. The deprecated ImagePart
    // ({ type:"image", image, mimeType }) is avoided because mimeType is
    // silently ignored in favour of mediaType, causing byte-sniffing to be
    // the only detection path, which can fail for some file variants.
    type ContentPart =
      | { type: "file"; data: Uint8Array; mediaType: string }
      | { type: "text"; text: string };

    const contentParts: ContentPart[] = [];

    if (resolvedType === "text/plain") {
      const decoded = new TextDecoder("utf-8").decode(buffer);
      contentParts.push({
        type: "text",
        text: `The following is a plain-text study schedule document. Extract the information as instructed.\n\n---\n${decoded}\n---`,
      });
    } else {
      // Images and PDFs: FilePart with explicit mediaType.
      contentParts.push({
        type: "file",
        data: buffer,
        mediaType: resolvedType,
      });
    }

    contentParts.push({ type: "text", text: buildOcrPrompt() });

    const { object } = await generateObject({
      model,
      schema: OcrRawSchema,
      messages: [{ role: "user", content: contentParts }],
      maxRetries: 0,
      abortSignal: AbortSignal.timeout(60_000),
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
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const errorName = e instanceof Error ? e.name : "Unknown";
    const cause = e instanceof Error && e.cause != null ? String(e.cause) : undefined;

    // Always log the real error server-side so it's visible in dev logs and app_errors.
    console.error("[upload_ocr] extraction failed:", errorName, msg, { cause, fileName: file.name, fileType: resolvedType });

    await logAppError(
      "upload_ocr",
      msg,
      {
        errorName,
        cause,
        fileName: file.name,
        fileType: resolvedType,
        fileSize: file.size,
      },
      user.id,
    );

    const lower = msg.toLowerCase();
    const isApiKey = lower.includes("api key") || lower.includes("authentication") || lower.includes("unauthorized");
    const isQuota = lower.includes("quota") || lower.includes("429") || lower.includes("rate limit") || lower.includes("resource_exhausted");
    const isValidation = lower.includes("zod") || lower.includes("validation") || lower.includes("parse") || errorName === "AI_TypeValidationError" || errorName === "AI_NoObjectGeneratedError";

    if (isApiKey) {
      return { ok: false, error: "AI service is not configured. Contact support." };
    }
    if (isQuota) {
      return {
        ok: false,
        error: "The AI service has reached its usage limit. Please try again in a few minutes.",
      };
    }
    if (isValidation) {
      return {
        ok: false,
        error:
          "Could not read a study schedule from this file. Make sure it clearly shows subject names, and try again.",
      };
    }
    return {
      ok: false,
      error: "Could not extract subjects from the file. Make sure the image or PDF is clear and try again.",
    };
  }
}

function buildOcrPrompt(): string {
  const thisYear = new Date().getFullYear();
  return `Extract study schedule information from this content.

Look for:
1. Subject or course names (e.g. "Mathematics", "Biology", "English Literature", "History")
2. Exam dates or assessment dates for each subject (format as YYYY-MM-DD)
3. Topics, units, or chapters listed under each subject (if visible)

Rules:
- Only extract what is actually present in the content. Never invent content.
- Format all dates as YYYY-MM-DD. If the year is not shown, assume ${thisYear} or ${thisYear + 1} (whichever is in the future).
- If no exam dates are visible, set examDate to null.
- If no topics are visible, leave the topics array empty.
- Return an empty subjects array if you cannot find any subject names.
- Keep subject names concise and standard (e.g. "Chemistry" not "Mrs Smith's Chemistry Group 4B").`;
}

// ---------------------------------------------------------------------------
// Save OCR-confirmed subjects — replaces existing subjects + triggers replan
// ---------------------------------------------------------------------------

export type SaveOcrResult = { ok: true } | { ok: false; error: string };

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
  if (delErr) {
    await logAppError("upload_save", delErr.message, { step: "delete_subjects" }, user.id);
    return { ok: false, error: "Could not reset your subjects. Try again." };
  }

  // Insert new subjects one at a time.
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
      const msg = error?.message ?? "no data returned";
      await logAppError("upload_save", msg, { step: "insert_subject", name: s.name }, user.id);
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
      await logAppError("upload_save", error.message, { step: "insert_topics" }, user.id);
      await supabase.from("subjects").delete().eq("user_id", user.id);
      return { ok: false, error: "Could not save your topics." };
    }
  }

  // Regenerate the plan with the new subjects.
  const replanResult = await rePlanForUser(supabase, user.id);
  if (!replanResult.ok) {
    await logAppError("replan", replanResult.error, { trigger: "upload_save" }, user.id);
    return { ok: false, error: replanResult.error };
  }

  return { ok: true };
}
