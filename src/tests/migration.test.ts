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

  it("has a select policy for every user-owned table", () => {
    for (const table of USER_OWNED_TABLES) {
      expect(sql).toMatch(
        new RegExp(`create policy \\w+ on public\\.${table}\\s+for select`, "i"),
      );
    }
  });

  it("has an insert policy for every user-owned table", () => {
    for (const table of USER_OWNED_TABLES) {
      expect(sql).toMatch(
        new RegExp(`create policy \\w+ on public\\.${table}\\s+for insert`, "i"),
      );
    }
  });

  it("has an update policy for every user-owned table", () => {
    for (const table of USER_OWNED_TABLES) {
      expect(sql).toMatch(
        new RegExp(`create policy \\w+ on public\\.${table}\\s+for update`, "i"),
      );
    }
  });

  it("has a delete policy for every user-owned table", () => {
    for (const table of USER_OWNED_TABLES) {
      expect(sql).toMatch(
        new RegExp(`create policy \\w+ on public\\.${table}\\s+for delete`, "i"),
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

  it("has no direct references to service_role or hardcoded secrets", () => {
    expect(sql).not.toMatch(/service_role/i);
    expect(sql).not.toMatch(/sk_live|eyJ[A-Za-z0-9]/); // JWT / secret shapes
  });
});
