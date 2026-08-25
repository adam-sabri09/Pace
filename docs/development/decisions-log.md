# DECISIONS.md

A short log of decisions we've made and *why*, so future us doesn't relitigate them. Append-only. Update the status field if a decision is superseded.

Format: `[N] Title — Status — Decision — Reasoning — Trade-offs`.

---

## D1. Target market is high school students, no pivot.
- **Status**: Accepted
- **Decision**: The user is a high school student (14–18). No parent view, no teacher view, no adult / medical / bar / college segment.
- **Reasoning**: Explicit user constraint. Developmental-neuroscience evidence supports HS specifically (see [market-research-hs.md](../research/market-research.md)).
- **Trade-off**: Willingness to pay is weaker than adult segments; monetization is deferred.

## D2. MVP scope is a generic adaptive planner, not exam-anchored or college-readiness.
- **Status**: Accepted
- **Decision**: The MVP does not frame itself around AP / SAT / GCSE / A-Level or college readiness.
- **Reasoning**: The user explicitly approved the simple adaptive-planner scope. The research suggested exam-anchored would monetize better; that is a *product framing* choice we can layer on later without changing the MVP's technical shape. The MVP exists to validate the *problem*, not the business.
- **Trade-off**: Weaker positioning, weaker willingness-to-pay unlock. Acceptable for a learning-oriented MVP.

## D3. Adaptive re-planning is the core differentiator.
- **Status**: Accepted
- **Decision**: The single feature that must work well in the MVP is "when a session is skipped or availability changes, the rest of the plan reconfigures itself."
- **Reasoning**: Confirmed category gap — no mainstream HS-facing planner (MyStudyLife, myHomework, Structured, Power Planner, iStudiez, Egenda, School Planner) ships this today.
- **Trade-off**: More engineering focus goes on re-planning quality than on breadth of features.

## D4. Stack: Next.js + Vercel + Supabase + AI Gateway.
- **Status**: Accepted
- **Decision**: Single Next.js app on Vercel. Supabase for auth + Postgres. Claude via Vercel AI Gateway using AI SDK v6.
- **Reasoning**: Simplest deployable unit. Managed auth and DB avoid rolling our own. AI Gateway lets us swap models without code changes. Matches tools available in this environment.
- **Trade-off**: Vendor lock to Vercel and Supabase for the MVP. Acceptable; both have generous free tiers and easy exit paths.

## D5. Node.js runtime (Fluid Compute), not Edge.
- **Status**: Accepted
- **Decision**: All server code runs on Vercel Fluid Compute (Node.js).
- **Reasoning**: Full Node APIs, longer timeouts, no Edge compatibility issues, streaming still works. Matches current Vercel guidance.
- **Trade-off**: Slightly higher cold-start theoretical cost vs. Edge — not relevant at MVP traffic.

## D6. Web-first, no native mobile in the MVP.
- **Status**: Accepted
- **Decision**: Responsive web app only. Mobile-first UI, but no iOS/Android app.
- **Reasoning**: Scope. A responsive Next.js app covers the phone use case adequately.
- **Trade-off**: Missing App Store distribution and native affordances (push notifications, home-screen presence). Acceptable for MVP.

## D7. No payments, no ads, no analytics SDKs.
- **Status**: Accepted
- **Decision**: The MVP has no monetization surface, no third-party ad SDKs, no behavioral analytics.
- **Reasoning**: Users are minors; regulatory drift (COPPA 2.0, GDPR-K) is real. Ads targeting minors are increasingly restricted. Monetization is a Phase-3+ concern.
- **Trade-off**: No revenue and limited product-usage visibility. Acceptable at this stage.

## D8. Age gate at 13+, not stricter.
- **Status**: Accepted
- **Decision**: Signup requires the user to confirm they are 13 or older. No parental consent flow yet.
- **Reasoning**: Under-13 users would trigger current COPPA requirements we do not want to implement in MVP. 13+ is the standard consumer-app floor.
- **Trade-off**: We ignore the small under-13 slice; we may need to revisit if COPPA 2.0 becomes law (would extend protections to under-17).

## D9. LLM outputs are always schema-validated; one retry on failure, then user-facing error.
- **Status**: Accepted
- **Decision**: We call the LLM via AI SDK `generateObject` with a Zod schema. On schema failure, retry once. On second failure, surface a recoverable error to the user and keep their input.
- **Reasoning**: LLMs can produce malformed output. We must never render or store unvalidated LLM data.
- **Trade-off**: A ~20-second worst-case latency on plan generation. Acceptable.

## D10. Completed sessions are immutable.
- **Status**: Accepted
- **Decision**: Adaptive re-planning only regenerates *future* sessions. Completed and skipped sessions are historical records and never rewritten.
- **Reasoning**: Preserves user trust ("what I did shouldn't disappear") and makes the LLM's job simpler (only plan forward).
- **Trade-off**: The historical record may include sessions that no longer make sense given the new plan; that's fine.

## D11. Single active plan per user in the MVP.
- **Status**: Accepted
- **Decision**: A user has at most one active plan. Creating a new plan replaces the old one.
- **Reasoning**: Simplicity. Multi-plan UX has real complexity (which plan is "today"?).
- **Trade-off**: A user who wants to test scenarios ("what if I add another exam") cannot do so without losing their current plan.

## D13. Package manager is npm.
- **Status**: Accepted
- **Decision**: We use `npm`, not `yarn` or `pnpm`.
- **Reasoning**: Ships with Node.js. One less tool to install. Fine for a small solo project.
- **Trade-off**: Slightly slower installs vs. pnpm. Irrelevant at this scale.

## D14. LLM provider is Google Gemini (free tier), not Claude, for the prototype.
- **Status**: Accepted (revises D4 for the LLM sub-choice)
- **Decision**: Use Google Gemini via AI SDK for prototype development. Anthropic Claude and OpenAI both require a credit card to obtain an API key; Gemini's AI Studio free tier does not.
- **Reasoning**: [COST.md](../technical/cost-and-stack-audit.md) documents that Gemini is the only major frontier-lab option with a genuine no-card free tier suitable for a $0 prototype. Because we call the LLM through AI SDK `generateObject` with a Zod schema, swapping providers later is a one-line change.
- **Trade-off**: Slightly different model behavior than Claude; free-tier rate limits (~15 rpm) constrain us if we ever demo to many users at once.

## D15. Time zones are stored per user (IANA); sessions use `timestamptz`.
- **Status**: Accepted
- **Decision**: Add `time_zone` to `profiles`. Sessions are stored as `timestamptz`. The LLM prompt states the user's local time; display is in local time.
- **Reasoning**: A student in Amsterdam expects "16:00" to mean 16:00 local. Storing UTC + IANA is the standard correct approach.
- **Trade-off**: Timezone changes (moving country) would need a re-plan; acceptable.

## D16. Breaks are not stored as rows.
- **Status**: Accepted
- **Decision**: The 5-minute break between consecutive same-day sessions (F4.5) is implicit. The LLM is instructed to leave a gap; the DB stores only real study sessions.
- **Reasoning**: Simplicity — no need for a `type` column or a separate breaks table. Display can compute the gap visually.
- **Trade-off**: If we ever want to make breaks first-class (skippable, longer, etc.) we would need to add them to the schema.

## D17. Only one active `plan` per user, enforced by a partial unique index.
- **Status**: Accepted
- **Decision**: `CREATE UNIQUE INDEX ON plans (user_id) WHERE is_active`.
- **Reasoning**: Database-level guarantee of the invariant from D11.
- **Trade-off**: New plan generation must deactivate the old one in the same transaction.

## D18. Prototype domain is a `.vercel.app` subdomain.
- **Status**: Accepted
- **Decision**: No custom domain in the prototype.
- **Reasoning**: [COST.md](../technical/cost-and-stack-audit.md) — keeps us at $0.
- **Trade-off**: Slightly less polished URL. Fine for prototype.

## D19. Rate limiting deferred.
- **Status**: Accepted
- **Decision**: No rate limiting in the MVP.
- **Reasoning**: Only a handful of test users; LLM provider (Gemini free tier) already imposes rate limits at the API level.
- **Trade-off**: A misbehaving user could burn our free-tier quota. Small blast radius; we will monitor manually.

## D20. Trunk-based branching, squash merges.
- **Status**: Accepted
- **Decision**: One `main` branch; short-lived feature/fix/chore/docs branches; PRs are squash-merged.
- **Reasoning**: See [BRANCHING.md](./branching-strategy.md). Simplest workflow that still teaches good hygiene.
- **Trade-off**: No release branches. Sufficient for MVP; can be revisited.

## D12. No LMS import in MVP.
- **Status**: Accepted
- **Decision**: No Google Classroom / Canvas / Schoology integration in the MVP.
- **Reasoning**: Each LMS requires separate OAuth and per-district variation. Big scope hit for uncertain payoff at this stage.
- **Trade-off**: Manual data entry is the #1 abandonment driver across the category (per research). We accept this risk in the MVP and revisit after user testing.

---

## Phase 3 design review — resolutions of Stitch conflicts (C1–C15)

All 15 conflicts flagged in [DESIGN-SPEC.md](../design/design-spec.md) §7 were resolved by the user on 2026-08-23. Recorded here so the resolution is durable.

## D21. Session lengths are 25 / 45 / 60 minutes (resolves C1).
- **Status**: Accepted
- **Trade-off**: Drops 30 (docs) and 90 (Stitch Setup step 5). The 90-minute card in the wizard is removed.

## D22. Topic difficulty is removed from the user-facing MVP (resolves C2).
- **Status**: Accepted
- **Decision**: No difficulty input in the wizard, on the Subjects page, or anywhere. `topics.difficulty` is dropped from the schema.
- **Trade-off**: The LLM must infer ordering from exam-proximity and topic count only. Slightly less signal; simpler UX and DB.

## D23. Onboarding is a 5-step wizard, not a single long form (resolves C3).
- **Status**: Accepted, supersedes the prior "one long scrolling form" direction in UI.md.

## D24. Availability is stored as time windows per weekday (resolves C4).
- **Status**: Accepted, supersedes the prior `availability(user_id, day_of_week, minutes)` schema.
- **New table**: `availability_windows(id, user_id, day_of_week, starts_at TIME, ends_at TIME)`. Multiple windows per day; no overlap; `ends_at > starts_at`.

## D25. Session action labels are "Complete" and "Missed" (resolves C5).
- **Status**: Accepted
- The DB status enum renames `skipped` → `missed`. Applies to `sessions.status` and everywhere the term appears.

## D26. Subjects is a dedicated nav item and page (resolves C6).
- **Status**: Accepted
- Route `/subjects` manages subjects, topics, and exam dates. Reuses wizard step components.

## D27. Login and Signup screens are built in-house in the Pace visual language (resolves C7).
- **Status**: Accepted, gap noted for a future Stitch pass.

## D28. Study Session timer ships in the MVP (resolves C8).
- **Status**: Accepted, revises the previous "no focus timer" position in PRODUCT.md non-goals.
- **Scope**: Start / Pause / Resume / Finish, and Complete / Missed after Finish. Timer runs client-side only; no persistence of pause or elapsed state. Not a Pomodoro system.

## D29. No notifications and no search UI (resolves C9).
- **Status**: Accepted
- The bell and magnifier icons in the Stitch top app bar are omitted from the implementation.

## D30. No Data Analytics setting (resolves C10; reinforces D7).
- **Status**: Accepted
- The Settings toggle is omitted entirely.

## D31. No Focus Mode Auto-Start (resolves C11).
- **Status**: Accepted
- The toggle is omitted.

## D32. `profiles.first_name` is captured at signup (resolves C12).
- **Status**: Accepted
- Used only for greeting the student. Not shown to any third party.

## D33. Border radius follows the tailwind-config values in the Stitch export (resolves C13).
- **Status**: Accepted
- Canonical: `rounded` 2px, `rounded-lg` 4px, `rounded-xl` 8px, `rounded-full` 12px (soft-pill, not a true pill). The prose frontmatter of `pace/DESIGN.md` is discarded on this point.

## D34. Timezone is detected automatically from the browser (resolves C14).
- **Status**: Accepted
- Client sends `Intl.DateTimeFormat().resolvedOptions().timeZone` at signup. No UI question, no manual override in the MVP.

## D35. Session Missed / Plan Updated / Session Complete are in-page states within `/today`, not standalone routes (resolves C15).
- **Status**: Accepted
- They are rendered as full-screen overlays with the nav shell suppressed, but URL remains `/today` (or `/study/[sessionId]` in the case of Session Complete reached from the timer).

---

## Deferred (recorded, not decided)

Items research surfaced as promising but explicitly out of MVP. Not decisions — flags for later:

- Exam-anchored framing (AP / A-Level / GCSE / IB / SAT)
- College application readiness framing
- ADHD-specific mode
- Family / parent buyer motion + pricing
- LMS import
- Native mobile
- Content generation (flashcards / quizzes / summaries)
- Focus timer / Pomodoro deep integration
- Social / accountability features
- Payments and family plans
- Analytics (privacy-preserving only, if ever)
