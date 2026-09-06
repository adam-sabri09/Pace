"use client";

import { useState, useTransition } from "react";
import { triggerRePlanAction } from "@/server/actions/plan";

export function RePlanButton() {
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<
    { ok: true; changeCount: number } | { ok: false; error: string } | null
  >(null);

  const handleClick = () => {
    startTransition(async () => {
      const res = await triggerRePlanAction();
      if (res.ok) {
        setResult({ ok: true, changeCount: res.changes.length });
        // Refresh the page so the updated timeline renders.
        window.location.reload();
      } else {
        setResult({ ok: false, error: res.error });
      }
    });
  };

  if (result && !result.ok) {
    return (
      <p role="alert" className="font-label-sm text-label-sm text-error">
        {result.error}
      </p>
    );
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={isPending}
      aria-busy={isPending}
      className="font-label-sm text-label-sm text-on-surface-variant border border-outline-variant px-4 py-2 rounded-lg hover:bg-surface-variant transition-colors flex items-center gap-2 self-start disabled:opacity-60 disabled:cursor-not-allowed"
    >
      <span className="material-symbols-outlined text-[16px]" aria-hidden="true">
        refresh
      </span>
      {isPending ? "Rebuilding plan…" : "Rebuild plan"}
    </button>
  );
}
