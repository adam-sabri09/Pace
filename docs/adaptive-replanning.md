# Adaptive Replanning

**What this covers:** How Pace keeps a student's study plan useful after things change — sessions completed, sessions missed, or availability shifts.

---

## What Adaptive Replanning Is

When Pace generates an initial study plan, it is a best guess based on the student's subjects, exam dates, availability windows, and session length. Real life rarely follows a plan exactly. Students miss sessions, finish topics early, or have unexpected commitments.

Adaptive replanning is Pace's mechanism for responding to those changes. Instead of leaving the student with a stale, broken plan, Pace regenerates the remaining schedule to reflect what has actually happened.

---

## Why Replanning Is Needed

A static plan assumes every session will be completed on time. When a session is missed, two things go wrong:

1. **The plan is now wrong.** It still shows the missed session as if it will happen, or skips over it silently.
2. **The remaining schedule may be infeasible.** If a topic was supposed to be covered before another, or before an exam, the gap needs to be addressed.

Replanning fixes both problems by regenerating only the future portion of the schedule, while keeping a full record of what has already happened.

---

## Two Paths: Done and Missed

### Marking a session as done

When a student marks a session as done (from the Today page or the study session screen), its status changes to `completed`. **No replan happens.** The student has done what was expected — the remaining schedule is still valid.

Completed sessions are passed to the plan generator as context, so when a replan does happen, the generator knows not to reschedule work the student has already finished.

### Marking a session as missed

When a student explicitly clicks **"Mark missed"** on a session card, two things happen in sequence:

1. The session's status is updated to `missed`.
2. An adaptive replan runs immediately.

The replan:
- **Deletes all remaining scheduled sessions** (only the scheduled ones — completed and missed sessions are untouched).
- **Generates a new schedule** using the current date, the student's remaining subjects, their availability windows, and a list of already-completed sessions.
- **Shows the student a diff overlay** listing what changed — which sessions were added, removed, or moved — along with any warnings (e.g., an exam that cannot be covered in the available time).

The student sees the changes and dismisses the overlay. Their plan is now up to date.

---

## How History Is Preserved

Completed and missed sessions are **never deleted**. They remain in the database with their original scheduled time and status. This serves two purposes:

- The plan generator can see which topics have been covered and avoid re-scheduling them.
- The student (and eventually Pace's analytics) can see a full record of what happened across the plan's lifetime.

Only `scheduled` sessions are replaced during a replan. The historical record grows over time and is never overwritten.

---

## How the Replan Works Internally

The replan process (triggered by a missed session):

1. Reads the student's profile: session length, time zone, subjects, topics, availability.
2. Reads all completed sessions to give the plan generator context on what is already done.
3. Deletes all sessions currently marked `scheduled`.
4. Calls the AI plan generator with the current context (including completed sessions as input).
5. Inserts the new scheduled sessions under the existing active plan.
6. Updates the plan's `last_replanned_at` timestamp.
7. Computes a diff between the old schedule and the new one for the overlay.

Personalization context (study technique preference, subject difficulty, confidence) is also passed to the generator so the new plan can reflect the student's current profile.

---

## Auto-Detection: A Silent Path Without Replan

There is a third path that runs automatically. When the Today page loads, Pace silently checks for any sessions that were scheduled on **previous days** and are still marked `scheduled` — meaning the student never touched them. These are automatically marked as `missed`.

**Importantly, this silent detection does not trigger a replan.** It only updates the session statuses so they appear correctly in history and on the Plan page. The student's active schedule is not regenerated automatically.

A replan only runs when the student explicitly marks a session as missed through the session card. This is intentional: auto-detection handles clean-up of stale data; the student's deliberate action handles schedule regeneration.

> **Known gap:** If a student accumulates several missed sessions over multiple days and never manually marks any of them missed from the card, their schedule will not be automatically replanned. The auto-detection marks the sessions as missed in history, but the student will need to manually trigger a replan (by marking a session missed from the card) before Pace generates an updated schedule.

---

## Avoiding Unnecessary Replanning

Replanning is avoided in three situations:

- **Session marked done** — no replan, the plan is still valid.
- **Auto-detected missed sessions** — status updated, no replan.
- **Replan already current** — if no sessions remain scheduled (the plan is finished or empty), the replan produces no new sessions and returns cleanly.

The replan operation itself is also idempotent at the session level: the generator receives completed sessions as context each time, so re-running the replan on the same data produces a consistent schedule.

---

## Current Behavior Summary

| Action | Session status updated | Replan triggered | Overlay shown |
|---|---|---|---|
| Student marks session done | → `completed` | No | No |
| Student marks session missed | → `missed` | **Yes** | **Yes** |
| Auto-detection on page load (previous days only) | → `missed` | No | No |

---

## Why This Matters

Most study planners require the student to manually rebuild their schedule when something changes. That is a real barrier — students either give up on the plan or carry around a plan they know is wrong.

Pace's adaptive replanning means the student only has to acknowledge that they missed something. The updated schedule appears immediately, without manual effort. The plan stays believable, and students are more likely to trust and follow it.
