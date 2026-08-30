import Link from "next/link";

import { logOutAction } from "@/server/actions/auth";

/**
 * /settings — Step 6 stub. Only Log out is real here. Availability editor,
 * session length picker, and Delete account land in Step 7.
 */
export default function SettingsPage() {
  return (
    <main className="w-full max-w-3xl mx-auto px-container-margin py-stack-lg flex flex-col gap-stack-md">
      <header className="border-b border-outline-variant pb-stack-sm">
        <h1 className="font-headline-lg-mobile md:font-headline-lg text-headline-lg-mobile md:text-headline-lg text-on-surface">
          Settings
        </h1>
        <p className="font-body-md text-body-md text-on-surface-variant mt-1">
          Manage your account.
        </p>
      </header>

      <section className="border border-outline-variant rounded-xl p-stack-md bg-surface-container-lowest">
        <h2 className="font-headline-md text-headline-md text-on-surface flex items-center gap-base border-b border-outline-variant pb-base mb-stack-md">
          <span className="material-symbols-outlined text-outline" aria-hidden="true">
            tune
          </span>
          Preferences
        </h2>
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="font-label-md text-label-md text-on-surface">Study style</p>
              <p className="font-body-md text-body-md text-on-surface-variant">
                Your answers shape which technique Pace recommends each day.
              </p>
            </div>
            <Link
              href="/personalize"
              className="shrink-0 font-label-md text-label-md text-primary border border-primary/30 px-4 py-2 rounded-lg hover:bg-primary/5 transition-colors"
            >
              Update
            </Link>
          </div>
          <p className="font-body-md text-body-md text-on-surface-variant border-t border-outline-variant pt-3">
            Availability, session length, and other preferences arrive with adaptive re-planning.
          </p>
        </div>
      </section>

      <section className="border border-outline-variant rounded-xl p-stack-md bg-surface-container-lowest">
        <h2 className="font-headline-md text-headline-md text-on-surface flex items-center gap-base border-b border-outline-variant pb-base mb-stack-md">
          <span className="material-symbols-outlined text-outline" aria-hidden="true">
            logout
          </span>
          Session
        </h2>
        <form action={logOutAction}>
          <button
            type="submit"
            className="border border-outline-variant text-on-surface font-label-md text-label-md px-6 py-2 rounded-lg hover:bg-surface-container-low transition-colors"
          >
            Log out
          </button>
        </form>
      </section>

      <section className="border border-outline-variant rounded-xl p-stack-md bg-surface-container-lowest opacity-60">
        <h2 className="font-headline-md text-headline-md text-on-surface flex items-center gap-base border-b border-outline-variant pb-base mb-stack-md">
          <span className="material-symbols-outlined text-outline" aria-hidden="true">
            delete_forever
          </span>
          Danger zone
        </h2>
        <button
          type="button"
          disabled
          aria-disabled="true"
          className="font-label-md text-label-md text-error border border-outline-variant px-6 py-2 rounded-lg cursor-not-allowed"
        >
          Delete account (coming soon)
        </button>
      </section>
    </main>
  );
}
