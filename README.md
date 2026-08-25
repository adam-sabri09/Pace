# Pace

An AI study planner for high school students that automatically rebuilds itself when life gets in the way.

**Status**: Phase 4 – Steps 0–7 (partially complete). Functional web app: auth, onboarding wizard, plan generation (Gemini), dashboard, and adaptive re-planning (mark missed → auto re-plan) are implemented. Step 7 overlay UI still in progress on `feature/replanning`.

## Docs

Full index: **[docs/README.md](./docs/README.md)**. Read these before touching the repo:

- [CLAUDE.md](CLAUDE.md) — instructions for AI assistants working here
- [PRODUCT.md](./docs/requirements/product-scope.md) — MVP scope
- [REQUIREMENTS.md](./docs/requirements/requirements.md) — functional + non-functional requirements
- [ARCHITECTURE.md](./docs/technical/architecture.md) — system design
- [DATABASE.md](./docs/technical/database.md) — data model
- [USER-FLOWS.md](./docs/design/user-flows.md) — key user flows
- [UI.md](./docs/design/ui-spec.md) — page structure
- [DESIGN-SPEC.md](./docs/design/design-spec.md) — visual system (Stitch export is source of truth)
- [API.md](./docs/technical/api-contracts.md) — server-action contracts
- [TESTING.md](./docs/testing/testing-strategy.md) — testing approach
- [DECISIONS.md](./docs/development/decisions-log.md) — decision log
- [PROJECT-STRUCTURE.md](./docs/technical/project-structure.md) — target folder layout
- [BRANCHING.md](./docs/development/branching-strategy.md) — git branching workflow
- [RULES.md](./docs/development/development-rules.md) — development rules
- [COST.md](./docs/technical/cost-and-stack-audit.md) — $0 stack audit

## Workflow

- `main` is production. Protected. No direct pushes.
- Feature work happens on short-lived branches: `feature/<slug>`, `fix/<slug>`, `chore/<slug>`, `docs/<slug>`.
- One PR = one logical change. Squash-merged.
- CI must be green before merge. See [.github/workflows/ci.yml](.github/workflows/ci.yml).

## Stack

Next.js (App Router) · TypeScript · Tailwind · shadcn/ui · Supabase (Postgres + Auth) · Google Gemini via AI SDK · Vercel Hobby. Target cost: $0.
