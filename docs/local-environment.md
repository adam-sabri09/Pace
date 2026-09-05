# Local Environment Setup

This document explains how to run Pace locally so you can test the full app end-to-end before deploying to production.

## Overview

```mermaid
flowchart LR
    Browser["Browser\nlocalhost:3000"]
    Next["Next.js dev server\nnpm run dev\nHMR enabled"]
    Supa["Local Supabase\nnpx supabase start\nPostgres + Auth + Studio\n127.0.0.1:54321"]
    Gemini["Google Gemini API\nReal API key required\nNo local alternative"]

    Browser -- "HTTP" --> Next
    Next -- "PostgREST\n127.0.0.1:54321" --> Supa
    Next -- "HTTPS REST\n(server-side only)" --> Gemini
```

Pace has three runtime dependencies:

| Dependency | Local substitute | Notes |
|---|---|---|
| Vercel (Next.js) | `npm run dev` or Docker | Dev server or production-like image |
| Supabase (Postgres + Auth) | `npx supabase start` | Requires Docker Desktop |
| Google Gemini API | Your real API key | No local alternative |

---

## Prerequisites

Install these once:

1. **Node.js 22+** — https://nodejs.org (check: `node --version`)
2. **Docker Desktop** — https://www.docker.com/products/docker-desktop (check: `docker --version`)
3. **Supabase CLI** — included as a dev dependency; run via `npx supabase`

---

## Mode A — Fast development (recommended for daily work)

This is the fastest loop: Next.js dev server (HMR) + local Supabase.

### Step 1 — Start local Supabase

```bash
npx supabase start
```

This pulls Docker images on first run (~3 minutes), then starts:
- **API**: http://127.0.0.1:54321 (PostgREST)
- **DB**: postgres://postgres:postgres@127.0.0.1:54322/postgres
- **Studio**: http://127.0.0.1:54323 (visual DB browser)
- **Auth**: built into the API

All 9 migrations in `supabase/migrations/` are applied automatically.

The command prints your local credentials:
```
API URL: http://127.0.0.1:54321
anon key: eyJ...
service_role key: eyJ...
```

### Step 2 — Create `.env.local`

```bash
cp .env.example .env.local
```

Then edit `.env.local`:
```bash
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon key from supabase start>
SUPABASE_SERVICE_ROLE_KEY=<service_role key from supabase start>
GOOGLE_GENERATIVE_AI_API_KEY=<your Gemini API key>
ADMIN_EMAILS=your.email@example.com
```

> **Never commit `.env.local`.** It is git-ignored.

### Step 3 — Start the Next.js dev server

```bash
npm install
npm run dev
```

Open http://localhost:3000

### Step 4 — Sign up a test account

- Navigate to `/signup`
- Create an account with any email + password (8+ chars)
- Local Supabase does NOT send real emails — check Inbucket at http://127.0.0.1:54324 if needed
- Email confirmation is disabled by default, so sign-up creates a session immediately

### Step 5 — Stop local Supabase when done

```bash
npx supabase stop
```

Data is preserved between starts unless you run `npx supabase db reset`.

---

## Mode B — Production-like (Docker)

This runs the production Next.js build in a Docker container, pointing at local Supabase. Use this to catch issues that only appear in production builds.

### Step 1 — Start local Supabase (same as Mode A, Step 1)

```bash
npx supabase start
```

### Step 2 — Create `.env.docker`

```bash
cp .env.example .env.docker
```

Edit `.env.docker`. Use `host.docker.internal` instead of `127.0.0.1` so the container can reach the host's local Supabase:

```bash
NEXT_PUBLIC_SUPABASE_URL=http://host.docker.internal:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon key from supabase start>
SUPABASE_SERVICE_ROLE_KEY=<service_role key from supabase start>
GOOGLE_GENERATIVE_AI_API_KEY=<your Gemini API key>
ADMIN_EMAILS=your.email@example.com
```

> **Never commit `.env.docker`.** It is git-ignored.

### Step 3 — Build and run

```bash
docker compose up --build
```

Open http://localhost:3000

On subsequent runs (no code changes):
```bash
docker compose up
```

Stop:
```bash
docker compose down
```

---

## Resetting the local database

To wipe all local data and re-apply migrations from scratch:

```bash
npx supabase db reset
```

This is useful when:
- You want a clean slate for testing
- A migration file changed
- You added a new migration

---

## Applying a new migration

1. Write the migration SQL in `supabase/migrations/<timestamp>_<name>.sql`
2. Apply it to the local DB: `npx supabase db reset` (or just restart — new migrations are applied on start)
3. Test it locally
4. Push to production: `npx supabase db push` (requires linking — see below)

---

## Linking to the production Supabase project

Only needed for operations that target the production database (migrations push, pulling the remote schema).

```bash
npx supabase link --project-ref <project-ref>
```

The project ref is in the Supabase dashboard URL: `https://supabase.com/dashboard/project/<project-ref>`.

> **Warning:** `supabase db push` applies migrations to the linked (production) database. Always review the diff first:
> ```bash
> npx supabase db diff
> ```

---

## Smoke test checklist

After starting the local environment (either mode), verify these flows manually:

- [ ] Sign up → onboarding wizard completes → `/today` shows a study plan
- [ ] Mark a session complete/missed → plan re-generates
- [ ] Upload a coursework file → status transitions to `ready`
- [ ] Start a practice session → answer 3 questions → see feedback
- [ ] Open AI Coach → send a message → receive a reply
- [ ] Update availability in Settings → plan re-generates
- [ ] Navigate to `/admin` as an admin email → see dashboard
- [ ] Navigate to `/admin` as a non-admin → redirected to `/today`

---

## Environment variable reference

| Variable | Required in | Description |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | server + client | Public Supabase API URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | server + client | Public anon key (RLS-restricted reads) |
| `SUPABASE_SERVICE_ROLE_KEY` | server only | Bypasses RLS — never expose to client |
| `GOOGLE_GENERATIVE_AI_API_KEY` | server only | Gemini API key for all AI features |
| `ADMIN_EMAILS` | server only | Comma-separated admin allowlist |

Full description in `docs/technical/architecture.md`.

---

## Troubleshooting

| Problem | Likely cause | Fix |
|---|---|---|
| `supabase start` fails | Docker Desktop not running | Start Docker Desktop first |
| `supabase start` hangs | First-time image download | Wait — can take 3–5 minutes on first run |
| App shows "missing env vars" | `.env.local` not filled in | Re-check the values |
| Auth redirects to `/login` immediately | Session not set | Try signing in again; check Supabase Auth logs in Studio |
| `/admin` redirects to `/today` | Email not in `ADMIN_EMAILS` | Add your email to `ADMIN_EMAILS` in `.env.local` |
| Gemini calls fail | Invalid or missing API key | Check `GOOGLE_GENERATIVE_AI_API_KEY` |
| Docker container can't reach Supabase | `host.docker.internal` not resolving | On Linux, add `extra_hosts: ["host.docker.internal:host-gateway"]` to `docker-compose.yml` (already included) |
