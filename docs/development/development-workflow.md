# Development Workflow

This document describes the step-by-step process for implementing any feature or fix in Pace. Follow it in order; do not skip steps.

---

## Before you start

1. Make sure your local environment is running:
   - `.env.local` contains all required variables (see `.env.example`)
   - `npm install` is up to date
   - `npx supabase status` (or Supabase Studio) shows your DB is accessible

2. Read the relevant requirements document in `docs/requirements/` before writing any code.

3. Read the architecture overview in `docs/technical/architecture.md`.

4. Create a feature branch from `main`:
   ```bash
   git checkout main && git pull
   git checkout -b feat/<short-description>
   ```

---

## Implementation cycle (one feature or fix at a time)

### Step 1 — Read the requirements

Open the relevant `.md` file in `docs/requirements/`. Understand:
- What are we building and why?
- What are the acceptance criteria?
- What are the failure/edge cases?

If no requirements document exists for this feature, write one first (see the template in `docs/requirements/`).

### Step 2 — Inspect the architecture

Before touching any code:
- Where does this fit in the system? Server action? Client component? LLM layer?
- Which database tables are involved?
- Which existing functions can be reused?
- What are the security requirements (auth check, user_id scoping, RLS)?

### Step 3 — Implement

Small, incremental changes only (per `docs/development/development-rules.md`):
- Prefer editing existing files over creating new ones
- No features beyond the task at hand
- All server mutations must: verify auth, scope to `user.id`, validate inputs
- All LLM calls must: use `generateObject` with a Zod schema, handle errors gracefully
- No `eslint-disable` comments
- No `as any` casts without a comment explaining why

### Step 4 — Unit test

Write or update unit tests for:
- Pure functions (validators, scorers, recommenders, difficulty adjusters)
- New helper modules
- Any function with non-trivial branching logic

Run: `npx vitest run <specific-test-file>`

### Step 5 — Functional test

Manually verify the feature end-to-end:
1. Start the dev server: `npm run dev`
2. Follow the user journey described in the requirements
3. Check the happy path works
4. Check the error cases (invalid input, missing auth, network failure)
5. Check the database state matches expectations (use Supabase Studio)

### Step 6 — Smoke test

After any significant change, quickly verify that nothing else broke:
- [ ] Sign in / sign up
- [ ] Onboarding wizard completes
- [ ] Today page loads with sessions
- [ ] Plan page loads
- [ ] Coursework upload page loads
- [ ] Coursework detail page loads
- [ ] Practice session starts and runs
- [ ] AI Coach responds
- [ ] Settings page saves availability
- [ ] Admin page loads (admin users only)

### Step 7 — Lint + TypeScript

```bash
npm run lint
npx tsc --noEmit
```

Both must pass with zero errors. Fix any issues before proceeding.

### Step 8 — Full test suite

```bash
npx vitest run
```

All tests must pass. Do not comment out or delete failing tests.

### Step 9 — Production build

```bash
npm run build
```

Must succeed with no errors. Review the route table in the build output — confirm your changes produce the expected static (○) or dynamic (ƒ) routes.

### Step 10 — Review your diff

```bash
git diff main
```

Check:
- No secrets or API keys accidentally included
- No commented-out debug code
- No unnecessary files
- The diff is focused on the task at hand (no unrelated cleanup)

### Step 11 — Commit

```bash
git add <files>
git commit -m "type(scope): short description

Longer explanation if needed.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

Commit type: `feat` / `fix` / `refactor` / `test` / `docs` / `chore`.

### Step 12 — Push and open a PR

```bash
git push -u origin feat/<short-description>
```

Open a PR against `main`. The PR description should include:
- What changed and why
- How to test it
- Any known limitations

---

## Deploying to production

**Do not deploy from this workflow.** Deployment is a separate decision made by the code owner after the PR is reviewed and merged.

When you are ready to deploy:
```bash
vercel --prod
```

Then verify:
- Deployment status is READY
- The pages you changed work on the production URL
- No new errors appear in Vercel logs

---

## Environment variables

When adding a new environment variable:
1. Add it to `.env.example` with a comment explaining its purpose
2. Add it to your local `.env.local`
3. Add it to the Vercel project (Production + Preview environments)
4. Document it in `docs/technical/architecture.md` under the environment variables table
5. If it is server-only, ensure it is never imported by or passed to client components

---

## Common pitfalls

| Pitfall | Prevention |
|---|---|
| Server action missing auth check | Always start with `const { data: { user } } = await supabase.auth.getUser()` |
| Database query missing user_id scope | Every SELECT/UPDATE/DELETE must have `.eq("user_id", user.id)` |
| LLM output used without validation | Always use `generateObject` with a Zod schema |
| Client component importing server-only module | Add `import "server-only"` to the module; the build will catch it |
| `eslint-disable` added to suppress an error | Fix the actual code; do not suppress |
| `isAdmin = true` or hardcoded access control | Use `isAdminEmail()` from `src/lib/auth/admin.ts` |
| Race condition in re-plan | Accept the limitation; document in the PR; do not add false transaction semantics |
