import "server-only";

import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

/**
 * Supabase client for use in Server Components, Server Actions, and Route Handlers.
 * Uses the request cookies to authenticate. Only importable from server code —
 * `server-only` will fail the build if imported from a Client Component.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          } catch {
            // `set` throws when called from a Server Component. That's fine —
            // the middleware refreshes the session cookies on every request,
            // so a Server Component that only reads the session is unaffected.
          }
        },
      },
    },
  );
}
