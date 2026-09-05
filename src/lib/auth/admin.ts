/**
 * Admin authorization.
 *
 * Admins are identified by email address. The allowlist lives in the
 * ADMIN_EMAILS environment variable — a comma-separated list of lowercase
 * email addresses. Example: "alice@example.com,bob@example.com"
 *
 * This is server-side only: the variable is never exposed to the client.
 */

function getAdminEmails(): string[] {
  const raw = process.env.ADMIN_EMAILS ?? "";
  return raw
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

/**
 * Returns true if the given email is in the ADMIN_EMAILS allowlist.
 * Returns false if ADMIN_EMAILS is empty or not set.
 */
export function isAdminEmail(email: string | undefined | null): boolean {
  if (!email) return false;
  const admins = getAdminEmails();
  if (admins.length === 0) return false;
  return admins.includes(email.toLowerCase());
}
