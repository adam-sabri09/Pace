"use client";

import Link from "next/link";
import { useActionState } from "react";
import { logInAction, type AuthActionState } from "@/server/actions/auth";
import { GoogleSignInButton } from "@/components/auth/google-sign-in-button";

const URL_ERRORS: Record<string, string> = {
  oauth_cancelled: "Google sign-in was cancelled.",
  oauth_error: "Google sign-in failed. Please try again.",
  email_confirm_failed: "That confirmation link didn't work. Try signing in, or request a new link.",
  invalid_link: "That link is invalid or has expired. Try signing in.",
};

export function LoginForm({ urlError }: { urlError?: string }) {
  const [state, formAction, pending] = useActionState<AuthActionState, FormData>(
    logInAction,
    null,
  );

  const bannerMessage = urlError ? (URL_ERRORS[urlError] ?? "Something went wrong. Please try again.") : null;

  return (
    <main className="min-h-full flex-grow flex items-center justify-center px-container-margin py-stack-lg">
      <div className="w-full max-w-md flex flex-col gap-stack-lg">
        <header className="flex flex-col items-center gap-3 text-center">
          <div className="flex items-center gap-2.5 mb-1">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/pace-icon.svg" alt="" width={32} height={32} className="rounded-lg" aria-hidden="true" />
            <span className="font-display text-headline-md text-primary">Pace</span>
          </div>
          <h1 className="font-display text-headline-lg-mobile md:text-headline-lg text-on-surface">
            Welcome back
          </h1>
          <p className="font-body-md text-body-md text-on-surface-variant">
            Sign in to see today&rsquo;s plan.
          </p>
        </header>

        {bannerMessage && (
          <p role="alert" className="font-label-md text-label-md text-error text-center">
            {bannerMessage}
          </p>
        )}

        <form action={formAction} className="flex flex-col gap-stack-md" noValidate>
          <div className="flex flex-col gap-1">
            <label
              htmlFor="email"
              className="font-label-sm text-label-sm uppercase tracking-wider text-on-surface-variant"
            >
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              className="bg-transparent border-0 border-b border-outline-variant focus:border-primary-container focus:ring-0 px-0 py-3 font-body-lg text-body-lg text-on-surface placeholder:text-outline transition-colors duration-200 outline-none"
              placeholder="you@example.com"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label
              htmlFor="password"
              className="font-label-sm text-label-sm uppercase tracking-wider text-on-surface-variant"
            >
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              className="bg-transparent border-0 border-b border-outline-variant focus:border-primary-container focus:ring-0 px-0 py-3 font-body-lg text-body-lg text-on-surface placeholder:text-outline transition-colors duration-200 outline-none"
              placeholder="Your password"
            />
          </div>

          {state && !state.ok && (
            <p role="alert" className="font-label-md text-label-md text-error mt-2">
              {state.error}
            </p>
          )}

          <div className="flex justify-end -mt-2">
            <Link
              href="/forgot-password"
              className="font-label-sm text-label-sm text-on-surface-variant hover:text-primary hover:underline underline-offset-2 transition-colors"
            >
              Forgot password?
            </Link>
          </div>

          <button
            type="submit"
            disabled={pending}
            aria-busy={pending}
            className="bg-primary text-on-primary font-label-md text-label-md px-8 py-3 rounded-lg hover:opacity-90 transition-opacity disabled:opacity-60 disabled:cursor-not-allowed mt-2"
          >
            {pending ? "Signing in…" : "Log In"}
          </button>
        </form>

        <div className="flex items-center gap-3">
          <span className="flex-1 h-px bg-outline-variant" aria-hidden="true" />
          <span className="font-label-sm text-label-sm text-outline">or</span>
          <span className="flex-1 h-px bg-outline-variant" aria-hidden="true" />
        </div>

        <GoogleSignInButton mode="login" />

        <p className="text-center font-label-md text-label-md text-on-surface-variant">
          New to Pace?{" "}
          <Link href="/signup" className="text-primary hover:underline underline-offset-2">
            Create an account
          </Link>
        </p>
      </div>
    </main>
  );
}
