# PRODUCT.md

## Product name

Pace.

## One-line pitch

An AI study planner for high school students that automatically rebuilds itself when life gets in the way.

## Who it is for

High school students (roughly ages 14–18). One user type. No parent view, no teacher view, no institutional buyer in the MVP.

## Problem we are solving

High school students know what they need to study but struggle to decide what to do first, how long each task should take, and how to catch up when they miss a session. Existing planners are static — miss a day and the plan is broken until the student rebuilds it manually. Most students give up and revert to no plan at all.

The MVP focuses on one specific pain: **when a student falls behind, the plan reconfigures itself automatically instead of being abandoned.**

## What we are NOT solving in the MVP

Explicitly deferred (all evidence-supported as future opportunities — see research files):
- Exam-anchored positioning (SAT / AP / A-Level / GCSE / IB frames)
- College application readiness
- ADHD-specific features
- Parent visibility / family plans / payments
- Google Classroom / Canvas / LMS import
- Native mobile apps
- Difficulty-aware scheduling based on quiz performance (topic difficulty is removed from the user-facing MVP per D22)
- Content generation (flashcards, quizzes, summaries)
- Spaced repetition
- Social / accountability features
- Notifications and search (removed per D29)
- Complex Pomodoro system (only a minimal per-session timer ships — see D28)
- Analytics and behavioural SDKs (D30)
- Focus Mode Auto-Start (D31)

## MVP feature set (locked)

1. **Landing page** explaining what the app does and inviting signup.
2. **Signup / login** (email + password + first name; 13+ age gate; visual system per DESIGN-SPEC.md).
3. **Onboarding as a 5-step wizard**:
   - Step 1 — Subjects
   - Step 2 — Topics per subject
   - Step 3 — Exam / target date per subject
   - Step 4 — Availability as **time windows** (start/end HH:MM) per day of week
   - Step 5 — Preferred session length: **25 / 45 / 60**
   - Review — confirm and generate
4. **AI-generated plan** — an LLM produces a day-by-day plan of study sessions honouring the inputs and running until the last exam date. Short breaks are implicit between consecutive sessions on the same day.
5. **Today's dashboard** — shows only today's sessions, in order, each with subject, topic, time slot, and instruction.
6. **Complete / Missed session** — one tap per session on the dashboard.
7. **Adaptive re-plan** — when a session is marked Missed or the student changes availability or subjects, the remainder of the plan regenerates automatically. Completed sessions are never rewritten.
8. **Study Session timer** — a focused, single-session workflow with **Start / Pause / Finish**, ending in **Complete** or **Missed**. Deliberately minimal — not a Pomodoro system.
9. **Full plan view** — a simple day-grouped list of upcoming sessions.
10. **Subjects page** — manage subjects, topics, and exam dates after onboarding.
11. **Settings** — availability, session length, delete account, log out.

In-page states (not separate routes):
- **Session Missed** overlay — appears after tapping Missed, shows the re-plan happening.
- **Plan Updated** overlay — result of the re-plan, summarizing what changed.
- **Session Complete** overlay — post-session confirmation with "Next up".

Nothing else ships in the MVP.

## Non-goals for the MVP

- We do not track long-term retention or grades.
- We do not need offline mode.
- We do not need push notifications.
- We do not need multi-device realtime sync (single-user, single-device sync via cloud is fine).
- We do not need a native app.

## Success criteria for the MVP

We will consider the MVP validated if, in a small manual test with 5–10 real high school students:

1. At least 6/10 can complete the wizard without hitting confusion.
2. The generated plan looks plausible to the student ("I would actually follow this").
3. When they mark a session Missed, the re-planned schedule still looks coherent.
4. At least half say they would open the app again the next day.

This is a directional gate, not a business metric.

## Cost constraint

$0 stack for the entire prototype. See [COST.md](../technical/cost-and-stack-audit.md). No payments, ads, analytics, LMS, social, or content-generation features.
