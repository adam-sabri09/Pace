"use client";

import Link from "next/link";
import { useActionState } from "react";
import { logInAction, type AuthActionState } from "@/server/actions/auth";

/**
 * Login form — Pace visual system (DESIGN-SPEC.md §7).
 */
export function LoginForm() {
  const [state, formAction, pending] = useActionState<AuthActionState, FormData>(
    logInAction,
    null,
  );

  return (
    <main className="min-h-full flex-grow flex items-center justify-center px-container-margin py-stack-lg">
      <div className="w-full max-w-md flex flex-col gap-stack-lg">
        <header className="flex flex-col items-center gap-base text-center">
          <span className="font-display text-headline-md text-primary">Pace</span>
          <h1 className="font-display text-headline-lg-mobile md:text-headline-lg text-on-surface">
            Welcome back
          </h1>
          <p className="font-body-md text-body-md text-on-surface-variant">
            Sign in to see today&rsquo;s plan.
          </p>
        </header>

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
            <p
              role="alert"
              className="font-label-md text-label-md text-error mt-2"
            >
              {state.error}
            </p>
          )}

          <button
            type="submit"
            disabled={pending}
            aria-busy={pending}
            className="bg-primary-container text-on-primary font-label-md text-label-md px-8 py-3 rounded-lg hover:opacity-90 transition-opacity shadow-sm disabled:opacity-60 disabled:cursor-not-allowed mt-2"
          >
            {pending ? "Signing in…" : "Log In"}
          </button>
        </form>

        <p className="text-center font-label-md text-label-md text-on-surface-variant">
          New to Pace?{" "}
          <Link
            href="/signup"
            className="text-primary hover:underline underline-offset-2"
          >
            Create an account
          </Link>
        </p>
      </div>
    </main>
  );
}
