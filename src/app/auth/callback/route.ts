import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

/**
 * OAuth callback route for Supabase OAuth providers (Google, etc.).
 * Exchanges the authorization code for a session, then redirects to /today.
 * /today gates on onboarding status, so new OAuth users land in /onboarding.
 *
 * Redirect URL that must be added in:
 *   - Google Cloud Console → OAuth 2.0 Client → Authorized redirect URIs
 *   - Supabase Dashboard → Authentication → URL Configuration → Redirect URLs
 * Value: https://<your-domain>/auth/callback
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/today";
  const error = searchParams.get("error");

  if (error) {
    return NextResponse.redirect(`${origin}/login?error=oauth_cancelled`);
  }

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=oauth_error`);
  }

  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        },
      },
    },
  );

  const { data, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);

  if (exchangeError || !data.user) {
    return NextResponse.redirect(`${origin}/login?error=oauth_error`);
  }

  // Populate first_name from Google user metadata for new users whose profile
  // row was just created by the on_auth_user_created trigger with only an id.
  const meta = data.user.user_metadata;
  const firstName =
    (meta?.given_name as string | undefined) ??
    (meta?.full_name as string | undefined)?.split(" ")[0] ??
    (meta?.name as string | undefined)?.split(" ")[0];

  if (firstName) {
    await supabase
      .from("profiles")
      .update({
        first_name: firstName,
        age_confirmed_13_plus: true,
      })
      .eq("id", data.user.id)
      .is("first_name", null); // only update if not already set (avoid overwriting manual edits)
  }

  return NextResponse.redirect(`${origin}${next}`);
}
