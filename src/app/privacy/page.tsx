import Link from "next/link";

export const metadata = { title: "Privacy — Pace" };

export default function PrivacyPage() {
  return (
    <main className="w-full max-w-3xl mx-auto px-container-margin py-stack-lg">
      <Link
        href="/"
        className="inline-flex items-center gap-1 font-label-sm text-label-sm text-on-surface-variant hover:text-primary mb-stack-lg"
      >
        <span className="material-symbols-outlined text-[16px]" aria-hidden="true">arrow_back</span>
        Back
      </Link>

      <header className="border-b border-outline-variant pb-stack-sm mb-stack-md">
        <h1 className="font-headline-lg-mobile md:font-headline-lg text-headline-lg-mobile md:text-headline-lg text-on-surface">
          Privacy
        </h1>
        <p className="font-body-md text-body-md text-on-surface-variant mt-1">
          Last updated September 2026.
        </p>
      </header>

      <div className="flex flex-col gap-stack-md font-body-md text-body-md text-on-surface-variant">

        <section>
          <h2 className="font-headline-md text-headline-md text-on-surface mb-2">What Pace collects</h2>
          <p>When you sign up and use Pace, we store the following data in your account:</p>
          <ul className="list-disc pl-5 mt-2 flex flex-col gap-1">
            <li>Your name and email address (from sign-up).</li>
            <li>Your profile — age band, study habits, goals, session length preference, and timezone.</li>
            <li>Your subjects, topics, and exam dates.</li>
            <li>Your study plan and scheduled sessions, including which sessions you completed or missed.</li>
            <li>Your coursework uploads and the text extracted from them.</li>
            <li>Your practice session results and topic mastery estimates.</li>
            <li>Session events — whether you completed or left a session early, and how long you studied. This is first-party product data used only to keep your study plan accurate.</li>
            <li>Optional: your Google Calendar events, if you connect your Google account. Pace reads events only to fit sessions around your schedule. We do not store calendar event content beyond the current planning session.</li>
          </ul>
        </section>

        <section>
          <h2 className="font-headline-md text-headline-md text-on-surface mb-2">How Pace uses your data</h2>
          <ul className="list-disc pl-5 flex flex-col gap-1">
            <li>To build and adapt your study schedule.</li>
            <li>To personalise study technique recommendations based on your answers during onboarding.</li>
            <li>To track your progress across sessions and subjects.</li>
          </ul>
          <p className="mt-2">
            Pace does not sell your data, use it for advertising, or share it with third parties for marketing purposes.
          </p>
        </section>

        <section>
          <h2 className="font-headline-md text-headline-md text-on-surface mb-2">Google Gemini</h2>
          <p>
            When you upload a file (a PDF, image, or text document) to Pace, it is sent to Google Gemini to extract
            subject and topic information. Pace does not store the original file after extraction. Google&rsquo;s use
            of data sent to Gemini is governed by{" "}
            <a
              href="https://ai.google.dev/gemini-api/terms"
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:text-primary"
            >
              Google&rsquo;s Gemini API Terms of Service
            </a>
            .
          </p>
        </section>

        <section>
          <h2 className="font-headline-md text-headline-md text-on-surface mb-2">Data storage</h2>
          <p>
            Your data is stored in Supabase (hosted on AWS). Pace uses row-level security so each user can only
            access their own data.
          </p>
        </section>

        <section>
          <h2 className="font-headline-md text-headline-md text-on-surface mb-2">Deleting your data</h2>
          <p>
            You can delete your account from{" "}
            <Link href="/settings" className="underline hover:text-primary">
              Settings
            </Link>
            . Deleting your account permanently removes your profile, subjects, sessions, and all associated data.
          </p>
        </section>

        <section>
          <h2 className="font-headline-md text-headline-md text-on-surface mb-2">Cookies and tracking</h2>
          <p>
            Pace uses a session cookie from Supabase to keep you logged in. We collect first-party session
            events to improve your study plan. We do not use advertising cookies, third-party analytics SDKs,
            or any third-party tracking tools.
          </p>
        </section>

        <section>
          <h2 className="font-headline-md text-headline-md text-on-surface mb-2">Questions</h2>
          <p>
            If you have questions about how your data is handled, email us at{" "}
            <a href="mailto:hello@mal.ai" className="underline hover:text-primary">
              hello@mal.ai
            </a>
            .
          </p>
        </section>

      </div>
    </main>
  );
}
