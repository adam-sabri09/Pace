# CLAUDE.md

Instructions for Claude working in this repository.

## What this project is

A simple, adaptive AI study planner for high school students. A student enters their subjects, topics, exam dates, and available study time; the app produces a personalized day-by-day plan. When the student misses a session or their availability changes, the plan is automatically recalculated — the student never has to rebuild it manually.

Target user: high school students (~14–18). No other segment. No parent-facing product surface in the MVP.

## Working style

- Small, incremental changes. One feature per branch. See [RULES.md](RULES.md).
- Explain non-trivial choices in short sentences. This is a learning project as much as a product.
- Do not add features beyond the MVP defined in [PRODUCT.md](PRODUCT.md). Flag scope creep instead of implementing it.
- Prefer editing existing files over creating new ones. Do not write files unless they are part of the MVP or explicitly requested.
- No unnecessary documentation, comments, or abstractions.

## Where things live

- Product scope: [PRODUCT.md](PRODUCT.md)
- Functional + non-functional requirements: [REQUIREMENTS.md](REQUIREMENTS.md)
- System design: [ARCHITECTURE.md](ARCHITECTURE.md)
- Data model: [DATABASE.md](DATABASE.md)
- Key user flows: [USER-FLOWS.md](USER-FLOWS.md)
- UI scope: [UI.md](UI.md)
- Testing approach: [TESTING.md](TESTING.md)
- Decisions log: [DECISIONS.md](DECISIONS.md)
- Development rules: [RULES.md](RULES.md)
- Folder layout: [PROJECT-STRUCTURE.md](PROJECT-STRUCTURE.md)
- Server-action contracts: [API.md](API.md)
- Git branching: [BRANCHING.md](BRANCHING.md)
- $0 stack audit: [COST.md](COST.md)
- Phase-1 research (for reference only): [market-research.md](market-research.md), [market-research-hs.md](market-research-hs.md)

## Absolute don'ts in this repo

- Do not commit secrets or API keys. Use environment variables.
- Do not push directly to `main`. All changes go through a feature branch + PR.
- Do not skip pre-commit hooks or CI checks.
- Do not add analytics, ads, or third-party tracking SDKs. Minors are the user base.
- Do not add features that require or expose parent surveillance.
