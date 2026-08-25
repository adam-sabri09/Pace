/**
 * Maps raw Supabase / GoTrue error codes to user-safe messages.
 *
 * Lives in its own module (not the "use server" auth action file) so it can be
 * unit-tested and reused: a "use server" file may only export async server
 * actions, not a synchronous helper.
 *
 * We deliberately never surface the raw error — it can leak enumeration
 * signals or backend internals. The strings returned here are the ONLY auth
 * error text shown in the UI.
 */
export function friendlyAuthError(
  code: string | undefined,
  fallback: string,
): string {
  switch (code) {
    case "invalid_credentials":
    case "invalid_grant":
      return "Those credentials didn't work. Try again.";
    case "email_exists":
    case "user_already_exists":
    case "user_already_registered":
      return "An account with that email already exists. Try logging in.";
    case "email_address_invalid":
    case "invalid_email":
      return "That email address isn't accepted. Use a real address.";
    case "email_not_confirmed":
      return "Please confirm your email address first, then log in.";
    case "weak_password":
      return "That password is too weak. Use at least 8 characters.";
    case "over_email_send_rate_limit":
    case "over_request_rate_limit":
      return "Too many attempts. Wait a moment and try again.";
    default:
      return fallback;
  }
}
