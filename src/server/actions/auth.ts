"use server";

import "server-only";

import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { friendlyAuthError } from "@/lib/auth/errors";
import { LogInSchema, SignUpSchema } from "@/lib/validation/auth";

// Known disposable / throwaway email domains. Intentionally short — blocking
// too aggressively harms legitimate users. Extend conservatively.
const DISPOSABLE_EMAIL_DOMAINS = new Set([
  "mailinator.com", "guerrillamail.com", "guerrillamail.net", "guerrillamail.org",
  "guerrillamail.info", "guerrillamail.biz", "guerrillamail.de",
  "tempmail.com", "temp-mail.org", "throwaway.email", "dispostable.com",
  "yopmail.com", "trashmail.com", "trashmail.net", "trashmail.at", "trashmail.io",
  "maildrop.cc", "sharklasers.com", "spam4.me", "discard.email",
  "fakeinbox.com", "mailnull.com", "crap.email", "pokemail.net",
  "10minutemail.com", "10minutemail.net", "10minutemail.org",
  "mailnesia.com", "throwam.com",
]);

function isDisposableEmail(email: string): boolean {
  const domain = email.split("@")[1]?.toLowerCase();
  return domain ? DISPOSABLE_EMAIL_DOMAINS.has(domain) : false;
}

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
    captchaToken: (formData.get("captchaToken") as string | null) ?? "",
  });

  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return { ok: false, error: first.message };
  }

  const { firstName, email, password, timeZone, captchaToken } = parsed.data;

  if (isDisposableEmail(email)) {
    return { ok: false, error: "Please use a real email address to create an account." };
  }

  const supabase = await createClient();

  // 1. Create the auth.users row. With email confirmations disabled at the
  //    project level (DECISIONS: prototype, B-i), signUp establishes a session
  //    immediately and the on_auth_user_created trigger seeds the profiles row.
  //    captchaToken is forwarded to Supabase, which verifies it server-side
  //    against the hCaptcha secret configured in the Auth dashboard. If the
  //    secret is set and the token is absent or invalid, Supabase rejects signUp.
  const { data: signUpResult, error: signUpError } = await supabase.auth.signUp({
    email,
    password,
    options: {
      captchaToken: captchaToken || undefined,
    },
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

  // Defensive: for the prototype, email confirmation is disabled (DECISIONS
  // B-i), so signUp establishes a session immediately. If confirmation is ever
  // re-enabled at the project level, signUp returns a user but NO session —
  // in that case the profile update below would silently hit 0 rows under RLS
  // and redirect("/today") would bounce the user back to /login with no
  // explanation. Surface a clear message and stop instead.
  if (!signUpResult.session) {
    return {
      ok: false,
      error: "Almost there — check your email to confirm your account, then log in.",
    };
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

// -----------------------------------------------------------------------------
// requestPasswordReset — sends a Supabase password-reset email.
// Always returns { ok: true, sent: true } regardless of whether the email
// exists — never reveal which addresses are registered.
// Requires Supabase Auth SMTP to be configured (see dashboard config below).
// -----------------------------------------------------------------------------

export type RequestResetState =
  | { ok: true; sent: true }
  | { ok: false; error: string }
  | null;

export async function requestPasswordResetAction(
  _prev: RequestResetState,
  formData: FormData,
): Promise<RequestResetState> {
  const raw = formData.get("email");
  if (typeof raw !== "string" || !raw.trim()) {
    return { ok: false, error: "Please enter your email address." };
  }

  const email = raw.trim().toLowerCase();
  if (!email.includes("@") || email.length > 320) {
    return { ok: false, error: "Please enter a valid email address." };
  }

  const supabase = await createClient();
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://pace-io.vercel.app";

  // Fire-and-forget — we do not inspect the error to avoid confirming whether
  // the email is registered. The same UI message is shown either way.
  await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${siteUrl}/auth/confirm`,
  });

  return { ok: true, sent: true };
}

// -----------------------------------------------------------------------------
// updatePassword — sets a new password inside a Supabase recovery session.
// The user arrives here after clicking the email link → /auth/confirm → /reset-password.
// -----------------------------------------------------------------------------

export type UpdatePasswordState = { ok: false; error: string } | null;

export async function updatePasswordAction(
  _prev: UpdatePasswordState,
  formData: FormData,
): Promise<UpdatePasswordState> {
  const password = formData.get("password");
  const confirm = formData.get("confirm_password");

  if (typeof password !== "string" || password.length < 8) {
    return { ok: false, error: "Password must be at least 8 characters." };
  }
  if (password !== confirm) {
    return { ok: false, error: "Passwords don't match. Please try again." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      ok: false,
      error: "Your reset link has expired. Please request a new one.",
    };
  }

  const { error } = await supabase.auth.updateUser({ password });
  if (error) {
    return {
      ok: false,
      error:
        "Could not update your password. Your link may have expired — request a new one.",
    };
  }

  redirect("/today");
}
