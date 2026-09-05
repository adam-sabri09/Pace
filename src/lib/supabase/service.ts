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
  if (!url) {
    console.error("[createServiceClient] NEXT_PUBLIC_SUPABASE_URL is not set");
    throw new Error("NEXT_PUBLIC_SUPABASE_URL is not set.");
  }
  if (!key) {
    console.error("[createServiceClient] SUPABASE_SERVICE_ROLE_KEY is not set");
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is not set.");
  }
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
