"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { disconnectGoogleCalendarAction } from "@/server/actions/google-calendar";

interface Props {
  connected: boolean;
  /** False when GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET are not set. */
  configured: boolean;
}

export function GoogleCalendarSection({ connected, configured }: Props) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function handleDisconnect() {
    startTransition(async () => {
      await disconnectGoogleCalendarAction();
      router.push("/settings?disconnected=google_calendar");
    });
  }

  return (
    <section className="border border-outline-variant rounded-xl p-stack-md bg-surface-container-lowest">
      <h2 className="font-headline-md text-headline-md text-on-surface flex items-center gap-base border-b border-outline-variant pb-base mb-stack-md">
        <span className="material-symbols-outlined text-outline" aria-hidden="true">
          calendar_month
        </span>
        Google Calendar
      </h2>

      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="font-label-md text-label-md text-on-surface">
            {!configured
              ? "Not available"
              : connected
                ? "Connected"
                : "Not connected"}
          </p>
          <p className="font-body-md text-body-md text-on-surface-variant mt-0.5">
            {!configured
              ? "Google integration has not been configured for this deployment."
              : connected
                ? "Pace will avoid scheduling sessions during your Google Calendar events."
                : "Connect your Google Calendar so Pace avoids scheduling during your busy times."}
          </p>
        </div>

        {!configured ? null : connected ? (
          <button
            type="button"
            onClick={handleDisconnect}
            disabled={isPending}
            className="shrink-0 font-label-md text-label-md text-error border border-outline-variant px-4 py-2 rounded-lg hover:bg-error/5 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isPending ? "Disconnecting…" : "Disconnect"}
          </button>
        ) : (
          <a
            href="/api/google/calendar/auth"
            className="shrink-0 font-label-md text-label-md text-primary border border-primary/30 px-4 py-2 rounded-lg hover:bg-primary/5 transition-colors"
          >
            Connect
          </a>
        )}
      </div>
    </section>
  );
}
