import "server-only";

import { createClient } from "@supabase/supabase-js";

/**
 * Service-role Supabase client — bypasses RLS.
 * NEVER import this in client components or expose it to the browser.
 * Use only for admin reads and trusted server-side writes (e.g. error logging).
 */
export function createServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    // Log which variable is missing to help diagnose production incidents.
    console.error("[createServiceClient] missing env vars:", {
      hasUrl: !!url,
      hasKey: !!key,
    });
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set.",
    );
  }
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
