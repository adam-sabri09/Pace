"use client";

import { useActionState } from "react";
import { updatePasswordAction, type UpdatePasswordState } from "@/server/actions/auth";

export function ResetPasswordForm() {
  const [state, formAction, pending] = useActionState<UpdatePasswordState, FormData>(
    updatePasswordAction,
    null,
  );

  return (
    <main className="min-h-full flex-grow flex items-center justify-center px-container-margin py-stack-lg">
      <div className="w-full max-w-md flex flex-col gap-stack-lg">
        <header className="flex flex-col items-center gap-base text-center">
          <span className="font-display text-headline-md text-primary">Pace</span>
          <h1 className="font-display text-headline-lg-mobile md:text-headline-lg text-on-surface">
            Choose a new password
          </h1>
          <p className="font-body-md text-body-md text-on-surface-variant">
            Pick something you&rsquo;ll remember. At least 8 characters.
          </p>
        </header>

        <form action={formAction} className="flex flex-col gap-stack-md" noValidate>
          <div className="flex flex-col gap-1">
            <label
              htmlFor="password"
              className="font-label-sm text-label-sm uppercase tracking-wider text-on-surface-variant"
            >
              New password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="new-password"
              required
              minLength={8}
              className="bg-transparent border-0 border-b border-outline-variant focus:border-primary-container focus:ring-0 px-0 py-3 font-body-lg text-body-lg text-on-surface placeholder:text-outline transition-colors duration-200 outline-none"
              placeholder="8+ characters"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label
              htmlFor="confirm_password"
              className="font-label-sm text-label-sm uppercase tracking-wider text-on-surface-variant"
            >
              Confirm new password
            </label>
            <input
              id="confirm_password"
              name="confirm_password"
              type="password"
              autoComplete="new-password"
              required
              className="bg-transparent border-0 border-b border-outline-variant focus:border-primary-container focus:ring-0 px-0 py-3 font-body-lg text-body-lg text-on-surface placeholder:text-outline transition-colors duration-200 outline-none"
              placeholder="Repeat your password"
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
            className="bg-primary-container text-on-primary font-label-md text-label-md px-8 py-3 rounded-lg hover:opacity-90 transition-opacity shadow-sm disabled:opacity-60 disabled:cursor-not-allowed mt-2"
          >
            {pending ? "Saving…" : "Set new password"}
          </button>
        </form>
      </div>
    </main>
  );
}
