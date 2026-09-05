import { createBrowserClient } from "@supabase/ssr";

/**
 * Supabase client for use in Client Components and browser-side event handlers.
 * Uses the public anon key — safe to expose. Call this inside event handlers or
 * useEffect, not at module-level, to avoid importing on the server.
 */
export function createBrowserSupabaseClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
