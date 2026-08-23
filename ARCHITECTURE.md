# ARCHITECTURE.md

## Stack (decided)

- **Frontend + backend**: Next.js (App Router) on Vercel.
- **Runtime**: Node.js (Vercel Fluid Compute default). Not Edge.
- **Language**: TypeScript, strict mode.
- **UI**: React + Tailwind CSS + shadcn/ui components.
- **Auth + database**: Supabase (managed Postgres + Auth).
- **LLM**: Anthropic Claude via Vercel AI Gateway (using AI SDK v6 with a plain `"provider/model"` string).
- **Hosting**: Vercel.
- **Package manager**: npm.

Rationale for each pick lives in [DECISIONS.md](DECISIONS.md). Reasoning was: simplicity, low cost, fast dev, one deployable unit, and matches the tools available in this environment.

## Shape of the system

```
[Browser]
    |
    | HTTPS
    v
[Next.js on Vercel]
    |-- App Router pages (public: landing; private: dashboard, plan, settings)
    |-- Server Actions / Route Handlers  (all server-side logic)
    |       |
    |       |-- calls Supabase (postgres + auth)
    |       |-- calls AI Gateway (LLM plan generation)
    |
[Supabase]                       [AI Gateway]
    |-- Postgres (data)               |
    |-- Auth (users)                  v
                                    [Claude]
```

- **One process, one deployment**: everything is Next.js on Vercel. No separate backend service in the MVP.
- **All LLM calls are server-side.** The browser never sees the AI Gateway key.
- **All Supabase writes are server-side or use RLS.** Reads may use the client SDK with the anon key + Row Level Security.

## Data flow: plan generation

1. Student submits the plan form (client → server action).
2. Server action validates the input schema (Zod).
3. Server action fetches user session (Supabase Auth).
4. Server action builds a structured prompt from the input, calls the LLM through the AI Gateway with a response schema (AI SDK `generateObject`).
5. LLM returns a plan object; the server validates it against the schema (retry once on failure).
6. Server writes the plan (and sessions) to Postgres via Supabase, scoped to the user.
7. Client refetches and renders the today's-dashboard view.

## Data flow: adaptive re-plan

1. User taps "Missed" on a session (or updates availability / subjects from settings or the Subjects page).
2. Server action loads: user's plan definition (subjects/topics/exam dates/availability windows), completed sessions, and current timestamp.
3. Server action builds a prompt: "given these inputs, these already-completed sessions, and current time, produce the remaining sessions from now until the latest exam."
4. Same LLM path as plan generation (schema-validated).
5. Server replaces all *future* (uncompleted, non-missed) sessions atomically in a Postgres transaction.
6. Client refetches.

Completed sessions are never rewritten.

## Server-side vs client-side split

| Concern | Where |
|---|---|
| Rendering pages | Server Components by default |
| Small interactive UI (toggles, buttons) | Client Components |
| Auth session read | Server, via Supabase SSR helpers |
| Any LLM call | Server only |
| Any write to `plans` / `sessions` tables | Server only, via server action |
| Reads for dashboard | Server-side in the Server Component |

## Environment variables

Held in `.env.local` (dev) and Vercel project env (prod). Names:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` (server only)
- `AI_GATEWAY_API_KEY` (server only)

`SUPABASE_SERVICE_ROLE_KEY` and `AI_GATEWAY_API_KEY` must never be exposed to the client.

## What is intentionally NOT in the architecture

- No microservices, no separate API service, no queue, no worker.
- No caching layer beyond Next.js defaults.
- No websockets, no realtime features.
- No CDN or edge functions (Fluid Compute is enough).
- No feature flags.
- No analytics.
- No native mobile.

These are noted so they don't creep in.
