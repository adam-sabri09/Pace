import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

/**
 * Email confirmation route for Supabase Auth.
 *
 * Supabase sends this link when "Confirm email" is enabled in the Auth settings.
 * The token_hash and type params are verified server-side via verifyOtp().
 * On success the user gets a session and is redirected to /today (or ?next=).
 *
 * To enable: Supabase Dashboard → Authentication → Email → Enable email confirmations.
 * Then set SMTP (or Supabase's built-in, limited to 2/hour in development).
 * Add this URL to Supabase redirect allowlist: <site_url>/auth/confirm
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as "email" | "recovery" | "invite" | null;
  const next = searchParams.get("next") ?? "/today";

  if (!tokenHash || !type) {
    return NextResponse.redirect(`${origin}/login?error=invalid_link`);
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

  const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });

  if (error) {
    return NextResponse.redirect(`${origin}/login?error=email_confirm_failed`);
  }

  // Recovery tokens land on the dedicated reset-password page rather than the
  // caller-supplied `next` value so the user can immediately set a new password.
  const redirectPath = type === "recovery" ? "/reset-password" : next;
  return NextResponse.redirect(`${origin}${redirectPath}`);
}
