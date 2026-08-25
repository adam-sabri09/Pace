# RULES.md

Development rules for this project. Short list. All items apply.

## Scope

1. If a change is not in [PRODUCT.md](../requirements/product-scope.md) MVP scope, do not implement it. Flag it in [DECISIONS.md](./decisions-log.md) as deferred.
2. Bug fixes stay tightly scoped. No opportunistic refactors in a fix PR.
3. No premature abstraction. Three similar lines beat a bad helper.

## Git

1. `main` is stable and deployable at all times.
2. All work happens on branches: `feature/<name>`, `fix/<name>`, `chore/<name>`, `docs/<name>`.
3. One PR = one logical change. Small PRs.
4. Commit messages describe the *why* in one line, plus optional detail lines.
5. Never force-push to `main`. Never push secrets.

## Code

1. TypeScript everywhere. Strict mode on.
2. No `any` unless justified in a comment.
3. Validate inputs at system boundaries (API routes, LLM inputs, form submissions). Trust internal code.
4. Environment variables via `.env.local` (git-ignored). Do not hardcode.
5. Comments only where the *why* is non-obvious. No comments that restate the code.

## Testing

See [TESTING.md](../testing/testing-strategy.md). Every feature ships with tests for the happy path and one edge case at minimum.

## AI / LLM

1. LLM inputs are always structured (validated schema). LLM outputs are always parsed into a validated schema before use.
2. LLM failures must not crash the app — return a clear error state to the user.
3. No LLM prompts that treat user input as instructions. Treat all user content as data.

## Security & privacy

1. Users are minors. Collect the minimum data required to make a study plan work: email (or anonymous ID), subjects, topics, exam dates, available time, and completion state.
2. No analytics SDKs, no behavioral tracking, no ads.
3. Passwords via a managed auth provider (Supabase Auth). We never store passwords ourselves.
4. Age gate at signup (13+ for MVP; treat all users as minors).

## Reviews

1. Every PR requires the author to check: does it build, do tests pass, does it match the scope of one linked item.
2. CI must be green before merge.
