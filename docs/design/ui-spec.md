# UI.md

Visual source of truth: [DESIGN-SPEC.md](./design-spec.md) (derived from the approved Stitch export).

## Pages in the MVP

Only these. Nothing else.

| Path | Access | Purpose | Route file |
|---|---|---|---|
| `/` | Public | Landing page; one CTA to signup | `src/app/page.tsx` |
| `/login` | Public | Email + password login | `src/app/login/page.tsx` |
| `/signup` | Public | First name + email + password + 13+ age check | `src/app/signup/page.tsx` |
| `/onboarding` | Authenticated (no plan yet) | 5-step wizard + Review | `src/app/onboarding/page.tsx` |
| `/today` | Authenticated | Today's sessions; Complete / Missed actions; in-page overlays for Session Missed, Plan Updated, Session Complete | `src/app/today/page.tsx` |
| `/plan` | Authenticated | Full upcoming plan by day | `src/app/plan/page.tsx` |
| `/subjects` | Authenticated | Manage subjects, topics, and exam dates | `src/app/subjects/page.tsx` |
| `/study/[sessionId]` | Authenticated | Focused study session with timer | `src/app/study/[sessionId]/page.tsx` |
| `/settings` | Authenticated | Availability, session length, delete account, log out | `src/app/settings/page.tsx` |

Auth-gated pages redirect to `/login` when the user is not signed in. `/onboarding` redirects to `/today` if an active plan already exists.

## Component library

`shadcn/ui` (Radix + Tailwind), themed to the Pace tokens from DESIGN-SPEC.md. Custom app components live in `src/components/app/` (session card, timeline, nav shells, wizard chrome). Add components only when strictly needed for the MVP.

## Visual style

All colour, typography, spacing, radius, borders, icons, and component rules are defined in [DESIGN-SPEC.md](./design-spec.md). Implementation must reproduce the Stitch design as closely as reasonably possible.

Nav shells:
- **Desktop (≥ md)**: left `w-64` fixed side nav with items **Today · Plan · Subjects · Settings**.
- **Mobile (< md)**: fixed bottom nav with the same 4 items + a top app bar with the logo only.
- No notification or search icons in the MVP.
- Focus screens (Study Session, Onboarding steps, Session Missed / Plan Updated / Session Complete overlays) suppress the nav shell.

## Landing page

Per DESIGN-SPEC.md §3.1. Above the fold: name, one-sentence pitch, Get Started CTA. Below: Method grid (Plan / Study / Complete-Miss / Adapt). Footer with Privacy / Terms / Support links (placeholder pages, static copy).

## Auth screens (Login and Signup)

Not present in the Stitch export. Implement in the Pace visual language:
- Centered `max-w-md` column, no nav shell.
- Logo top, headline, short subheading.
- Bottom-border inputs per DESIGN-SPEC.md §2.4.
- Signup fields: **First name**, **Email**, **Password**, and a checkbox "I am 13 or older" (required).
- Primary button per DESIGN-SPEC.md §2.1 ("Get Started" or "Log In").
- Small text link at the bottom for the opposite action ("Already have an account? Log in").

## Onboarding wizard

Per DESIGN-SPEC.md §3.10 chrome. 5 steps + Review. Fixed bottom action bar with Back / Continue. Progress indicator "Step N of 5". Step 5 button becomes **Create my plan** and shows a "Building your plan…" loading state on submit (reuse the state card from §3.11 loading variant).

## /today dashboard

Per DESIGN-SPEC.md §3.2 (desktop) and §3.12 (mobile). First-name greeting on mobile ("Good Morning, {firstName}"). Warning banner (F7.5) at the top when applicable. Session cards with **Complete** and **Missed** actions.

In-page overlays triggered from within `/today` (no route change):
- **Session Missed** overlay — DESIGN-SPEC.md §3.4.
- **Plan Updated** overlay — DESIGN-SPEC.md §3.5.
- **Session Complete** overlay — DESIGN-SPEC.md §3.7 (also reachable from the Study Session screen).

## /plan view

Per DESIGN-SPEC.md §3.8. Timeline cards grouped by day.

## /subjects

Manage subjects, topics, and exam dates. Reuse the wizard's Step 1–3 components (subject chips, topic list per subject, calendar per subject). No difficulty. Saving triggers re-plan.

## /study/[sessionId]

Per DESIGN-SPEC.md §3.6 (desktop) and §3.13 (mobile). Timer initialised to the session's `duration_minutes`. Buttons per F10.3. On Finish, prompt Complete / Missed. Choosing Complete opens the Session Complete overlay (§3.7); choosing Missed opens Session Missed → Plan Updated overlays.

## /settings

Per DESIGN-SPEC.md §3.9, with removals:
- **Account** section (email, password).
- **Study Availability** section with the time-window editor (opens an inline editor of the same shape as wizard Step 4).
- **Study Preferences** — Default Session Length radios: **25 / 45 / 60**.
- **Danger zone** — Delete account with confirmation dialog.
- **Removed**: Focus Mode Auto-Start toggle and Data Analytics toggle.

## Errors and empty states

- Every failure mode has a human-readable message. No raw error codes shown to the user.
- LLM failure on plan generation keeps the wizard inputs intact and offers a **Try again** button (reuse the state card error variant, §3.11).
- Network failures show a toast (style improvised: `bg-inverse-surface text-inverse-on-surface rounded-lg shadow-sm`).
- Empty states use the state card (§2.18).

## Out of UI scope (do not build)

- Marketing pages beyond the landing page.
- Onboarding tour / product tour.
- Rich text editing.
- Charts or graphs.
- Calendar sync UI.
- Any "parent view" or "teacher view".
- Any social sharing UI.
- Push notification or email preference UI.
- Notifications bell or global search icon.
- Focus Mode Auto-Start toggle.
- Data Analytics / share-data toggle.
- Dark mode variants (deferred).
