/**
 * Structural checks on the initial schema migration.
 *
 * These tests read the SQL file as text. They do NOT execute the SQL — a full
 * integration run against a Postgres instance is out of scope for Step 2.
 * They exist to catch accidental regressions like an RLS-disabled table or a
 * missing policy on a user-owned table, which are silent security failures.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { describe, expect, it } from "vitest";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const migrationPath = path.resolve(
  __dirname,
  "../../supabase/migrations/0001_init.sql",
);
const sql = readFileSync(migrationPath, "utf8");

const USER_OWNED_TABLES = [
  "profiles",
  "availability_windows",
  "subjects",
  "topics",
  "plans",
  "sessions",
] as const;

describe("0001_init.sql", () => {
  it("creates every table declared in DATABASE.md", () => {
    for (const table of USER_OWNED_TABLES) {
      expect(sql).toMatch(new RegExp(`create table public\\.${table}\\b`, "i"));
    }
  });

  it("enables RLS on every user-owned table", () => {
    for (const table of USER_OWNED_TABLES) {
      expect(sql).toMatch(
        new RegExp(
          `alter table public\\.${table}\\s+enable row level security`,
          "i",
        ),
      );
    }
  });

  it("has a select policy for every user-owned table, restricted to authenticated", () => {
    for (const table of USER_OWNED_TABLES) {
      expect(sql).toMatch(
        new RegExp(
          `create policy \\w+ on public\\.${table}\\s+for select\\s+to authenticated`,
          "i",
        ),
      );
    }
  });

  it("has an insert policy for every user-owned table, restricted to authenticated", () => {
    for (const table of USER_OWNED_TABLES) {
      expect(sql).toMatch(
        new RegExp(
          `create policy \\w+ on public\\.${table}\\s+for insert\\s+to authenticated`,
          "i",
        ),
      );
    }
  });

  it("has an update policy for every user-owned table with both USING and WITH CHECK", () => {
    for (const table of USER_OWNED_TABLES) {
      expect(sql).toMatch(
        new RegExp(
          `create policy \\w+ on public\\.${table}\\s+for update\\s+to authenticated\\s+using[\\s\\S]+?with check\\s*\\(`,
          "i",
        ),
      );
    }
  });

  it("has a delete policy for every user-owned table, restricted to authenticated", () => {
    for (const table of USER_OWNED_TABLES) {
      expect(sql).toMatch(
        new RegExp(
          `create policy \\w+ on public\\.${table}\\s+for delete\\s+to authenticated`,
          "i",
        ),
      );
    }
  });

  it("does NOT use the deprecated auth.role() pattern", () => {
    expect(sql).not.toMatch(/auth\.role\s*\(\s*\)/i);
  });

  it("uses (select auth.uid()) for policy predicate caching", () => {
    // Every user-owned table should be present in at least one policy body.
    for (const table of USER_OWNED_TABLES) {
      expect(sql).toMatch(
        new RegExp(
          `on public\\.${table}[\\s\\S]+?\\(select auth\\.uid\\(\\)\\)`,
          "i",
        ),
      );
    }
  });

  it("enforces session_length_minutes in (25, 45, 60)", () => {
    expect(sql).toMatch(/session_length_minutes\s+in\s*\(\s*25\s*,\s*45\s*,\s*60\s*\)/i);
  });

  it("enforces day_of_week between 0 and 6", () => {
    expect(sql).toMatch(/day_of_week\s+between\s+0\s+and\s+6/i);
  });

  it("enforces ends_at > starts_at on availability_windows", () => {
    expect(sql).toMatch(/ends_at\s*>\s*starts_at/i);
  });

  it("constrains session status to scheduled/completed/missed", () => {
    expect(sql).toMatch(/status\s+in\s*\(\s*'scheduled'\s*,\s*'completed'\s*,\s*'missed'\s*\)/i);
    // No stale reference to the pre-D25 status name.
    expect(sql).not.toMatch(/'skipped'/i);
  });

  it("declares the partial unique index for one-active-plan-per-user", () => {
    expect(sql).toMatch(
      /create unique index[\s\S]+?on public\.plans\s*\(user_id\)\s+where is_active/i,
    );
  });

  it("indexes sessions on (user_id, starts_at)", () => {
    expect(sql).toMatch(
      /create index[\s\S]+?on public\.sessions\s*\(user_id,\s*starts_at\)/i,
    );
  });

  it("registers the auth.users → profiles trigger", () => {
    expect(sql).toMatch(/create trigger on_auth_user_created\s+after insert on auth\.users/i);
  });

  it("revokes EXECUTE from PUBLIC on the SECURITY DEFINER trigger function", () => {
    expect(sql).toMatch(
      /revoke execute on function public\.handle_new_user\(\)\s+from public/i,
    );
  });

  it("locks search_path on the SECURITY DEFINER function", () => {
    expect(sql).toMatch(/set search_path = ''/i);
  });

  it("has no direct references to service_role or hardcoded secrets", () => {
    expect(sql).not.toMatch(/service_role/i);
    expect(sql).not.toMatch(/sk_live|eyJ[A-Za-z0-9]/); // JWT / secret shapes
  });
});
