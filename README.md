# Pace

An AI study planner for high school students that automatically rebuilds itself when life gets in the way.

**Status**: Phase 4 – Step 0 (development workflow). No application code yet.

## Docs

Read these before touching the repo:

- [CLAUDE.md](CLAUDE.md) — instructions for AI assistants working here
- [PRODUCT.md](PRODUCT.md) — MVP scope
- [REQUIREMENTS.md](REQUIREMENTS.md) — functional + non-functional requirements
- [ARCHITECTURE.md](ARCHITECTURE.md) — system design
- [DATABASE.md](DATABASE.md) — data model
- [USER-FLOWS.md](USER-FLOWS.md) — key user flows
- [UI.md](UI.md) — page structure
- [DESIGN-SPEC.md](DESIGN-SPEC.md) — visual system (Stitch export is source of truth)
- [API.md](API.md) — server-action contracts
- [TESTING.md](TESTING.md) — testing approach
- [DECISIONS.md](DECISIONS.md) — decision log
- [PROJECT-STRUCTURE.md](PROJECT-STRUCTURE.md) — target folder layout
- [BRANCHING.md](BRANCHING.md) — git branching workflow
- [RULES.md](RULES.md) — development rules
- [COST.md](COST.md) — $0 stack audit

## Workflow

- `main` is production. Protected. No direct pushes.
- Feature work happens on short-lived branches: `feature/<slug>`, `fix/<slug>`, `chore/<slug>`, `docs/<slug>`.
- One PR = one logical change. Squash-merged.
- CI must be green before merge. See [.github/workflows/ci.yml](.github/workflows/ci.yml).

## Stack (planned; scaffolded in Step 1)

Next.js (App Router) · TypeScript · Tailwind · shadcn/ui · Supabase (Postgres + Auth) · Google Gemini via AI SDK · Vercel Hobby. Target cost: $0.
