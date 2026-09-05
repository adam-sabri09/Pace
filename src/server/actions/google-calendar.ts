"use server";

import "server-only";

import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

export type GoogleCalendarStatus =
  | { connected: true; email: string | null }
  | { connected: false };

export type CalendarBusyPeriod = {
  startsAt: string; // ISO UTC
  endsAt: string;   // ISO UTC
  summary?: string;
};

// ---------------------------------------------------------------------------
// Connection status
// ---------------------------------------------------------------------------

export async function getGoogleCalendarStatusAction(): Promise<GoogleCalendarStatus> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { connected: false };

  const { data } = await supabase
    .from("google_connections")
    .select("id, scopes")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!data) return { connected: false };
  const scopes = (data.scopes as string[] | null) ?? [];
  const hasCalendar = scopes.some((s) =>
    s.includes("calendar"),
  );
  return hasCalendar ? { connected: true, email: null } : { connected: false };
}

// ---------------------------------------------------------------------------
// Disconnect
// ---------------------------------------------------------------------------

export type DisconnectResult = { ok: true } | { ok: false; error: string };

export async function disconnectGoogleCalendarAction(): Promise<DisconnectResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not authenticated." };

  const { error } = await supabase
    .from("google_connections")
    .delete()
    .eq("user_id", user.id);

  if (error) return { ok: false, error: "Could not disconnect. Try again." };
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Token helpers (server-only, not exported as server actions)
// ---------------------------------------------------------------------------

async function refreshAccessToken(
  refreshToken: string,
): Promise<{ access_token: string; expires_in: number } | null> {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) return null;

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    }),
  });

  if (!res.ok) return null;
  const json = (await res.json()) as { access_token?: string; expires_in?: number };
  if (!json.access_token) return null;
  return { access_token: json.access_token, expires_in: json.expires_in ?? 3600 };
}

/**
 * Returns a valid access token for the user's Google connection, refreshing
 * it if it has expired or will expire within 60 seconds.
 * Only callable from server-only code — never expose tokens to the client.
 */
export async function getValidAccessToken(userId: string): Promise<string | null> {
  const svc = createServiceClient();

  const { data: conn } = await svc
    .from("google_connections")
    .select("access_token, refresh_token, token_expiry, scopes")
    .eq("user_id", userId)
    .maybeSingle();

  if (!conn) return null;

  const expiry = conn.token_expiry ? new Date(conn.token_expiry as string) : null;
  const willExpireSoon = !expiry || expiry.getTime() - Date.now() < 60_000;

  if (!willExpireSoon) return conn.access_token as string;

  // Token expired or expiring — refresh it.
  if (!conn.refresh_token) return null;
  const refreshed = await refreshAccessToken(conn.refresh_token as string);
  if (!refreshed) return null;

  const newExpiry = new Date(Date.now() + refreshed.expires_in * 1000);

  // Persist the new access token (fire-and-forget — failure is non-fatal).
  await svc
    .from("google_connections")
    .update({ access_token: refreshed.access_token, token_expiry: newExpiry.toISOString() })
    .eq("user_id", userId);

  return refreshed.access_token;
}

// ---------------------------------------------------------------------------
// Fetch busy periods from Google Calendar
// ---------------------------------------------------------------------------

/**
 * Fetches the user's busy/free calendar data for the specified date range.
 * Returns an empty array if the user is not connected or the fetch fails.
 * Never throws — calendar data is additive and its absence is non-fatal.
 */
export async function fetchCalendarBusyPeriods(
  userId: string,
  fromISO: string,
  toISO: string,
): Promise<CalendarBusyPeriod[]> {
  const accessToken = await getValidAccessToken(userId);
  if (!accessToken) return [];

  try {
    const res = await fetch(
      "https://www.googleapis.com/calendar/v3/freeBusy",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          timeMin: fromISO,
          timeMax: toISO,
          items: [{ id: "primary" }],
        }),
      },
    );

    if (!res.ok) return [];

    const json = (await res.json()) as {
      calendars?: {
        primary?: {
          busy?: Array<{ start: string; end: string }>;
        };
      };
    };

    const busy = json.calendars?.primary?.busy ?? [];
    return busy.map((b) => ({ startsAt: b.start, endsAt: b.end }));
  } catch {
    return [];
  }
}
