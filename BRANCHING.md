# BRANCHING.md

Git branching strategy. Small team of one for now — kept intentionally simple.

## Branches

- `main` — always stable, always deployable. Protected. No direct pushes.
- `feature/<slug>` — new user-facing feature (one requirement or one flow at a time).
- `fix/<slug>` — bug fix.
- `chore/<slug>` — tooling, deps, config, docs-only changes.
- `docs/<slug>` — doc-only updates (Phase 1–3 docs).

Slugs are lowercase, hyphen-separated, and describe intent: `feature/plan-generation`, `fix/skip-race-condition`, `chore/upgrade-next`.

## Workflow

1. Create a branch from up-to-date `main`.
2. Commit in small, meaningful units.
3. Push and open a Pull Request against `main`.
4. Confirm CI is green (once CI exists — Phase 5).
5. Self-review the diff.
6. Merge with **Squash and merge**. Delete the branch after.

## Commit messages

- One imperative sentence in the subject line, ≤ 72 chars.
- Optional body explaining *why* (not *what* — the diff shows the what).
- Reference requirement IDs from [REQUIREMENTS.md](REQUIREMENTS.md) when applicable, e.g. `Implement F4.1 plan generation`.

## Rules

- Never force-push to `main`.
- Never merge with a failing test suite (once tests exist).
- Do not batch multiple features into one PR. If the diff crosses features, split it.
- Do not skip pre-commit hooks or bypass signing without explicit permission.
- Delete stale local + remote branches after merge.

## Protected `main`

Once the repo is on GitHub (Phase 4), enable branch protection with:
- Require PR before merging.
- Require CI checks to pass (added in Phase 5).
- No force push.
- No deletion.
