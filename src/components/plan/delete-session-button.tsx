"use client";

import { useState, useTransition } from "react";
import { deleteScheduledSessionAction } from "@/server/actions/plan";

export function DeleteSessionButton({ sessionId }: { sessionId: string }) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleDelete() {
    if (!window.confirm("Remove this session from your plan?")) return;
    setError(null);
    startTransition(async () => {
      const result = await deleteScheduledSessionAction(sessionId);
      if (!result.ok) setError(result.error);
    });
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        onClick={handleDelete}
        disabled={isPending}
        aria-label="Remove session"
        className="font-label-sm text-label-sm text-on-surface-variant hover:text-error transition-colors disabled:opacity-50 leading-none"
      >
        <span className="material-symbols-outlined text-[18px]" aria-hidden="true">
          {isPending ? "hourglass_empty" : "close"}
        </span>
      </button>
      {error && (
        <p className="font-label-sm text-label-sm text-error text-right max-w-[120px]">
          {error}
        </p>
      )}
    </div>
  );
}
