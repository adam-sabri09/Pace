# Architecture

Last updated: 2026-09-01. Reflects commit `b9ee291` on `feat/product-modules`.

## Stack

| Layer | Technology | Notes |
|---|---|---|
| Frontend + backend | Next.js 16 (App Router) | One deployable unit |
| Hosting | Vercel (Fluid Compute) | Node.js, not Edge |
| Language | TypeScript strict | End-to-end |
| UI | React + Tailwind CSS | Mobile-first |
| Auth + database | Supabase | Managed Postgres + Auth |
| AI | Google Gemini via `@ai-sdk/google` | D14: free tier, no card required |
| Package manager | npm | D13 |

Rationale for each pick: [DECISIONS.md](../development/decisions-log.md).
D14 (Gemini) supersedes the AI section of D4 (which originally said Claude/Vercel AI Gateway).

---

## Component map

```
Browser
  │
  │  HTTPS
  ▼
Next.js on Vercel (Fluid Compute / Node.js)
  ├─ App Router pages
  │    ├─ Server Components  (data fetch, auth check, initial render)
  │    └─ Client Components  (interactive UI: forms, timers, chat)
  │
  ├─ Server Actions           (all mutations + AI calls)
  │    ├─ auth.ts             signup, login, logout
  │    ├─ onboarding.ts       wizard, profile save, plan trigger
  │    ├─ plan.ts             plan generation + re-plan
  │    ├─ sessions.ts         mark complete/missed
  │    ├─ subjects.ts         add/update/delete subjects
  │    ├─ coursework.ts       upload, AI extraction, list, fetch
  │    ├─ practice.ts         start session, submit answer, end session
  │    ├─ events.ts           session lifecycle events
  │    ├─ settings.ts         availability save
  │    ├─ admin.ts            clear app_errors (admin-only)
  │    ├─ coach.ts            AI chat
  │    ├─ personalization.ts  save/skip personalization answers
  │    └─ suggestions.ts      wizard suggestions
  │
  └─ LLM layer (server-side only)
       ├─ generate.ts         plan generation prompt + Gemini call
       ├─ validate.ts         feasibility check
       ├─ fallback.ts         on-error fallback plan
       ├─ diff.ts             detect plan changes
       ├─ schema.ts           Zod schemas for LLM output
       └─ prompt.ts           prompt-building helpers

Supabase (eu-west-2 / London region — hypothesis, not confirmed)
  ├─ Postgres          all application data (RLS-protected)
  └─ Auth              session management, JWT

Google Gemini API
  └─ gemini-3.6-flash  plan generation, coursework extraction,
                       question generation, answer evaluation, AI coach
```

---

## Infrastructure topology

```mermaid
flowchart LR
    Browser["Browser\n(React client components)"]
    Vercel["Vercel — Fluid Compute\n(Next.js App Router\nNode.js runtime)"]
    Supabase["Supabase\n(Postgres + Auth\nPostgREST API)"]
    Gemini["Google Gemini API\n(gemini-3.6-flash)"]

    Browser -- "HTTPS (server actions\nform POSTs, RSC)" --> Vercel
    Vercel -- "PostgREST / JWT\n(anon key + service role)" --> Supabase
    Vercel -- "HTTPS REST\n(API key, server-side only)" --> Gemini
```

All Gemini calls and all service-role Supabase calls originate from Vercel server-side code only. The browser never holds the API key or service-role key.

---

## Data flow

```mermaid
flowchart TD
    User["Student"]

    subgraph Browser["Browser"]
        RC["React client\ncomponents"]
    end

    subgraph Vercel["Vercel (server)"]
        SA["Server Actions\n(auth, plan, sessions,\ncoursework, practice, coach…)"]
        SC["Server Components\n(data fetch + initial render)"]
        LLM["LLM layer\n(generate, validate, diff)"]
    end

    subgraph Data["Data stores"]
        DB["Supabase Postgres\n(RLS-protected)"]
        Auth["Supabase Auth\n(JWT sessions)"]
    end

    AI["Google Gemini API"]

    User --> RC
    RC -- "server action call" --> SA
    SC -- "RLS-scoped SELECT" --> DB
    SA -- "auth check" --> Auth
    SA -- "RLS-scoped read/write" --> DB
    SA --> LLM
    LLM -- "generateObject / generateText" --> AI
    AI -- "structured JSON response" --> LLM
    SC -- "rendered HTML" --> RC
    SA -- "result" --> RC
```

---

## Authentication flow

```mermaid
sequenceDiagram
    participant B as Browser
    participant N as Next.js
    participant S as Supabase Auth
    participant DB as Postgres

    B->>N: GET /login
    N-->>B: login form (server rendered)
    B->>N: POST signInAction(email, password)
    N->>S: signInWithPassword()
    S-->>N: session token (JWT)
    N->>B: Set-Cookie (httpOnly session)
    B->>N: GET /today (with cookie)
    N->>S: auth.getUser() via SSR cookies
    S-->>N: user object
    N->>DB: fetch user data (RLS: user.id)
    N-->>B: Today page rendered
```

The `(app)/layout.tsx` runs `auth.getUser()` on every request to the protected shell. Unauthenticated requests are redirected to `/login`. The middleware (`src/lib/supabase/middleware.ts`) refreshes the session cookie but does NOT enforce route protection — that is each page's responsibility.

---

## Coursework flow

```mermaid
sequenceDiagram
    participant U as User
    participant C as Browser (Client)
    participant A as Server Action
    participant DB as Postgres
    participant AI as Gemini

    U->>C: Select file & click Upload
    C->>A: uploadCourseworkAction(FormData)
    A->>A: Validate file type + size (≤5MB)
    A->>DB: INSERT coursework_items (status=processing)
    A->>AI: generateObject(CourseworkExtractedSchema, file)
    Note over A,AI: ~5–20s latency
    alt Extraction succeeds
        AI-->>A: title, topics, definitions, keyFacts…
        A->>DB: UPDATE status=ready, extracted=…
        A-->>C: { ok:true, item }
        C-->>U: Coursework appears in library
    else Extraction fails
        AI-->>A: error
        A->>DB: UPDATE status=failed, error_message=…
        A->>DB: INSERT app_errors (error_type=coursework_upload)
        A-->>C: { ok:false, error message }
        C-->>U: Error toast shown
    end
```

---

## Practice flow

```mermaid
sequenceDiagram
    participant U as User
    participant C as Browser
    participant A as Server Action
    participant DB as Postgres
    participant AI as Gemini

    U->>C: Click "Start practice" on coursework item
    C->>A: startPracticeAction(courseworkItemId)
    A->>DB: SELECT coursework_items (verify ready + owned)
    A->>AI: generateObject(PracticeQuestionSchema, extracted)
    AI-->>A: { questionText, questionType, expectedAnswer, … }
    A->>DB: INSERT practice_sessions (status=active, current_question)
    A-->>C: { ok:true, state: { sessionId, question, … } }
    C-->>U: Question displayed

    loop Up to 10 questions
        U->>C: Type answer + submit
        C->>A: submitAnswerAction(sessionId, answer, timeMs)
        A->>DB: SELECT practice_sessions (verify owned)
        A->>AI: generateObject(AnswerEvaluationSchema)
        AI-->>A: { isCorrect, feedback }
        A->>DB: INSERT practice_attempts
        A->>DB: UPSERT topic_mastery (if topic_id set)
        A->>AI: generateObject(PracticeQuestionSchema) — next question
        A->>DB: UPDATE practice_sessions (next question, counters)
        A-->>C: { ok:true, isCorrect, feedback, nextQuestion }
        C-->>U: Feedback + next question shown
    end

    A->>DB: UPDATE practice_sessions (status=completed)
    C-->>U: Summary screen
```

---

## Plan generation flow

```mermaid
sequenceDiagram
    participant U as User
    participant C as Browser
    participant A as Server Action
    participant DB as Postgres
    participant AI as Gemini

    U->>C: Complete onboarding / request re-plan
    C->>A: generatePlanAction() or rePlanForUser()
    A->>DB: SELECT profiles, subjects, topics, sessions
    A->>A: Build PlanInput (subjects, exams, availability, tz)
    A->>AI: generateObject(PlanSchema)
    Note over A,AI: D9: one retry on schema failure
    AI-->>A: { sessions: [ { starts_at, topic_id, duration, instruction } ] }
    A->>A: checkPlanFeasibility()
    A->>DB: Deactivate old plan, DELETE future sessions
    A->>DB: INSERT plans, INSERT sessions (bulk)
    A-->>C: { ok:true, sessionCount, warnings }
    C->>C: router.refresh()
    C-->>U: Today page shows new plan
```

---

## AI coach flow

```mermaid
sequenceDiagram
    participant U as User
    participant C as Browser (chat.tsx)
    participant A as Server Action (coach.ts)
    participant DB as Postgres
    participant AI as Gemini

    U->>C: Type message
    C->>A: sendCoachMessageAction(message, history)
    A->>DB: SELECT profile, subjects, recent sessions, topic_mastery
    A->>A: Build context (weak topics, upcoming exams, etc.)
    A->>AI: generateText(system prompt + context + history)
    AI-->>A: assistant reply
    A-->>C: { ok:true, reply }
    C-->>U: Reply shown in chat
```

---

## Latency analysis

All times are estimates based on provider documentation and typical observed ranges. Nothing here is confirmed by measurement.

| Operation | Estimated latency | Source |
|---|---|---|
| Supabase query (simple SELECT) | 10–80ms | Postgres + PostgREST round-trip, eu region |
| Supabase query (JOIN, 100 rows) | 50–200ms | Same |
| Gemini plan generation | 8–25s | Schema-validated `generateObject`, complex prompt |
| Gemini coursework extraction | 5–20s | Multi-modal (image/PDF) prompt |
| Gemini question generation | 2–6s | Single question, small prompt |
| Gemini answer evaluation | 2–6s | Same |
| Gemini coach reply | 2–8s | Conversational with context |
| Vercel cold start (Node.js) | 200–800ms | First request after idle |

**Key bottleneck (hypothesis):** Plan generation and coursework extraction are the two longest-latency operations. Both block the user's request thread. The re-plan race condition (M3 from security audit) could amplify this — if two plan operations fire simultaneously (e.g., mark-missed + settings save), both may succeed at the DB level but produce inconsistent session sets. This is a known architectural limitation of using PostgREST without server-side transactions.

**Geographic note:** Supabase project region is assumed to be the nearest region to the Vercel deployment (both likely US or EU). If they are in different regions, add ~50–100ms per Supabase call. This is unconfirmed.

---

## Environment variables

| Variable | Used in | Notes |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | server + client | Public — anon Supabase URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | server + client | Public — anon key for RLS reads |
| `SUPABASE_SERVICE_ROLE_KEY` | server only | Bypasses RLS; never sent to browser |
| `GOOGLE_GENERATIVE_AI_API_KEY` | server only | Gemini API key; never sent to browser |
| `ADMIN_EMAILS` | server only | Comma-separated admin allowlist |

The service-role key is used in two places: `createServiceClient()` in `src/lib/supabase/service.ts` (admin stats dashboard + error logging) and the admin clear-errors action. It is never imported by any client component.

---

## What is intentionally NOT in the architecture

- No microservices — one Next.js deployment
- No message queue or background worker
- No caching layer beyond Next.js defaults
- No WebSockets or realtime features
- No feature flags
- No third-party analytics or ads
- No native mobile
- No rate limiting (D19 — deferred; Gemini free-tier limits provide a natural backstop)

---

## Known architectural risks

| Risk | Severity | Status |
|---|---|---|
| Re-plan race condition — two concurrent mutations can leave zero sessions | Medium | Document/Monitor — can't fix without server-side transactions via PostgREST |
| No middleware-level route protection — a page that forgets `getUser()` is unprotected | Low | Document — all current pages check auth; enforce in code review |
| `SUPABASE_SERVICE_ROLE_KEY` missing at runtime causes admin 500 | High | Mitigated — now wrapped in try/catch; diagnostic logging added |
| Gemini free-tier rate limits (~15 rpm) block concurrent users | Medium | Monitor — acceptable at prototype scale |
