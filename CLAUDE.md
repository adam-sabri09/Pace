# CLAUDE.md

Instructions for Claude working in this repository.

## What this project is

A simple, adaptive AI study planner for high school students. A student enters their subjects, topics, exam dates, and available study time; the app produces a personalized day-by-day plan. When the student misses a session or their availability changes, the plan is automatically recalculated — the student never has to rebuild it manually.

Target user: high school students (~14–18). No other segment. No parent-facing product surface in the MVP.

## Working style

- Small, incremental changes. One feature per branch. See [RULES.md](./docs/development/development-rules.md).
- Explain non-trivial choices in short sentences. This is a learning project as much as a product.
- Do not add features beyond the MVP defined in [PRODUCT.md](./docs/requirements/product-scope.md). Flag scope creep instead of implementing it.
- Prefer editing existing files over creating new ones. Do not write files unless they are part of the MVP or explicitly requested.
- No unnecessary documentation, comments, or abstractions.

## Where things live

- Product scope: [PRODUCT.md](./docs/requirements/product-scope.md)
- Functional + non-functional requirements: [REQUIREMENTS.md](./docs/requirements/requirements.md)
- System design: [ARCHITECTURE.md](./docs/technical/architecture.md)
- Data model: [DATABASE.md](./docs/technical/database.md)
- Key user flows: [USER-FLOWS.md](./docs/design/user-flows.md)
- UI scope: [UI.md](./docs/design/ui-spec.md)
- Testing approach: [TESTING.md](./docs/testing/testing-strategy.md)
- Decisions log: [DECISIONS.md](./docs/development/decisions-log.md)
- Development rules: [RULES.md](./docs/development/development-rules.md)
- Folder layout: [PROJECT-STRUCTURE.md](./docs/technical/project-structure.md)
- Server-action contracts: [API.md](./docs/technical/api-contracts.md)
- Git branching: [BRANCHING.md](./docs/development/branching-strategy.md)
- $0 stack audit: [COST.md](./docs/technical/cost-and-stack-audit.md)
- Market & business research: [market-research.md](./docs/research/market-research.md)
- Documentation index: [docs/README.md](./docs/README.md)

## Absolute don'ts in this repo

- Do not commit secrets or API keys. Use environment variables.
- Do not push directly to `main`. All changes go through a feature branch + PR.
- Do not skip pre-commit hooks or CI checks.
- Do not add analytics, ads, or third-party tracking SDKs. Minors are the user base.
- Do not add features that require or expose parent surveillance.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
