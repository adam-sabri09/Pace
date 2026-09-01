"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";

import { clearAppErrorsAction } from "@/server/actions/admin";

export function ClearErrorsButton() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleClick() {
    if (
      !window.confirm(
        "Permanently delete all error records? This cannot be undone. Future errors will still be recorded.",
      )
    ) {
      return;
    }

    startTransition(async () => {
      const result = await clearAppErrorsAction();
      if (!result.ok) {
        alert(`Failed to clear errors: ${result.error}`);
        return;
      }
      router.refresh();
    });
  }

  return (
    <button
      onClick={handleClick}
      disabled={isPending}
      className="font-label-sm text-label-sm text-error border border-error rounded-lg px-3 py-1.5 hover:bg-error-container transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {isPending ? "Clearing…" : "Clear all errors"}
    </button>
  );
}
