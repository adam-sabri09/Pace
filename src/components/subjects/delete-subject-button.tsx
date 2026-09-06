"use client";

import { useState, useTransition } from "react";
import { deleteSubjectAction } from "@/server/actions/subjects";

interface Props {
  subjectId: string;
  subjectName: string;
}

export function DeleteSubjectButton({ subjectId, subjectName }: Props) {
  const [isPending, startTransition] = useTransition();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleConfirm = () => {
    startTransition(async () => {
      const res = await deleteSubjectAction(subjectId);
      if (!res.ok) {
        setError(res.error);
        setConfirmOpen(false);
      }
      // On success the page revalidates — the subject disappears from the list.
    });
  };

  if (error) {
    return (
      <p role="alert" className="font-label-sm text-label-sm text-error">
        {error}
      </p>
    );
  }

  if (confirmOpen) {
    return (
      <div className="flex flex-wrap items-center gap-3 mt-stack-sm">
        <p className="font-body-sm text-body-sm text-on-surface-variant">
          Delete <strong>{subjectName}</strong>? All topics, sessions, and practice history for this
          subject will be permanently removed.
        </p>
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={handleConfirm}
            disabled={isPending}
            className="font-label-sm text-label-sm text-on-error bg-error px-3 py-1.5 rounded-lg hover:opacity-90 transition-opacity disabled:opacity-60"
          >
            {isPending ? "Deleting…" : "Yes, delete"}
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
      className="font-label-sm text-label-sm text-on-surface-variant hover:text-error transition-colors flex items-center gap-1"
      aria-label={`Delete ${subjectName}`}
    >
      <span className="material-symbols-outlined text-[16px]" aria-hidden="true">
        delete
      </span>
      Delete
    </button>
  );
}
