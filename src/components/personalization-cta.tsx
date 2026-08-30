"use client";

import { useState, useTransition } from "react";
import Link from "next/link";

import { skipPersonalizationAction } from "@/server/actions/personalization";

export function PersonalizationCta() {
  const [dismissed, setDismissed] = useState(false);
  const [isPending, startTransition] = useTransition();

  if (dismissed) return null;

  const handleSkip = () => {
    setDismissed(true);
    startTransition(async () => {
      await skipPersonalizationAction();
    });
  };

  return (
    <div className="w-full border border-outline-variant rounded-xl p-4 bg-surface-container-lowest flex flex-col sm:flex-row sm:items-center gap-3">
      <div className="flex-grow">
        <p className="font-label-md text-label-md text-on-surface">
          Help Pace learn your study style
        </p>
        <p className="font-body-md text-body-md text-on-surface-variant mt-0.5">
          Get a personalised technique recommendation in 2 minutes.
        </p>
      </div>
      <div className="flex items-center gap-3 shrink-0">
        <button
          type="button"
          onClick={handleSkip}
          disabled={isPending}
          className="font-label-md text-label-md text-on-surface-variant hover:text-primary transition-colors disabled:opacity-40 px-2 py-1"
        >
          Skip
        </button>
        <Link
          href="/personalize"
          className="bg-primary text-on-primary font-label-md text-label-md px-4 py-2 rounded-lg hover:opacity-90 transition-opacity text-nowrap"
        >
          Get started
        </Link>
      </div>
    </div>
  );
}
