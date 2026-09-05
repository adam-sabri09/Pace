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

  // Generate a cryptographically random CSRF nonce (32 bytes → 64 hex chars).
  const nonce = Array.from(crypto.getRandomValues(new Uint8Array(32)))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

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
    state: nonce,
  });

  const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;

  const response = NextResponse.redirect(authUrl);

  // Store the nonce in a short-lived HTTP-only cookie so the callback can
  // verify the state parameter and reject forged OAuth responses.
  response.cookies.set("google_cal_oauth_state", nonce, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 600, // 10 minutes — long enough for a slow user, short enough to limit window
    path: "/",
  });

  return response;
}
