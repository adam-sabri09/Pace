# API.md

## Shape of the API

We do not build a REST or GraphQL API. All server interactions happen through **Next.js server actions** invoked from Server Components or client forms. This keeps the surface small and typed end-to-end.

Every server action:
1. Verifies an authenticated Supabase session (except public actions, which do not exist yet).
2. Validates its input with a Zod schema.
3. Performs its work and returns a typed result.
4. Returns a discriminated union `{ ok: true; data: T } | { ok: false; error: string }` — no throwing to the client.

## Server actions (contracts)

Signatures below are the source of truth. Types live in `src/server/actions/*` and `src/lib/types.ts`.

### `auth.signUp(input)`
- **Input**: `{ email: string; password: string; ageConfirmed13Plus: true }`
- **Effect**: Creates a Supabase Auth user + inserts a matching `profiles` row.
- **Output**: `{ ok: true } | { ok: false; error }`.
- **Requires session**: no.

### `auth.logIn(input)`
- **Input**: `{ email; password }`
- **Effect**: Establishes session cookie.
- **Requires session**: no.

### `auth.logOut()`
- Clears session cookie.
- **Requires session**: yes.

### `plan.generate(input)`
- **Input** (`PlanInput`):
  ```
  {
    subjects: [{
      name: string;
      examDate: string | null;      // ISO date, no time
      topics: [{ name: string; difficulty: 1|2|3 }];
    }];
    availability: [{ dayOfWeek: 0..6; minutes: 0..1440 }];
    sessionLengthMinutes: 30 | 45 | 60;
    timeZone: string;               // IANA, e.g. "Europe/Amsterdam"
  }
  ```
- **Effect**:
  1. Validate input.
  2. Persist subjects, topics, availability, session length.
  3. Call the LLM with a `PlanOutput` schema.
  4. Persist a new active `plan` row and its `sessions` (deactivate any prior active plan for the user).
- **Output**: `{ ok: true; data: { planId: string } }` or an error.
- **Requires session**: yes.

### `plan.rePlan(input?)`
- **Input**: `{ reason: "skip" | "availability_change" | "subjects_change" }` (used only for logging/telemetry — no telemetry in MVP, so effectively unused; kept for future).
- **Effect**:
  1. Load user's current `PlanInput` state, completed sessions, and "now" in user's timezone.
  2. Call the LLM with `PlanOutput` schema, constrained to the remaining time window.
  3. In a single transaction, delete future scheduled sessions and insert the new ones; update `plans.last_replanned_at`.
- **Output**: `{ ok: true; data: { warnings: Warning[] } }` where warnings list any topic that could not fit before its exam.
- **Requires session**: yes.

### `sessions.markDone(input)`
- **Input**: `{ sessionId: string }`
- **Effect**: Sets `status = "completed"`, `completed_at = now()`. No re-plan.
- **Idempotent**: re-calling on a completed session is a no-op.

### `sessions.markSkipped(input)`
- **Input**: `{ sessionId: string }`
- **Effect**: Sets `status = "skipped"`, then calls `plan.rePlan({ reason: "skip" })`.
- **Idempotent**.

### `availability.update(input)`
- **Input**: `{ availability: [{ dayOfWeek; minutes }]; sessionLengthMinutes? }`
- **Effect**: Upsert availability rows. Triggers `plan.rePlan({ reason: "availability_change" })`.

### `subjects.update(input)`
- **Input**: same shape as `subjects` in `PlanInput`.
- **Effect**: Replace subjects/topics for the user. Triggers `plan.rePlan({ reason: "subjects_change" })`.

### `account.deleteMe()`
- **Effect**: Deletes the user's `auth.users` row; cascading deletes remove all owned data.
- **Requires session**: yes.

### `personalization.save(_prev, answers)`
- **Input**: `PersonalizationAnswers` (all 6 fields: ageGroup, focusBand, studyHabit, studyChallenge, studyGoal, memoryRating). Zod-validated.
- **Effect**: Saves answers and age_group to `profiles`, sets `personalization_completed_at = now()`, clears `personalization_skipped`. Redirects to `/today` on success.
- **Output**: `{ ok: false; error: string } | null` (null on redirect).
- **Requires session**: yes.

### `personalization.skip()`
- **Input**: none.
- **Effect**: Sets `profiles.personalization_skipped = true`. No redirect (caller handles UI state).
- **Requires session**: yes (silently no-ops if not authenticated).

### `subjects.updateIntelligence(subjectId, difficulty, confidencePct)`
- **Input**: `{ subjectId: UUID; difficulty: "easy"|"medium"|"hard"|null; confidencePct: 0..100|null }`.
- **Effect**: Updates `subjects.difficulty` and `subjects.confidence_pct` for the given subject (scoped to `user_id`). Does not trigger re-planning.
- **Output**: `{ ok: true } | { ok: false; error }`.
- **Requires session**: yes.

### `ocr.extractSchedule(formData)`
- **Input**: `FormData` with key `schedule` (File, max 5 MB, JPEG/PNG/WebP/GIF/PDF).
- **Effect**: Sends image to Gemini 2.0 Flash with vision prompt. Extracts subjects, exam dates, and topics. Does **not** save anything.
- **Output**: `{ ok: true; extracted: { subjects: [{ name, examDate, topics }] } } | { ok: false; error }`.
- **Requires session**: yes.

### `ocr.saveSubjects(subjects)`
- **Input**: Array of confirmed subjects `[{ name, examDate, topics[], difficulty, confidencePct }]`, Zod-validated.
- **Effect**: Deletes all existing subjects (topics cascade), inserts new subjects + topics, triggers `rePlanForUser`.
- **Output**: `{ ok: true } | { ok: false; error }`.
- **Requires session**: yes. Requires onboarding to be complete.

## LLM I/O contract

Both directions are Zod-validated. LLM never sees the raw user session — only the prompt.

**LLM input** (built server-side from `PlanInput` + optional `alreadyCompletedSessions`):
- Same shape as `PlanInput` plus a `now` timestamp and a list of completed sessions (subject/topic/duration) so the LLM avoids re-scheduling completed work.

**LLM output** (`PlanOutput` schema):
```
{
  sessions: [{
    startsAt: string;              // ISO datetime in the user's tz
    durationMinutes: number;       // must match sessionLengthMinutes
    subjectName: string;           // must match one of the input subjects
    topicName: string;             // must match one of that subject's topics
    instruction: string;           // short, <= 60 chars
  }];
  warnings: [{
    subjectName: string;
    topicName: string;
    message: string;               // e.g. "Insufficient time before exam"
  }];
}
```

Validation on the server:
- Every `subjectName`/`topicName` must map back to a real subject/topic the user submitted.
- No session may overlap another session (server checks after parsing).
- No session may fall outside the user's availability for that day of week.
- On any validation failure: retry the LLM once with a corrective addendum; if it still fails, return `{ ok: false; error }` and leave DB untouched.

## Error contract

Server actions never throw across the boundary. All errors return `{ ok: false; error: string }` where `error` is a human-readable message safe to display. Errors that hint at internal issues (LLM 500, DB error) are logged server-side but not exposed verbatim.

## Rate limiting

None in the MVP. Traffic is expected to be a handful of test users. Deferred.
