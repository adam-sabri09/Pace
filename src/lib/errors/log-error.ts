import "server-only";

import { createServiceClient } from "@/lib/supabase/service";

export type AppErrorType =
  | "upload_ocr"
  | "upload_save"
  | "plan_generation"
  | "replan"
  | "onboarding"
  | "other";

/**
 * Log an application error to the console (visible in Vercel logs) and
 * persist it to the app_errors table for the /admin dashboard.
 *
 * Never throws — error logging must not crash the caller.
 */
export async function logAppError(
  errorType: AppErrorType,
  message: string,
  context: Record<string, unknown> = {},
  userId?: string,
): Promise<void> {
  // Always log to stderr so Vercel captures it.
  console.error(`[pace:${errorType}]`, message, context);

  try {
    const supabase = createServiceClient();
    await supabase.from("app_errors").insert({
      error_type: errorType,
      message,
      context,
      user_id: userId ?? null,
    });
  } catch (e) {
    // If the DB write itself fails, still don't throw — just log it.
    console.error("[pace:log-error] Failed to persist error to DB:", e);
  }
}
