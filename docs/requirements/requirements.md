# REQUIREMENTS.md

## Functional requirements

Numbered so they can be referenced in PRs, tests, and issues.

### F1. Landing page
- F1.1 Public page explains what the app does in under 60 seconds of reading.
- F1.2 Provides a call to action to sign up or log in.

### F2. Auth
- F2.1 User can sign up with **first name**, email, and password.
- F2.2 An age gate at signup requires the user to confirm they are 13 or older.
- F2.3 User can log in and log out.
- F2.4 Session persists across browser reloads until explicit logout.
- F2.5 The client detects the user's IANA timezone (`Intl.DateTimeFormat().resolvedOptions().timeZone`) and sends it to the server at signup. No timezone question is shown to the user.

### F3. Onboarding wizard (5 steps + review)
The wizard replaces the one-form onboarding. Progress indicator and "Save & Exit" appear on every step. **Back** is disabled on step 1.
- F3.1 **Step 1 — Subjects**: student adds one or more subject names (soft-pill chips, add/remove).
- F3.2 **Step 2 — Topics**: student adds one or more topics per subject. **No difficulty rating.**
- F3.3 **Step 3 — Exam date**: student sets an optional exam or deadline date per subject. At least one subject must have a date for a plan to be generated.
- F3.4 **Step 4 — Availability**: student defines availability as **time windows** per day of week. Each window is a `HH:MM` start and `HH:MM` end. Zero or more windows per day. Windows may not overlap on the same day.
- F3.5 **Step 5 — Session length**: student picks **25**, **45**, or **60** minutes.
- F3.6 **Review**: displays the collected inputs with per-section Edit links. Final button "Create my plan" triggers F4.
- F3.7 All inputs are validated before submitting each step.

### F4. AI plan generation
- F4.1 On Create my plan, the app calls an LLM through a validated schema to produce a plan.
- F4.2 The plan consists of sessions between "today" and the latest exam date.
- F4.3 Each session has: date, start time (in user's timezone), duration in minutes (equal to the chosen session length), subject, topic, and a short instruction (e.g. "Review", "Practice problems").
- F4.4 Sessions must fall inside the user's availability windows and never span two windows.
- F4.5 A short implicit break exists between consecutive sessions on the same day (not stored as a row).
- F4.6 If the LLM output fails schema validation, retry once; if it still fails, show a clear error and preserve the user's inputs.

### F5. Today's dashboard
- F5.1 On login, the student sees today's sessions only, in chronological order.
- F5.2 Each session card shows subject, topic, time slot, instruction, and status accent bar (In Progress / Upcoming / Completed / Missed / Adjusted).
- F5.3 Each session has two actions: **Complete** and **Missed**.
- F5.4 A session card can be opened as a **Study Session** (F10).

### F6. Complete / Missed a session
- F6.1 Marking a session **Complete** records `completed_at` and does not re-plan.
- F6.2 Marking a session **Missed** triggers adaptive re-planning (see F7).
- F6.3 Actions are idempotent; re-marking the same session does nothing.

### F7. Adaptive re-planning
- F7.1 When a session is marked Missed OR the user updates availability, subjects, or topics, the app regenerates all *future* sessions from the current moment onward.
- F7.2 Completed sessions are never modified.
- F7.3 The regeneration preserves the same subjects, topics, and exam dates.
- F7.4 The regenerated plan must still fit within the user's remaining availability up to each exam date.
- F7.5 If a topic can no longer fit before its exam date, the app surfaces a warning to the user (does not silently drop it).
- F7.6 The **Session Missed** and **Plan Updated** states are shown as overlays within `/today`, not separate routes.

### F8. Full plan view
- F8.1 A separate view lists all upcoming (non-completed) sessions grouped by day.
- F8.2 Past completed and missed sessions are visible but visually distinct.

### F9. Update availability
- F9.1 The user can edit availability windows at any time from Settings.
- F9.2 Saving new availability triggers F7 (adaptive re-plan).

### F10. Study Session timer
- F10.1 Opening a scheduled session from `/today` navigates to a focused study screen for that session.
- F10.2 The screen shows subject, topic, instruction, and a countdown timer initialized to the session's duration.
- F10.3 Actions: **Start**, **Pause**, **Resume**, **Finish**. On Finish (or when the timer reaches zero), the user is prompted to choose **Complete** or **Missed**.
- F10.4 Choosing Complete performs F6.1. Choosing Missed performs F6.2.
- F10.5 The **Session Complete** state is shown as an in-page overlay/screen with "Next up" and returns the user to `/today`.
- F10.6 The timer is client-side; server does not persist timer state (pause/elapsed). Leaving the screen and returning resets the timer.

### F11. Subjects page
- F11.1 A dedicated page lets the user add, edit, and remove subjects, topics, and exam dates.
- F11.2 Saving changes triggers F7 (adaptive re-plan).

### F12. Delete account
- F12.1 From Settings, the user can delete their account.
- F12.2 A confirmation dialog is required.
- F12.3 On confirm, all user data is deleted; user is logged out and redirected to `/`.

## Non-functional requirements

### N1. Performance
- N1.1 First plan generation should return within 20 seconds under normal LLM conditions.
- N1.2 Dashboard load (post-auth) should be under 2 seconds.

### N2. Security
- N2.1 No secrets in client-side code.
- N2.2 All API routes require authenticated session unless explicitly public (F1, F2 signup/login).
- N2.3 Users can only read and write their own data (Row Level Security).
- N2.4 Passwords are never stored by us — delegated to Supabase Auth.

### N3. Privacy
- N3.1 No third-party analytics, ads, or behavioural SDKs.
- N3.2 No notifications and no search features in the MVP.
- N3.3 Data collected is limited to what is required to generate and adapt plans and greet the user (first name).
- N3.4 A user can delete their account and all their data from settings.

### N4. Reliability
- N4.1 LLM failures do not crash the app — always show a recoverable error.
- N4.2 No unrecoverable data loss on save operations.

### N5. Accessibility (baseline for MVP)
- N5.1 Keyboard-navigable primary flows (signup, wizard, dashboard actions, study session).
- N5.2 Adequate colour contrast on text (see DESIGN-SPEC.md §6).
- N5.3 Reduced-motion respect: animations (Session Missed shift, loading spinner) gated behind `prefers-reduced-motion`.
- N5.4 Status must not rely on colour alone — accompanied by text labels.

### N6. Cost & simplicity
- N6.1 The stack must be operable by a single beginner/intermediate developer.
- N6.2 Total infrastructure cost stays at $0 during prototype (see [COST.md](../technical/cost-and-stack-audit.md)).

## Out of scope for MVP

Anything not in F1–F12 or N1–N6. Deferred items live in [PRODUCT.md](./product-scope.md) under "not solving."
