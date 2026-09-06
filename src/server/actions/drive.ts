"use server";

import "server-only";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { uploadCourseworkAction } from "@/server/actions/coursework";
import { logAppError } from "@/lib/errors/log-error";

const DriveImportSchema = z.object({
  fileId: z.string().min(1).max(200),
  accessToken: z.string().min(1),
  fileName: z.string().min(1).max(500),
  mimeType: z.string().min(1).max(200),
});

// Google Workspace document MIME types and their export equivalents.
// Only Google Docs is supported — spreadsheet and presentation exports are
// excluded because the coursework pipeline does not support their output types.
const WORKSPACE_EXPORT: Record<string, string> = {
  "application/vnd.google-apps.document": "text/plain",
};

const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "application/pdf",
  "text/plain",
]);

const MAX_FILE_BYTES = 5 * 1024 * 1024;

/**
 * Downloads a file from Google Drive using a short-lived access token obtained
 * by the browser, then feeds it through the existing coursework upload pipeline.
 *
 * Security: the access token is used once for the download and never stored.
 * Token logging is intentionally omitted.
 */
export async function importFromDriveAction(raw: unknown) {
  const parsed = DriveImportSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false as const, error: "Invalid request." };
  }

  const { fileId, accessToken, fileName, mimeType } = parsed.data;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, error: "You need to be signed in." };

  // Resolve the download URL and effective MIME type.
  const exportMime = WORKSPACE_EXPORT[mimeType];
  let downloadUrl: string;
  let resolvedMime: string;

  if (exportMime) {
    // Google Workspace file — export as plain text.
    downloadUrl = `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}/export?mimeType=${encodeURIComponent(exportMime)}`;
    resolvedMime = exportMime;
  } else if (ALLOWED_MIME_TYPES.has(mimeType)) {
    downloadUrl = `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?alt=media`;
    resolvedMime = mimeType;
  } else {
    return {
      ok: false as const,
      error: "Unsupported file type. Upload a JPEG, PNG, WebP, GIF, PDF, or text file.",
    };
  }

  // Download from Google Drive — access token is used here and nowhere else.
  let driveRes: Response;
  try {
    driveRes = await fetch(downloadUrl, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
  } catch {
    await logAppError(
      "drive_import",
      "Network error downloading from Drive",
      { fileName, mimeType },
      user.id,
    );
    return { ok: false as const, error: "Network error downloading from Google Drive." };
  }

  if (!driveRes.ok) {
    // Log every non-2xx Drive response — by this point the user completed the
    // Picker flow and Drive still failed, so all of these are real failures,
    // not user cancellations. User-facing messages remain generic.
    await logAppError(
      "drive_import",
      `Drive API error ${driveRes.status}`,
      { fileName, mimeType, status: driveRes.status },
      user.id,
    );
    if (driveRes.status === 404) {
      return { ok: false as const, error: "File not found or access denied." };
    }
    if (driveRes.status === 401 || driveRes.status === 403) {
      return { ok: false as const, error: "Google Drive access denied. Please try again." };
    }
    return { ok: false as const, error: "Could not download file from Google Drive." };
  }

  // Pre-check Content-Length before buffering to avoid loading oversized files
  // into memory. Drive omits this header on export endpoints, so the
  // post-download check below remains the authoritative guard.
  const contentLength = Number(driveRes.headers.get("content-length") ?? 0);
  if (contentLength > MAX_FILE_BYTES) {
    return { ok: false as const, error: "File too large — 5 MB maximum." };
  }

  const bytes = await driveRes.arrayBuffer();
  if (bytes.byteLength > MAX_FILE_BYTES) {
    return { ok: false as const, error: "File too large — 5 MB maximum." };
  }
  if (bytes.byteLength === 0) {
    return { ok: false as const, error: "The selected file is empty." };
  }

  // Build a File object and delegate to the existing upload pipeline.
  // uploadCourseworkAction handles its own error logging internally.
  const baseName = fileName.replace(/\.[^.]+$/, "");
  const file = new File([bytes], `${baseName}.${resolvedMime.split("/")[1] ?? "bin"}`, {
    type: resolvedMime,
  });

  const formData = new FormData();
  formData.set("coursework", file);

  return uploadCourseworkAction(formData);
}
