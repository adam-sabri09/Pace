# Admin Dashboard — Requirements

## Purpose

Provide an internal dashboard for the development team to monitor Pace's aggregate usage, error logs, and system health — without exposing raw user data to regular users.

## Scope

- View aggregate stats: users, sessions, subjects, practice, coursework
- View recent application errors logged to `app_errors`
- Clear all application errors
- Access is restricted to an explicit email allowlist

Out of scope (MVP): per-user deep-dives, data export, user management, manual re-processing of failed items, historical analytics charts.

---

## User story

> As a Pace developer, I want to see live aggregate stats and recent errors so that I can monitor the application's health and diagnose issues quickly.

---

## Functional requirements

| ID | Requirement |
|---|---|
| ADM-1 | Access to `/admin` requires authentication AND membership in the `ADMIN_EMAILS` allowlist |
| ADM-2 | Non-admins who navigate to `/admin` are redirected to `/today` |
| ADM-3 | The admin nav item is only visible to admin users |
| ADM-4 | Stats are loaded using the service-role Supabase client (bypasses RLS) |
| ADM-5 | `clearAppErrorsAction` requires admin authorization; rejects with an error if called by a non-admin |
| ADM-6 | If the service client fails to initialise (missing env vars), an informative error banner is shown instead of a 500 |
| ADM-7 | The service-role key is never sent to the browser |

---

## Non-functional requirements

| ID | Requirement |
|---|---|
| ADM-NF-1 | Stats load time: < 5s under normal Supabase conditions |
| ADM-NF-2 | All stats queries run in parallel via `Promise.all` |
| ADM-NF-3 | A failure in stats loading must not crash the page (try/catch) |

---

## Admin allowlist configuration

The allowlist is controlled by the `ADMIN_EMAILS` environment variable:

```
ADMIN_EMAILS=alice@example.com,bob@example.com
```

- Comma-separated, case-insensitive
- Server-only — never exposed to the client
- An empty or missing `ADMIN_EMAILS` treats everyone as non-admin
- Implementation: `src/lib/auth/admin.ts` → `isAdminEmail(email)`

---

## Stats shown on the dashboard

- Total users, new this week, onboarded users, onboarding rate
- Sessions: completed, missed, scheduled, completion rate
- Average confidence score across all subjects
- Coursework items, practice sessions, questions answered, average accuracy
- Age band distribution
- Top 8 subjects by user count
- Difficulty distribution across all subjects
- Average memory score
- Top 5 goals (from onboarding)
- Top 6 study habits
- Recent 15 application errors from `app_errors`

---

## Error cases

| Scenario | Behaviour |
|---|---|
| Not authenticated | Redirect to `/login` (handled by layout) |
| Authenticated but not admin | Redirect to `/today` |
| Service client fails (env var missing) | Error banner shown; page renders without crashing |
| Individual stat query fails | Query returns null/empty; page still renders |

---

## Database interactions

| Table | Operation | Client | Notes |
|---|---|---|---|
| `profiles` | SELECT (count, aggregate) | Service role | Bypasses RLS |
| `sessions` | SELECT | Service role | Bypasses RLS |
| `subjects` | SELECT | Service role | Bypasses RLS |
| `app_errors` | SELECT | Service role | Last 15 rows |
| `app_errors` | DELETE | Service role | Clear all rows |
| `coursework_items` | SELECT (count) | Service role | Bypasses RLS |
| `practice_sessions` | SELECT | Service role | Bypasses RLS |

---

## Security

- `isAdminEmail()` is the single source of truth for admin access
- Both the page render and the `clearAppErrorsAction` check authorization independently
- The service-role key is only readable server-side (environment variable, not `NEXT_PUBLIC_`)
- No user PII is displayed beyond truncated user IDs (first 8 characters)

---

## Acceptance criteria

- [ ] A non-admin user navigating to `/admin` is redirected to `/today`
- [ ] The admin nav item is invisible to non-admin users
- [ ] An admin user sees the full dashboard with live stats
- [ ] `clearAppErrorsAction` returns an error when called by a non-admin
- [ ] If `SUPABASE_SERVICE_ROLE_KEY` is missing, an informative banner appears instead of a 500 error
- [ ] No service-role key or other secret appears in the browser's network requests

---

## Test requirements

- Unit: `isAdminEmail()` — all edge cases (empty list, case sensitivity, whitespace, null/undefined email)
- Regression: non-admin POST to `clearAppErrorsAction` returns `{ ok: false }`
- Regression: admin page with missing env vars shows error banner, not 500
