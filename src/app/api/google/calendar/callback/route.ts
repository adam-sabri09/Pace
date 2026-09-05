import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

/**
 * Handles the Google Calendar OAuth callback.
 * Exchanges the authorisation code for tokens and persists them in
 * google_connections so server-side calendar fetches can run without
 * prompting the user again.
 *
 * GET /api/google/calendar/callback?code=...&state=<userId>
 *
 * Required env vars:
 *   GOOGLE_CLIENT_ID
 *   GOOGLE_CLIENT_SECRET
 *   NEXT_PUBLIC_SITE_URL
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const error = searchParams.get("error");
  const state = searchParams.get("state"); // userId passed in auth route
  const origin = process.env.NEXT_PUBLIC_SITE_URL ?? new URL(request.url).origin;

  if (error || !code || !state) {
    return NextResponse.redirect(
      `${origin}/settings?error=google_calendar_cancelled`,
    );
  }

  // Verify the authenticated user matches the state.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || user.id !== state) {
    return NextResponse.redirect(`${origin}/login`);
  }

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = `${origin}/api/google/calendar/callback`;

  if (!clientId || !clientSecret) {
    return NextResponse.redirect(
      `${origin}/settings?error=google_not_configured`,
    );
  }

  // Exchange authorisation code for access + refresh tokens.
  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });

  if (!tokenRes.ok) {
    return NextResponse.redirect(
      `${origin}/settings?error=google_token_error`,
    );
  }

  const tokens = (await tokenRes.json()) as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
    scope?: string;
  };

  if (!tokens.access_token) {
    return NextResponse.redirect(
      `${origin}/settings?error=google_token_error`,
    );
  }

  const expiry = tokens.expires_in
    ? new Date(Date.now() + tokens.expires_in * 1000).toISOString()
    : null;

  const scopes = tokens.scope?.split(" ") ?? [];

  // Upsert the connection row via service role (the user's cookie session
  // has RLS permission, but service role avoids any edge-case policy issues
  // on first-time inserts).
  const svc = createServiceClient();
  const { error: upsertError } = await svc
    .from("google_connections")
    .upsert(
      {
        user_id: user.id,
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token ?? null,
        token_expiry: expiry,
        scopes,
      },
      { onConflict: "user_id" },
    );

  if (upsertError) {
    return NextResponse.redirect(
      `${origin}/settings?error=google_save_error`,
    );
  }

  return NextResponse.redirect(`${origin}/settings?connected=google_calendar`);
}
