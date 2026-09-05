"use client";

import { useState, useTransition } from "react";
import { deletePassedExamsAction } from "@/server/actions/subjects";

interface Props {
  passedCount: number;
}

/**
 * Confirmation dialog + action button for clearing past exam dates from the Plan page.
 * Sets exam_date = null on subjects whose exam has passed, preserving all study history.
 */
export function ClearPastExamsButton({ passedCount }: Props) {
  const [isPending, startTransition] = useTransition();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [result, setResult] = useState<
    { ok: true; count: number } | { ok: false; error: string } | null
  >(null);

  if (passedCount === 0) return null;

  const handleConfirm = () => {
    startTransition(async () => {
      const res = await deletePassedExamsAction();
      setResult(res);
      setConfirmOpen(false);
    });
  };

  if (result) {
    return (
      <p
        role="status"
        className={
          "font-label-sm text-label-sm " +
          (result.ok ? "text-on-surface-variant" : "text-error")
        }
      >
        {result.ok
          ? `Cleared ${result.count} past exam date${result.count === 1 ? "" : "s"}.`
          : result.error}
      </p>
    );
  }

  if (confirmOpen) {
    return (
      <div className="flex flex-wrap items-center gap-3">
        <p className="font-body-sm text-body-sm text-on-surface-variant">
          Clear {passedCount} past exam date{passedCount === 1 ? "" : "s"}? Study history is
          preserved — only the exam date is removed.
        </p>
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={handleConfirm}
            disabled={isPending}
            className="font-label-sm text-label-sm text-on-error bg-error px-3 py-1.5 rounded-lg hover:opacity-90 transition-opacity disabled:opacity-60"
          >
            {isPending ? "Clearing…" : "Yes, clear"}
          </button>
          <button
            type="button"
            onClick={() => setConfirmOpen(false)}
            disabled={isPending}
            className="font-label-sm text-label-sm text-on-surface-variant border border-outline-variant px-3 py-1.5 rounded-lg hover:bg-surface-variant transition-colors disabled:opacity-60"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setConfirmOpen(true)}
      className="font-label-sm text-label-sm text-on-surface-variant border border-outline-variant px-4 py-2 rounded-lg hover:bg-surface-variant transition-colors flex items-center gap-2 self-start"
    >
      <span className="material-symbols-outlined text-[16px]" aria-hidden="true">
        delete_sweep
      </span>
      Clear {passedCount} past exam{passedCount === 1 ? "" : "s"}
    </button>
  );
}
