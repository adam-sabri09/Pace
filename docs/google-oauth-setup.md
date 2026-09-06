# Google OAuth Setup

This guide covers everything needed to enable Google Sign-In, Google Drive import, and Google Calendar integration in Pace.

## Overview

All three Google features share **one OAuth 2.0 client** in Google Cloud Console. You will:

1. Create a project and enable APIs.
2. Configure the OAuth consent screen.
3. Create an OAuth 2.0 client ID.
4. Add redirect URIs.
5. Set environment variables.
6. Configure Supabase for Google Sign-In.

---

## Step 1 — Google Cloud Console project

1. Go to [Google Cloud Console](https://console.cloud.google.com/).
2. Create a new project (e.g. "Pace App") or select an existing one.
3. Enable the following APIs under **APIs & Services → Library**:
   - **Google Calendar API** — for reading busy periods
   - **Google Drive API** — for file picker / Drive import
   - **Google Picker API** — for the in-browser picker UI

---

## Step 2 — OAuth consent screen

1. Go to **APIs & Services → OAuth consent screen**.
2. Choose **External** (for production) or **Internal** (if using a Google Workspace org).
3. Fill in:
   - **App name**: Pace
   - **User support email**: your email
   - **Developer contact**: your email
4. Under **Scopes**, add:
   - `https://www.googleapis.com/auth/calendar.readonly`
   - `https://www.googleapis.com/auth/drive.readonly`
   - `https://www.googleapis.com/auth/userinfo.email`
   - `openid`
5. If the app is External and not yet verified, add test users for development.
6. Submit for verification before going to production (required for Calendar and Drive scopes with real users).

---

## Step 3 — OAuth 2.0 client ID

1. Go to **APIs & Services → Credentials → Create Credentials → OAuth client ID**.
2. Application type: **Web application**.
3. Name: e.g. "Pace Web".
4. Under **Authorised JavaScript origins**, add:
   - `http://localhost:3000` (local dev)
   - `https://your-app.vercel.app` (production)
5. Under **Authorised redirect URIs**, add all of the following:

   **For Google Sign-In (handled by Supabase):**
   ```
   https://<your-supabase-project>.supabase.co/auth/v1/callback
   ```

   **For Google Calendar OAuth (handled by Pace):**
   ```
   http://localhost:3000/api/google/calendar/callback
   https://your-app.vercel.app/api/google/calendar/callback
   ```

6. Click **Create**. Copy the **Client ID** and **Client Secret**.

---

## Step 4 — API key (for Drive Picker)

1. Go to **APIs & Services → Credentials → Create Credentials → API key**.
2. Click **Restrict Key**:
   - Under **API restrictions**, select **Restrict key** and choose **Google Picker API**.
   - Under **Website restrictions**, add your domains (`localhost:3000`, `your-app.vercel.app`).
3. Copy the API key.

---

## Step 5 — Environment variables

Add these to `.env.local` for local development and to your Vercel project environment for production:

```bash
# Public (available in the browser)
NEXT_PUBLIC_GOOGLE_CLIENT_ID=<your-client-id>
NEXT_PUBLIC_GOOGLE_API_KEY=<your-api-key>

# Server-only (never expose to the browser)
GOOGLE_CLIENT_ID=<your-client-id>       # same as above
GOOGLE_CLIENT_SECRET=<your-client-secret>

# Canonical URL of this deployment (no trailing slash)
NEXT_PUBLIC_SITE_URL=http://localhost:3000      # or your production URL
```

---

## Step 6 — Supabase Google Sign-In

1. In the Supabase dashboard, go to **Authentication → Providers → Google**.
2. Enable the Google provider.
3. Paste:
   - **Client ID**: your `NEXT_PUBLIC_GOOGLE_CLIENT_ID`
   - **Client Secret**: your `GOOGLE_CLIENT_SECRET`
4. The **callback URL** is shown there — it should already match what you added in Step 3.
5. Save.

---

## Feature routing

| Feature | OAuth flow | Tokens stored |
|---------|-----------|---------------|
| Google Sign-In | Supabase Auth (`signInWithOAuth`) | Supabase manages session |
| Drive import | Short-lived access token (browser, never persisted) | Never stored |
| Calendar scheduling | Server OAuth flow → `google_connections` table | Refresh token in DB |

```mermaid
sequenceDiagram
    participant B as Browser
    participant N as Next.js (server)
    participant S as Supabase Auth
    participant G as Google OAuth

    rect rgb(230, 240, 255)
        Note over B,G: Google Sign-In — Supabase-managed
        B->>N: Click "Sign in with Google"
        N->>S: signInWithOAuth({ provider: 'google' })
        S-->>B: 302 → Google consent screen
        B->>G: User grants access
        G-->>S: Callback with auth code
        S->>G: Exchange code for tokens
        S-->>N: Supabase session JWT (via cookie)
        N-->>B: Set-Cookie; redirect /today
    end

    rect rgb(230, 255, 235)
        Note over B,G: Google Calendar OAuth — server-managed
        B->>N: Click "Connect Google Calendar"
        N-->>B: 302 → Google (scope: calendar.readonly)
        B->>G: User grants access
        G-->>N: GET /api/google/calendar/callback?code=…
        N->>G: POST /token — exchange code
        G-->>N: access_token + refresh_token
        N->>N: INSERT google_connections (refresh_token)
        N-->>B: redirect /settings (connected)
    end

    Note over B,N: Drive import uses a short-lived browser token<br/>from Google Identity Services — never sent to the server.
```

---

## Local dev notes

- For Google Sign-In, the Supabase callback goes to the Supabase cloud URL (not localhost) — this works in local dev as long as your Supabase project is set up.
- For Calendar OAuth, the callback hits `http://localhost:3000/api/google/calendar/callback` — make sure this URI is in the **Authorised redirect URIs** list.
- Drive Picker requires `NEXT_PUBLIC_GOOGLE_CLIENT_ID` and `NEXT_PUBLIC_GOOGLE_API_KEY` — the picker button is hidden when either is missing.
- Google may show an "unverified app" warning during development — this is expected before the consent screen is verified.

---

## Database migration

Run the migration to create the `google_connections` table:

```bash
npx supabase db push
```

Or apply `supabase/migrations/0010_google_connections.sql` manually.

---

## Security notes

- Access tokens are never logged or sent to the frontend.
- The Drive import receives a short-lived access token from the browser's Google Identity Services session — the token is used once and never persisted.
- Calendar refresh tokens are stored in the `google_connections` table, which has Row Level Security enabled. Only the owning user can read their own row; the server uses the service role key to refresh tokens server-side.
- Token refresh happens server-side in `getValidAccessToken` — the refreshed token is stored back to the DB, and only the value is returned to other server-only code.
