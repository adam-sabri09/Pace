# USER-FLOWS.md

Only the flows in the MVP. Each is described as a sequence of user actions and system responses.

## Flow 1: First-time signup and onboarding wizard

1. Student lands on `/` (landing).
2. Clicks **Get Started**.
3. On `/signup`: enters **first name**, email, password. Confirms "I am 13 or older". Client detects and sends IANA timezone silently.
4. Redirected to `/onboarding` (5-step wizard).
5. **Step 1 — Subjects**: adds one or more subjects.
6. **Step 2 — Topics**: adds topics per subject. No difficulty.
7. **Step 3 — Exam date**: sets exam/target date per subject (optional per subject; at least one required overall).
8. **Step 4 — Availability**: adds time windows per weekday (e.g. Mon 16:00–19:00). Multiple windows per day allowed; no overlaps.
9. **Step 5 — Session length**: picks 25 / 45 / 60.
10. **Review**: confirms inputs, taps **Create my plan**.
11. Loading state (up to ~20s).
12. On success, redirected to `/today`.

## Flow 2: Daily use (returning student)

1. Student opens the app (already logged in) → lands on `/today`.
2. Sees today's sessions in chronological order, greeted by first name ("Good Morning, Alex").
3. For each session, taps **Complete** on the session card, OR opens the session for a focused study workflow (Flow 8).
4. If they cannot do a session, taps **Missed** — the **Session Missed** in-page overlay appears while the plan re-plans, then transitions to the **Plan Updated** overlay summarizing changes, then returns to the refreshed `/today` view.

## Flow 3: View the full plan

1. From `/today`, taps **Plan** in the nav.
2. Sees upcoming sessions grouped by day, up to the last exam date.
3. Past completed and missed sessions visible but visually distinct.
4. Navigates back to `/today`.

## Flow 4: Update availability

1. From any page, taps **Settings**.
2. Edits time windows per day.
3. Taps **Save**.
4. Confirmation appears; the plan re-plans in the background.
5. Returns to `/today` (updated).

## Flow 5: Manage subjects and topics

1. From nav, taps **Subjects** (`/subjects`).
2. Adds, edits, or removes subjects, topics, or exam dates.
3. Taps **Save**.
4. Plan is regenerated from the current time forward. Completed sessions are preserved.

## Flow 6: Warning when a topic no longer fits

1. During any re-plan, if a topic cannot fit before its exam date given remaining availability, a non-blocking warning appears at the top of `/today` and `/plan`.
2. The warning tells the user which topic is at risk and suggests either adding availability or shortening the topic list.
3. The user can dismiss the warning; it reappears on the next re-plan if still unresolved.

## Flow 7: Delete account

1. From **Settings** → **Delete account**.
2. Confirmation dialog.
3. On confirm, all user data is deleted; user is logged out and redirected to `/`.

## Flow 8: Study Session with timer

1. From `/today`, the student taps a session card → navigates to `/study/[sessionId]` (or an equivalent focus route).
2. The screen shows subject chip, topic title, instruction, and the countdown timer initialised to the session's duration (e.g. 45:00).
3. Taps **Start Session** — timer begins counting down; buttons switch to **Pause** and **Finish**. Also visible: a "Mark as missed" text link.
4. May tap **Pause** — timer halts; button toggles to **Resume**.
5. On **Finish** or when the timer reaches zero, the student is prompted to choose **Complete** or **Missed**.
   - **Complete** → **Session Complete** in-page state showing "Next up" and buttons **Continue** / **View today's plan**.
   - **Missed** → follows the Missed branch of Flow 2 (Session Missed → Plan Updated → back to `/today`).
6. Closing the timer screen mid-session returns the user to `/today` with the session still `scheduled`. Timer state is not persisted.

## Explicit non-flows

Not in the MVP:
- Parent accounts, sharing, or observing another user's plan.
- Notifications (push/email/SMS) or search.
- LMS import (Google Classroom / Canvas).
- Syllabus PDF/photo upload.
- Payments / subscription flows.
- Content generation (flashcards, summaries, quizzes).
- Analytics or "share data" toggles.
- Focus Mode Auto-Start or complex Pomodoro cycles.
