"use server";

import "server-only";

import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { LogInSchema, SignUpSchema } from "@/lib/validation/auth";

/**
 * Server actions for the auth surface.
 *
 * Contract per API.md:
 *   - Every action returns { ok:false; error:string } on failure OR redirects
 *     on success. It NEVER returns { ok:true } directly — success is expressed
 *     as a navigation.
 *   - No secrets are ever logged or exposed to the client.
 */

export type AuthActionState = { ok: false; error: string } | null;

/**
 * Map raw Supabase / Postgres errors to user-safe messages. We deliberately
 * do NOT expose the raw error to the client — it can leak enumeration signals
 * (e.g. "user already registered") or DB internals. The messages returned
 * from this function are the ONLY thing surfaced in the UI.
 */
function friendlyAuthError(code: string | undefined, fallback: string): string {
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
    case "weak_password":
      return "That password is too weak. Use at least 8 characters.";
    case "over_email_send_rate_limit":
    case "over_request_rate_limit":
      return "Too many attempts. Wait a moment and try again.";
    default:
      return fallback;
  }
}

// -----------------------------------------------------------------------------
// signUp
// -----------------------------------------------------------------------------

export async function signUpAction(
  _prev: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const parsed = SignUpSchema.safeParse({
    firstName: formData.get("firstName"),
    email: formData.get("email"),
    password: formData.get("password"),
    ageConfirmed13Plus: formData.get("ageConfirmed13Plus") === "on",
    timeZone: (formData.get("timeZone") as string | null) ?? "UTC",
  });

  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return { ok: false, error: first.message };
  }

  const { firstName, email, password, timeZone } = parsed.data;
  const supabase = await createClient();

  // 1. Create the auth.users row. With email confirmations disabled at the
  //    project level (DECISIONS: prototype, B-i), signUp establishes a session
  //    immediately and the on_auth_user_created trigger seeds the profiles row.
  const { data: signUpResult, error: signUpError } = await supabase.auth.signUp({
    email,
    password,
  });

  if (signUpError) {
    return {
      ok: false,
      error: friendlyAuthError(signUpError.code, "Signup failed. Try again."),
    };
  }
  if (!signUpResult.user) {
    return { ok: false, error: "Signup failed. Try again." };
  }

  // 2. Complete the profile row (auto-created by the trigger with only `id`).
  //    Uses the just-established session, so RLS's TO authenticated policies
  //    allow the update on our own row (id = auth.uid()).
  const { error: profileError } = await supabase
    .from("profiles")
    .update({
      first_name: firstName,
      age_confirmed_13_plus: true,
      time_zone: timeZone,
    })
    .eq("id", signUpResult.user.id);

  if (profileError) {
    return {
      ok: false,
      error: "We created your account but couldn't save your profile. Log in and try again.",
    };
  }

  redirect("/today");
}

// -----------------------------------------------------------------------------
// logIn
// -----------------------------------------------------------------------------

export async function logInAction(
  _prev: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const parsed = LogInSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return { ok: false, error: first.message };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  });

  if (error) {
    return {
      ok: false,
      error: friendlyAuthError(error.code, "Login failed. Try again."),
    };
  }

  redirect("/today");
}

// -----------------------------------------------------------------------------
// logOut
// -----------------------------------------------------------------------------

export async function logOutAction(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
