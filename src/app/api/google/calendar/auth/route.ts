import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Initiates the Google Calendar OAuth flow.
 * Redirects the user to Google's authorisation page.
 *
 * GET /api/google/calendar/auth
 *
 * Required env vars:
 *   GOOGLE_CLIENT_ID
 *   NEXT_PUBLIC_SITE_URL (e.g. https://your-app.vercel.app)
 */
export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? new URL(request.url).origin;

  if (!clientId) {
    return NextResponse.redirect(
      new URL("/settings?error=google_not_configured", request.url),
    );
  }

  const redirectUri = `${siteUrl}/api/google/calendar/callback`;

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: [
      "https://www.googleapis.com/auth/calendar.readonly",
      "https://www.googleapis.com/auth/userinfo.email",
    ].join(" "),
    access_type: "offline",
    prompt: "consent",
    state: user.id,
  });

  const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  return NextResponse.redirect(authUrl);
}
