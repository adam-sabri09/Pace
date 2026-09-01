"use client";

import { useEffect, useState } from "react";

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

/**
 * Renders a UTC ISO timestamp in the viewer's local timezone.
 *
 * During SSR the raw ISO string is emitted so the server and client
 * initial renders match; after hydration useEffect swaps it for the
 * locale-formatted version using the browser's own Intl API — which
 * honours DST correctly without any hardcoded timezone.
 */
export function LocalTime({
  utcIso,
  className,
}: {
  utcIso: string;
  className?: string;
}) {
  const [display, setDisplay] = useState(utcIso);

  useEffect(() => {
    setDisplay(formatLocalTime(utcIso));
  }, [utcIso]);

  return (
    <time dateTime={utcIso} className={className}>
      {display}
    </time>
  );
}
