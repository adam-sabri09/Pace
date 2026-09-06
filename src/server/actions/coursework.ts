"use server";

import "server-only";

import { google } from "@ai-sdk/google";
import { generateObject } from "ai";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";
import { logAppError } from "@/lib/errors/log-error";

const MAX_FILE_BYTES = 5 * 1024 * 1024;

const EXT_MIME_MAP: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif",
  pdf: "application/pdf",
  txt: "text/plain",
};

const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "application/pdf",
  "text/plain",
]);

function resolveFileType(file: File): string {
  if (file.type && file.type !== "application/octet-stream") return file.type;
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  return EXT_MIME_MAP[ext] ?? file.type ?? "";
}

// ---------------------------------------------------------------------------
// Extraction schema
// ---------------------------------------------------------------------------

const CourseworkExtractedSchema = z.object({
  title: z.string().describe("Short descriptive title (e.g. 'Chapter 3 — Cell Biology')"),
  subjectName: z.string().describe("Academic subject (e.g. 'Biology', 'Mathematics')"),
  difficulty: z.enum(["easy", "medium", "hard"]),
  topics: z.array(
    z.object({
      name: z.string(),
      subtopics: z.array(z.string()),
      concepts: z.array(z.string()),
    }),
  ),
  definitions: z.array(z.object({ term: z.string(), definition: z.string() })),
  keyFacts: z.array(z.string()),
  relationships: z.array(
    z.object({ from: z.string(), to: z.string(), relationship: z.string() }),
  ),
});

export type CourseworkExtracted = z.infer<typeof CourseworkExtractedSchema>;

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export type CourseworkItem = {
  id: string;
  title: string;
  subjectName: string | null;
  fileType: string;
  status: "processing" | "ready" | "failed";
  extracted: CourseworkExtracted | null;
  createdAt: string;
};

export type UploadCourseworkResult =
  | { ok: true; item: CourseworkItem }
  | { ok: false; error: string };

// ---------------------------------------------------------------------------
// Upload + extraction
// ---------------------------------------------------------------------------

export async function uploadCourseworkAction(
  formData: FormData,
): Promise<UploadCourseworkResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "You need to be signed in." };

  const file = formData.get("coursework") as File | null;
  if (!file || file.size === 0) return { ok: false, error: "Please select a file." };
  if (file.size > MAX_FILE_BYTES) return { ok: false, error: "File too large — 5 MB maximum." };

  const resolvedType = resolveFileType(file);
  if (!ALLOWED_MIME_TYPES.has(resolvedType)) {
    return { ok: false, error: "Unsupported file type. Upload a JPEG, PNG, PDF, or text file." };
  }

  // Insert placeholder row immediately so the library shows "Processing…".
  const { data: itemRow, error: insertErr } = await supabase
    .from("coursework_items")
    .insert({
      user_id: user.id,
      title: file.name.replace(/\.[^.]+$/, ""),
      file_type: resolvedType.split("/")[1] ?? resolvedType,
      status: "processing",
    })
    .select("id")
    .single();

  if (insertErr || !itemRow) {
    const errMsg = insertErr?.message ?? "no data returned";
    console.error("[coursework] insert failed:", errMsg, "code:", insertErr?.code, "details:", insertErr?.details);
    await logAppError("coursework_upload", errMsg, { step: "insert_coursework_item", code: insertErr?.code, details: insertErr?.details }, user.id);
    return { ok: false, error: "Could not create entry. Try again." };
  }
  const itemId = itemRow.id as string;

  const bytes = await file.arrayBuffer();
  const buffer = new Uint8Array(bytes);

  type ContentPart =
    | { type: "file"; data: Uint8Array; mediaType: string }
    | { type: "text"; text: string };

  const parts: ContentPart[] = [];

  if (resolvedType === "text/plain") {
    const text = new TextDecoder("utf-8").decode(buffer);
    parts.push({
      type: "text",
      text: `Study material to analyse:\n\n---\n${text.slice(0, 50_000)}\n---`,
    });
  } else {
    parts.push({ type: "file", data: buffer, mediaType: resolvedType });
  }

  parts.push({ type: "text", text: EXTRACTION_PROMPT });

  try {
    const { object } = await generateObject({
      model: google("gemini-3.6-flash"),
      schema: CourseworkExtractedSchema,
      messages: [{ role: "user", content: parts }],
      maxRetries: 0,
      abortSignal: AbortSignal.timeout(60_000),
    });

    await supabase
      .from("coursework_items")
      .update({ title: object.title, subject_name: object.subjectName, status: "ready", extracted: object })
      .eq("id", itemId)
      .eq("user_id", user.id);

    return {
      ok: true,
      item: {
        id: itemId,
        title: object.title,
        subjectName: object.subjectName,
        fileType: resolvedType.split("/")[1] ?? resolvedType,
        status: "ready",
        extracted: object,
        createdAt: new Date().toISOString(),
      },
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[coursework] extraction failed:", msg);
    await logAppError("coursework_upload", msg, { fileName: file.name, fileType: resolvedType }, user.id);
    await supabase
      .from("coursework_items")
      .update({ status: "failed", error_message: "Could not extract content from this file." })
      .eq("id", itemId)
      .eq("user_id", user.id);

    const lower = msg.toLowerCase();
    if (lower.includes("api key") || lower.includes("unauthorized")) {
      return { ok: false, error: "AI service is not configured." };
    }
    if (lower.includes("quota") || lower.includes("429") || lower.includes("rate limit")) {
      return { ok: false, error: "AI service is at capacity. Try again shortly." };
    }
    return { ok: false, error: "Could not extract content. Make sure the file clearly shows study material." };
  }
}

const EXTRACTION_PROMPT = `Extract structured learning content from this study material.

Identify:
1. A short descriptive title (not the filename — describe what the material is about)
2. The academic subject (e.g. "Biology", "Mathematics", "History")
3. Overall difficulty: easy / medium / hard
4. Main topics with subtopics and key concepts (3–8 words each)
5. Important term/definition pairs (up to 15)
6. Key facts, rules, or statements to remember (up to 15)
7. Relationships between concepts (e.g. "photosynthesis causes oxygen release")

Rules:
- Only extract what is actually in the material. Never invent content.
- Definitions must be specific and accurate to the material.
- If a section is absent, return an empty array.
- If you cannot identify the subject, use "General".`;

// ---------------------------------------------------------------------------
// Fetch list
// ---------------------------------------------------------------------------

export async function getCourseworkListAction(): Promise<CourseworkItem[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data } = await supabase
    .from("coursework_items")
    .select("id, title, subject_name, file_type, status, extracted, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(50);

  return (data ?? []).map((row) => ({
    id: row.id as string,
    title: row.title as string,
    subjectName: row.subject_name as string | null,
    fileType: row.file_type as string,
    status: row.status as "processing" | "ready" | "failed",
    extracted: (row.extracted as CourseworkExtracted | null) ?? null,
    createdAt: row.created_at as string,
  }));
}

// ---------------------------------------------------------------------------
// Fetch single item
// ---------------------------------------------------------------------------

export async function getCourseworkItemAction(id: string): Promise<CourseworkItem | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from("coursework_items")
    .select("id, title, subject_name, file_type, status, extracted, created_at")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!data) return null;

  return {
    id: data.id as string,
    title: data.title as string,
    subjectName: data.subject_name as string | null,
    fileType: data.file_type as string,
    status: data.status as "processing" | "ready" | "failed",
    extracted: (data.extracted as CourseworkExtracted | null) ?? null,
    createdAt: data.created_at as string,
  };
}
