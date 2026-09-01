"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { startPracticeAction } from "@/server/actions/practice";

export function StartPracticeButton({
  courseworkItemId,
  variant = "default",
}: {
  courseworkItemId: string;
  variant?: "default" | "large";
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleClick() {
    startTransition(async () => {
      const result = await startPracticeAction(courseworkItemId);
      if (!result.ok) {
        alert(result.error);
        return;
      }
      router.push(`/practice/${result.state.sessionId}`);
    });
  }

  const sizeClass =
    variant === "large"
      ? "px-8 py-3 font-label-lg text-label-lg"
      : "px-4 py-2 font-label-md text-label-md";

  return (
    <button
      onClick={handleClick}
      disabled={isPending}
      className={`${sizeClass} bg-primary text-on-primary rounded-full disabled:opacity-50 transition-opacity shrink-0`}
    >
      {isPending ? "Starting…" : "Practice now"}
    </button>
  );
}
