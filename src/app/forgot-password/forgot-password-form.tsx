"use client";

import Link from "next/link";
import { useActionState } from "react";
import {
  requestPasswordResetAction,
  type RequestResetState,
} from "@/server/actions/auth";

export function ForgotPasswordForm() {
  const [state, formAction, pending] = useActionState<RequestResetState, FormData>(
    requestPasswordResetAction,
    null,
  );

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
            Reset your password
          </h1>
          <p className="font-body-md text-body-md text-on-surface-variant">
            Enter your email and we&rsquo;ll send you a link to set a new password.
          </p>
        </header>

        {state?.ok && state.sent ? (
          <div
            role="status"
            className="bg-primary/5 border border-primary/20 rounded-xl p-stack-md flex flex-col gap-3 text-center"
          >
            <span
              className="material-symbols-outlined text-3xl text-primary mx-auto"
              style={{ fontVariationSettings: "'FILL' 1" }}
              aria-hidden="true"
            >
              mark_email_read
            </span>
            <p className="font-headline-md text-headline-md text-on-surface">Check your inbox</p>
            <p className="font-body-md text-body-md text-on-surface-variant">
              If an account exists for that email, you&rsquo;ll receive a reset link
              within a few minutes. Check your spam folder if it doesn&rsquo;t arrive.
            </p>
            <Link
              href="/login"
              className="font-label-md text-label-md text-primary hover:underline underline-offset-2 mt-1"
            >
              Back to log in
            </Link>
          </div>
        ) : (
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

            {state && !state.ok && (
              <p role="alert" className="font-label-md text-label-md text-error">
                {state.error}
              </p>
            )}

            <button
              type="submit"
              disabled={pending}
              aria-busy={pending}
              className="bg-primary text-on-primary font-label-md text-label-md px-8 py-3 rounded-lg hover:opacity-90 transition-opacity disabled:opacity-60 disabled:cursor-not-allowed mt-2"
            >
              {pending ? "Sending…" : "Send reset link"}
            </button>

            <p className="text-center font-label-md text-label-md text-on-surface-variant">
              <Link href="/login" className="text-primary hover:underline underline-offset-2">
                Back to log in
              </Link>
            </p>
          </form>
        )}
      </div>
    </main>
  );
}
