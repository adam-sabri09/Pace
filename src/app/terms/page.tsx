import Link from "next/link";

export const metadata = { title: "Terms — Pace" };

export default function TermsPage() {
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
          Terms of Use
        </h1>
        <p className="font-body-md text-body-md text-on-surface-variant mt-1">
          Last updated September 2026.
        </p>
      </header>

      <div className="flex flex-col gap-stack-md font-body-md text-body-md text-on-surface-variant">

        <section>
          <h2 className="font-headline-md text-headline-md text-on-surface mb-2">Who can use Pace</h2>
          <p>
            Pace is designed for students aged 13 and older. By creating an account, you confirm that you are at
            least 13 years old. If you are under 18, you should have a parent or guardian&rsquo;s permission to use
            the service.
          </p>
        </section>

        <section>
          <h2 className="font-headline-md text-headline-md text-on-surface mb-2">What Pace does</h2>
          <p>
            Pace generates a study schedule based on the subjects, topics, exam dates, and availability you provide.
            The schedule is produced by an AI model and is intended as a starting point, not a guarantee. Study plans
            are suggestions — actual exam outcomes depend on many factors beyond any tool.
          </p>
        </section>

        <section>
          <h2 className="font-headline-md text-headline-md text-on-surface mb-2">AI-generated content</h2>
          <p>
            Pace uses Google Gemini to generate study plans, coaching messages, practice questions, and to extract
            information from uploaded files. AI-generated content may contain errors. Always check important
            information against your course materials and teacher guidance.
          </p>
        </section>

        <section>
          <h2 className="font-headline-md text-headline-md text-on-surface mb-2">Your account</h2>
          <ul className="list-disc pl-5 flex flex-col gap-1">
            <li>You are responsible for keeping your login credentials secure.</li>
            <li>You must not use Pace to upload content that you do not have the right to share.</li>
            <li>You must not attempt to misuse or disrupt the service.</li>
          </ul>
        </section>

        <section>
          <h2 className="font-headline-md text-headline-md text-on-surface mb-2">Changes to the service</h2>
          <p>
            Pace is an early product and may change over time. Features may be added, changed, or removed. We will
            try to give reasonable notice of significant changes.
          </p>
        </section>

        <section>
          <h2 className="font-headline-md text-headline-md text-on-surface mb-2">Limitation of liability</h2>
          <p>
            Pace is provided as-is. We do not guarantee that the service will always be available or error-free.
            Pace is not liable for any loss arising from your use of the service, including any reliance on
            AI-generated study plans or coaching advice.
          </p>
        </section>

        <section>
          <h2 className="font-headline-md text-headline-md text-on-surface mb-2">Privacy</h2>
          <p>
            Your use of Pace is also governed by our{" "}
            <Link href="/privacy" className="underline hover:text-primary">
              Privacy Policy
            </Link>
            .
          </p>
        </section>

        <section>
          <h2 className="font-headline-md text-headline-md text-on-surface mb-2">Questions</h2>
          <p>
            If you have questions, email us at{" "}
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
