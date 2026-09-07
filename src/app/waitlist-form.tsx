"use client";

import { useActionState } from "react";
import { joinWaitlistAction, type WaitlistState } from "@/server/actions/waitlist";

/**
 * Inline early-access email capture for the landing page.
 * Uses useActionState so the success state renders without a full-page reload.
 */
export function WaitlistForm() {
  const [state, action, pending] = useActionState<WaitlistState, FormData>(
    joinWaitlistAction,
    null,
  );

  if (state?.ok) {
    return (
      <p role="status" className="font-body-md text-body-md text-primary py-2">
        You&rsquo;re on the list — we&rsquo;ll reach out as Pace grows.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-2 w-full max-w-sm mx-auto">
      <form action={action} className="flex flex-col sm:flex-row gap-3">
        <label htmlFor="waitlist-email" className="sr-only">
          Email address
        </label>
        <input
          id="waitlist-email"
          name="email"
          type="email"
          required
          autoComplete="email"
          placeholder="you@example.com"
          className="flex-1 min-w-0 bg-transparent border border-outline-variant rounded-lg px-4 py-3 font-body-md text-body-md text-on-surface placeholder:text-outline focus:outline-none focus:border-primary-container transition-colors"
        />
        <button
          type="submit"
          disabled={pending}
          className="shrink-0 bg-primary text-on-primary font-label-md text-label-md px-6 py-3 rounded-lg hover:opacity-90 transition-opacity disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {pending ? "Joining…" : "Join waitlist"}
        </button>
      </form>
      {state && !state.ok && (
        <p role="alert" className="font-label-sm text-label-sm text-error text-center">
          {state.error}
        </p>
      )}
    </div>
  );
}
