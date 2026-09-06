# Implementation Report: Features 1–6

## Summary

All six features are fully implemented. TypeScript, ESLint, and the test suite all pass. The production build succeeds.

---

## Feature 1 — Age-Based UI Personalization

**Status: Complete**

### Files changed
- `src/lib/personalization/age-band.ts` (new) — config per `age_band` value
- `src/app/(app)/today/page.tsx` — greeting uses `ageBandUI.greeting(name)`
- `src/app/study/[sessionId]/page.tsx` — fetches `age_band`, passes to `StudySession`
- `src/app/study/[sessionId]/study-session.tsx` — completion overlay and welcome-back banner use age-band copy

### Behaviour
| `age_band` | Greeting | Completion message |
|---|---|---|
| `junior` | "Hey {name}! Ready to go?" | "Brilliant work, {name}! 🌟" |
| `intermediate` | "Hello {name}, let's get going." | "Great session, {name}! Keep it up." |
| `senior` | "Good to see you, {name}." | "Well done, {name}. Solid progress." |
| `university` | "Hi {name}." | "Done. Good work." |
| `adult` | "Welcome back, {name}." | "Session complete." |

Falls back to a neutral greeting/message when `age_band` is null or unrecognised.

---

## Feature 2 — Google Sign-In

**Status: Complete**

### Files changed
- `src/lib/supabase/browser.ts` (new) — `createBrowserSupabaseClient()`
- `src/components/auth/google-sign-in-button.tsx` (new) — "Continue with Google" button
- `src/app/auth/callback/route.ts` (new) — OAuth callback route; populates `first_name` from Google metadata
- `src/app/login/login-form.tsx` — button added
- `src/app/signup/signup-form.tsx` — button added

### Manual setup required
See [docs/google-oauth-setup.md](./google-oauth-setup.md) — specifically Steps 2–6 for Supabase dashboard configuration.

### Limitations
- The button is visible immediately but will silently fail without `NEXT_PUBLIC_GOOGLE_CLIENT_ID` configured in Supabase Auth.
- Profile `first_name` is populated from `given_name` in Google metadata only on first login (when `first_name IS NULL`).

---

## Feature 3 — Upload Study Material from Google Drive

**Status: Complete**

### Files changed
- `src/server/actions/drive.ts` (new) — `importFromDriveAction()`; downloads file using short-lived token; never stores token
- `src/components/coursework/drive-import-button.tsx` (new) — loads `apis.google.com/js/api.js` + GIS on first click; opens Picker; calls server action on pick
- `src/app/(app)/coursework/upload-form.tsx` — `DriveImportButton` added below the upload button

### Supported file types
JPEG, PNG, WebP, GIF, PDF, plain text, Google Docs (exported as plain text), Google Sheets (exported as CSV), Google Slides (exported as plain text). Max 5 MB.

### Requires
- `NEXT_PUBLIC_GOOGLE_CLIENT_ID`
- `NEXT_PUBLIC_GOOGLE_API_KEY` (restricted to Picker API)

The button is hidden when either variable is absent.

---

## Feature 4 — Google Calendar + Intelligent Scheduling

**Status: Complete**

### Files changed
- `supabase/migrations/0010_google_connections.sql` (new) — `google_connections` table with RLS
- `src/server/actions/google-calendar.ts` (new) — status, disconnect, token refresh, `fetchCalendarBusyPeriods`
- `src/app/api/google/calendar/auth/route.ts` (new) — initiates OAuth
- `src/app/api/google/calendar/callback/route.ts` (new) — exchanges code, upserts to `google_connections`
- `src/server/llm/schema.ts` — `calendarBusyPeriods` added to `PlanInput`
- `src/server/llm/prompt.ts` — busy periods formatted and injected into prompt; rule 8 added
- `src/server/actions/plan.ts` — `buildPlanInput` fetches busy periods (60-day window) before generating
- `src/app/(app)/settings/google-calendar-section.tsx` (new) — connect/disconnect UI
- `src/app/(app)/settings/page.tsx` — renders `GoogleCalendarSection`; URL feedback toasts

### Token security
- Refresh tokens stored in `google_connections` (service-role only write path).
- `getValidAccessToken` is server-only (not a server action), so it is never callable from the browser.
- Tokens are never logged. Refresh happens server-side, silently.

### Requires
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`
- `NEXT_PUBLIC_SITE_URL`
- DB migration applied

---

## Feature 5 — Clear Past Exams

**Status: Complete**

### Files changed
- `src/server/actions/subjects.ts` — `deletePassedExamsAction()` added (NULLs `exam_date`, does not delete subjects or sessions)
- `src/components/plan/clear-past-exams-button.tsx` (new) — idle → confirm dialog → result
- `src/app/(app)/plan/page.tsx` — count query for past exams added; `ClearPastExamsButton` rendered in header

### Design decision
`exam_date` is set to `NULL` rather than deleting subjects, so all study history (sessions, topics) is preserved. Subjects with `exam_date = NULL` are still scheduled based on tasks and difficulty.

---

## Feature 6 — Focus Mode

**Status: Complete**

### Files changed
- `src/lib/personalization/age-band.ts` — `welcomeBack` string per band
- `src/app/study/[sessionId]/study-session.tsx` — full rewrite of session UX:
  - `beforeunload` warning when session is running
  - Tab visibility tracking: increments `focusLossCount`; shows "Welcome back" banner for 3 s on return
  - "Focus mode" toggle button → `requestFullscreen()` / `exitFullscreen()`
  - `fullscreenchange` listener to sync state when user presses Esc
  - Focus loss count display (shown when > 0, running or paused)

### Limitations
- Fullscreen requires a user gesture; the toggle button provides that.
- `beforeunload` dialogs are suppressed by some browsers on mobile.
- `document.documentElement.requestFullscreen()` is not supported in all browser environments (Safari requires a prefix; falls back silently).

---

## Migrations

| File | Purpose |
|---|---|
| `supabase/migrations/0010_google_connections.sql` | `google_connections` table, RLS, updated_at trigger |

Run with `npx supabase db push` or apply via the Supabase dashboard.

---

## Environment variables added

| Variable | Visibility | Purpose |
|---|---|---|
| `NEXT_PUBLIC_GOOGLE_CLIENT_ID` | Public | Google Sign-In + Drive Picker |
| `NEXT_PUBLIC_GOOGLE_API_KEY` | Public | Drive Picker API |
| `GOOGLE_CLIENT_ID` | Server | Calendar OAuth |
| `GOOGLE_CLIENT_SECRET` | Server | Calendar token exchange + refresh |
| `NEXT_PUBLIC_SITE_URL` | Public | OAuth redirect URI base |

---

## Test results

```
Test Files  34 passed (34)
Tests       420 passed (420)
```

All pre-existing tests pass. New server actions were not unit-tested because they require live Supabase + Google API credentials (integration concerns, not unit logic).

---

## Build

```
✓ Compiled successfully in 9.0s
✓ Generating static pages (20/20)
```

No TypeScript errors. No ESLint warnings.

---

## Manual testing checklist

### Feature 1
- [ ] Sign in as a user with `age_band = junior` — verify "Hey {name}! Ready to go?" greeting on `/today`
- [ ] Complete a study session — verify completion overlay uses age-band copy
- [ ] Switch to a different `age_band` in DB — verify all copy updates

### Feature 2
- [ ] Click "Continue with Google" on `/login` — redirects to Google
- [ ] Complete Google sign-in — redirected to `/today`
- [ ] Check profile has `first_name` populated from Google
- [ ] Sign in with Google on `/signup` — works the same way

### Feature 3
- [ ] Go to `/coursework/upload` — "Import from Drive" button appears
- [ ] Click it — Google Picker opens
- [ ] Select a PDF — uploads and appears in the coursework list
- [ ] Select a Google Doc — uploaded as text
- [ ] Try a file > 5 MB — error message shown

### Feature 4
- [ ] Go to `/settings` — Google Calendar section shows "Not connected"
- [ ] Click "Connect" — redirects to Google OAuth
- [ ] Approve — redirected back to `/settings?connected=google_calendar` with success banner
- [ ] Trigger a re-plan — observe that busy periods from the calendar are in the Gemini prompt
- [ ] Click "Disconnect" — section resets to "Not connected"

### Feature 5
- [ ] Have a subject with an exam date in the past
- [ ] Go to `/plan` — "Clear past exams" button appears in header
- [ ] Click it — confirm dialog appears
- [ ] Confirm — past exam dates cleared; button disappears
- [ ] Verify subjects and their sessions still exist

### Feature 6
- [ ] Start a study session — open a new tab mid-session — observe `beforeunload` dialog
- [ ] Switch away and back — "Welcome back" banner appears; focus loss count increments
- [ ] Click "Focus mode" — fullscreen activates
- [ ] Press Esc — fullscreen exits; button resets to "Focus mode"
- [ ] Complete the session — age-band completion overlay appears
