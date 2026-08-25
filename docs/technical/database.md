# DATABASE.md

Postgres via Supabase. Row Level Security ON for every table.

## Tables

### `profiles`
One row per authenticated user. Linked to `auth.users` by id.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid (PK) | Same as `auth.users.id` |
| `created_at` | timestamptz | default now() |
| `first_name` | text | captured at signup for greetings |
| `age_confirmed_13_plus` | boolean | must be true; set at signup |
| `session_length_minutes` | int | 25, 45, or 60 (CHECK constraint) |
| `time_zone` | text | IANA; captured automatically from the browser at signup |

### `availability_windows`
Weekly recurring available time windows per day of week. **Replaces the previous single-minutes-per-day model** (see [DECISIONS.md](../development/decisions-log.md) D24).

| Column | Type | Notes |
|---|---|---|
| `id` | uuid (PK) | |
| `user_id` | uuid (FK → profiles.id) | |
| `day_of_week` | int | 0 = Sunday, 6 = Saturday |
| `starts_at` | time | local wall-clock time, no date |
| `ends_at` | time | must be `> starts_at` |

CHECK: `ends_at > starts_at`. Application-level check ensures no overlapping windows for the same `(user_id, day_of_week)`.

### `subjects`
| Column | Type | Notes |
|---|---|---|
| `id` | uuid (PK) | |
| `user_id` | uuid (FK) | |
| `name` | text | |
| `exam_date` | date | nullable |
| `created_at` | timestamptz | |

### `topics`
| Column | Type | Notes |
|---|---|---|
| `id` | uuid (PK) | |
| `subject_id` | uuid (FK → subjects.id) | |
| `user_id` | uuid (FK) | denormalized for RLS |
| `name` | text | |
| `created_at` | timestamptz | |

**Note**: `difficulty` was removed per [DECISIONS.md](../development/decisions-log.md) D22. The LLM infers ordering from exam-proximity and topic count alone.

### `plans`
Represents one generated plan. A user has at most one active plan at a time in the MVP.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid (PK) | |
| `user_id` | uuid (FK) | |
| `is_active` | boolean | at most one `true` per user (partial unique index) |
| `generated_at` | timestamptz | |
| `last_replanned_at` | timestamptz | nullable |

Partial unique index: `CREATE UNIQUE INDEX ON plans (user_id) WHERE is_active`.

### `sessions`
Individual scheduled study sessions.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid (PK) | |
| `plan_id` | uuid (FK → plans.id) | |
| `user_id` | uuid (FK) | denormalized for RLS |
| `topic_id` | uuid (FK → topics.id) | |
| `starts_at` | timestamptz | |
| `duration_minutes` | int | matches `profiles.session_length_minutes` |
| `instruction` | text | e.g. "Review", "Practice problems" |
| `status` | text | `scheduled` \| `completed` \| `missed` (renamed from `skipped` — [DECISIONS.md](../development/decisions-log.md) D25) |
| `completed_at` | timestamptz | nullable |

Index on (`user_id`, `starts_at`).

Notes:
- `starts_at` is stored as `timestamptz`. The user's IANA timezone lives in `profiles.time_zone`. Display is local to the user; the LLM is prompted in the user's local time.
- Breaks between sessions are **not** stored as rows. They are implicit; the UI shows visual spacing between consecutive same-day sessions and the LLM leaves a gap when placing sessions.
- Study Session **timer state (pause / elapsed)** is NOT persisted — timer runs client-side only per F10.6.

## Row Level Security

For every user-owned table, the policy is uniform:

- `SELECT`: `user_id = auth.uid()`
- `INSERT`: `user_id = auth.uid()`
- `UPDATE`: `user_id = auth.uid()`
- `DELETE`: `user_id = auth.uid()`

No cross-user access is possible. Service-role key bypasses RLS and is used only server-side for admin tasks (none needed in the MVP hot path).

## Referential integrity

- On `DELETE profiles` cascade to everything user-owned.
- On `DELETE subjects` cascade to `topics`. Plans do not cascade — deleting a subject invalidates the plan, which will simply be re-planned.

## Data we do not store

- No passwords (handled by Supabase Auth).
- No IP addresses beyond what Supabase Auth logs by default.
- No analytics events.
- No parent-facing records.
- No third-party identifiers.
- No timer / focus state (not persisted).

## Relationships (recap)

```
auth.users (Supabase Auth)
    └── profiles (1:1)
            ├── availability_windows (1:N — zero or more per weekday)
            ├── subjects (1:N)
            │       └── topics (1:N)
            └── plans (1:N, but only one active)
                    └── sessions (1:N)
                            └── topic_id → topics
```

## Migrations

Managed as Supabase SQL migration files, one per change. Applied via `supabase` CLI or the Supabase MCP `apply_migration` tool. Every migration is reviewed before it runs against production. Initial migration file will be `supabase/migrations/0001_init.sql`.
