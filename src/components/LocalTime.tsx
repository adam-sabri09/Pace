"use client";

import { useSyncExternalStore } from "react";

/**
 * Format a UTC ISO string in the viewer's local timezone.
 * Accepts an optional `timeZone` override — used in tests to get
 * deterministic output; omit it in production to use the browser default.
 */
export function formatLocalTime(utcIso: string, timeZone?: string): string {
  return new Date(utcIso).toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    ...(timeZone ? { timeZone } : {}),
  });
}

const subscribe = () => () => {};

/**
 * Renders a UTC ISO timestamp in the viewer's local timezone.
 *
 * Uses useSyncExternalStore so the server snapshot (raw ISO) is used
 * during SSR/hydration and the client snapshot (locale-formatted) is
 * used in the browser — no hydration mismatch, no extra render.
 */
export function LocalTime({
  utcIso,
  className,
}: {
  utcIso: string;
  className?: string;
}) {
  const display = useSyncExternalStore(
    subscribe,
    () => formatLocalTime(utcIso),
    () => utcIso,
  );

  return (
    <time dateTime={utcIso} className={className}>
      {display}
    </time>
  );
}
