"use client";

import { useActionState, useState } from "react";
import { deleteAccountAction, type DeleteAccountState } from "@/server/actions/account";

export function DeleteAccountSection() {
  const [state, action, pending] = useActionState<DeleteAccountState, FormData>(
    deleteAccountAction,
    null,
  );
  const [confirming, setConfirming] = useState(false);
  const [typed, setTyped] = useState("");

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="font-label-md text-label-md text-error border border-error/30 px-6 py-2 rounded-lg hover:bg-error/5 transition-colors"
      >
        Delete account
      </button>
    );
  }

  return (
    <div className="rounded-lg bg-error/5 border border-error/20 p-4 flex flex-col gap-3">
      <p className="font-label-md text-label-md text-error">
        This will permanently delete your account and all your data — subjects, plans, and study
        sessions. This cannot be undone.
      </p>
      <p className="font-body-md text-body-md text-on-surface-variant">
        Type{" "}
        <strong className="font-label-md text-label-md text-on-surface">delete</strong> to
        confirm.
      </p>
      <form action={action} className="flex flex-col gap-3">
        <label htmlFor="delete-confirm" className="sr-only">
          Type delete to confirm
        </label>
        <input
          id="delete-confirm"
          type="text"
          autoComplete="off"
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          placeholder="delete"
          className="bg-transparent border border-outline-variant rounded-lg px-4 py-2 font-body-md text-body-md text-on-surface placeholder:text-outline focus:outline-none focus:border-error transition-colors max-w-xs"
        />
        <div className="flex flex-wrap gap-3">
          <button
            type="submit"
            disabled={typed !== "delete" || pending}
            aria-busy={pending}
            className="font-label-md text-label-md text-on-primary bg-error px-6 py-2 rounded-lg hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {pending ? "Deleting…" : "Yes, delete my account"}
          </button>
          <button
            type="button"
            onClick={() => {
              setConfirming(false);
              setTyped("");
            }}
            disabled={pending}
            className="font-label-md text-label-md text-on-surface border border-outline-variant px-6 py-2 rounded-lg hover:bg-surface-container-low transition-colors disabled:opacity-60"
          >
            Cancel
          </button>
        </div>
      </form>
      {state && !state.ok && (
        <p role="alert" className="font-label-sm text-label-sm text-error">
          {state.error}
        </p>
      )}
    </div>
  );
}
