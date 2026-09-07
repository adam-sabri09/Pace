import Link from "next/link";
import { WaitlistForm } from "./waitlist-form";

export default function LandingPage() {
  return (
    <div className="min-h-full flex flex-col bg-background text-on-surface">
      {/* Navbar */}
      <nav className="w-full sticky top-0 bg-background/95 backdrop-blur-sm z-40 border-b border-outline-variant/40">
        <div className="max-w-[1024px] mx-auto px-container-margin py-3 flex justify-between items-center">
          <div className="flex items-center gap-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/pace-icon.svg" alt="" width={24} height={24} className="rounded flex-shrink-0" aria-hidden="true" />
            <span className="font-display text-headline-md text-primary">Pace</span>
          </div>
          <div className="flex items-center gap-2 md:gap-6">
            <a
              className="hidden md:inline font-label-md text-label-md text-on-surface-variant hover:text-on-surface transition-colors"
              href="#method"
            >
              Method
            </a>
            <Link
              className="hidden md:inline font-label-md text-label-md text-on-surface-variant hover:text-on-surface transition-colors"
              href="/login"
            >
              Log In
            </Link>
            <Link
              className="bg-primary text-on-primary font-label-md text-label-md px-5 py-2 rounded-lg hover:opacity-90 transition-opacity"
              href="/signup"
            >
              Get Started
            </Link>
          </div>
        </div>
      </nav>

      {/* Main content */}
      <main className="flex-grow w-full max-w-[1024px] mx-auto px-container-margin pt-16 md:pt-24 pb-stack-lg">

        {/* Hero */}
        <section className="max-w-2xl flex flex-col gap-6 mb-16 md:mb-24">
          <h1 className="font-display text-display text-on-surface" style={{ letterSpacing: "-0.025em", lineHeight: "1.1" }}>
            Your study plan that adapts when life doesn&rsquo;t.
          </h1>
          <p className="font-body-lg text-body-lg text-on-surface-variant max-w-xl">
            Pace builds a realistic study schedule for your exams and automatically
            adjusts when you miss a session. No stress — just the next step.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            <Link
              className="bg-primary text-on-primary font-label-md text-label-md px-8 py-3 rounded-lg hover:opacity-90 transition-opacity text-center"
              href="/signup"
            >
              Get Started
            </Link>
            <a
              className="border border-outline-variant text-on-surface-variant font-label-md text-label-md px-8 py-3 rounded-lg hover:bg-surface-container-low hover:text-on-surface transition-colors text-center"
              href="#method"
            >
              See how it works
            </a>
          </div>
        </section>

        {/* Product preview */}
        <section
          aria-label="Pace dashboard preview"
          className="relative w-full mb-16 md:mb-24 border border-outline-variant rounded-xl overflow-hidden bg-surface"
        >
          {/* Mock app shell */}
          <div className="bg-surface-container-low border-b border-outline-variant px-5 py-3 flex items-center gap-3">
            <div className="flex items-center gap-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/pace-icon.svg" alt="" width={18} height={18} className="rounded" aria-hidden="true" />
              <span className="font-label-md text-label-md text-on-surface">Pace</span>
            </div>
            <div className="h-4 w-px bg-outline-variant mx-1" />
            <span className="font-label-sm text-label-sm text-primary">Today</span>
          </div>
          <div className="p-5 md:p-8">
            <div className="flex items-baseline justify-between mb-6 gap-4 flex-wrap">
              <div>
                <p className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider mb-1">Thursday, 6 Sep</p>
                <h3 className="font-headline-md text-headline-md text-on-surface">Good afternoon, Alex</h3>
              </div>
              <span className="font-label-sm text-label-sm bg-secondary-container text-on-secondary-container px-3 py-1 rounded">
                On track
              </span>
            </div>

            <div className="flex flex-col gap-2.5">
              <div className="rounded-lg border border-outline-variant p-4 flex items-center justify-between">
                <div>
                  <p className="font-label-md text-label-md text-on-surface">Mathematics</p>
                  <p className="font-body-sm text-body-sm text-on-surface-variant mt-0.5">Quadratic equations · 45 min</p>
                </div>
                <div className="text-right">
                  <span className="font-label-sm text-label-sm text-on-surface-variant">4:00 PM</span>
                  <p className="font-label-sm text-label-sm text-on-surface-variant/50 mt-0.5">Completed</p>
                </div>
              </div>

              <div className="rounded-lg border border-outline-variant p-4 flex items-center justify-between">
                <div>
                  <p className="font-label-md text-label-md text-on-surface">Physics</p>
                  <p className="font-body-sm text-body-sm text-on-surface-variant mt-0.5">Newton's laws · 45 min</p>
                </div>
                <span className="font-label-sm text-label-sm text-on-surface-variant">5:00 PM</span>
              </div>

              <div className="rounded-lg border border-primary/20 bg-primary/[0.04] p-4 flex items-center justify-between">
                <div>
                  <p className="font-label-md text-label-md text-on-surface">Biology</p>
                  <p className="font-body-sm text-body-sm text-on-surface-variant mt-0.5">Cellular respiration · 25 min</p>
                </div>
                <div className="text-right">
                  <span className="font-label-sm text-label-sm text-primary">7:00 PM</span>
                  <p className="font-label-sm text-label-sm text-primary/70 mt-0.5">Up next</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Method */}
        <section id="method" className="mb-16 md:mb-24 scroll-mt-24">
          <div className="mb-12">
            <p className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider mb-3">The approach</p>
            <h2 className="font-headline-lg-mobile md:font-headline-lg text-headline-lg-mobile md:text-headline-lg text-on-surface max-w-lg">
              The Quiet Mentor Methodology
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-px bg-outline-variant/30 rounded-xl overflow-hidden border border-outline-variant/30">
            <div className="bg-background p-8 flex flex-col gap-3">
              <span className="font-label-sm text-label-sm text-on-surface-variant">Step 1</span>
              <h3 className="font-headline-md text-headline-md text-on-surface">Plan</h3>
              <p className="font-body-md text-body-md text-on-surface-variant leading-relaxed">
                Input your syllabus and exam dates. Pace calculates the precise hours required and builds your schedule.
              </p>
            </div>
            <div className="bg-background p-8 flex flex-col gap-3">
              <span className="font-label-sm text-label-sm text-on-surface-variant">Step 2</span>
              <h3 className="font-headline-md text-headline-md text-on-surface">Study</h3>
              <p className="font-body-md text-body-md text-on-surface-variant leading-relaxed">
                Enter focused, distraction-free sessions in structured blocks. Your AI coach suggests the right technique.
              </p>
            </div>
            <div className="bg-background p-8 flex flex-col gap-3">
              <span className="font-label-sm text-label-sm text-on-surface-variant">Step 3</span>
              <h3 className="font-headline-md text-headline-md text-on-surface">Complete or Miss</h3>
              <p className="font-body-md text-body-md text-on-surface-variant leading-relaxed">
                Log your progress honestly. Life happens; a missed session is just data, not a failure.
              </p>
            </div>
            <div className="bg-primary p-8 flex flex-col gap-3">
              <span className="font-label-sm text-label-sm text-on-primary/60">Step 4</span>
              <h3 className="font-headline-md text-headline-md text-on-primary">Adapt</h3>
              <p className="font-body-md text-body-md text-on-primary/80 leading-relaxed">
                The system quietly recalculates your future blocks to keep you on track. No guilt.
              </p>
            </div>
          </div>
        </section>

        {/* Final CTA */}
        <section className="border border-outline-variant rounded-xl p-10 md:p-16 flex flex-col gap-6 my-stack-lg">
          <h2 className="font-headline-lg-mobile md:font-headline-lg text-headline-lg-mobile md:text-headline-lg text-on-surface max-w-md">
            Ready to take control of your studies?
          </h2>
          <p className="font-body-md text-body-md text-on-surface-variant max-w-sm">
            Sign up now, or drop your email and we&rsquo;ll keep you posted.
          </p>
          <Link
            className="bg-primary text-on-primary font-label-md text-label-md px-8 py-3 rounded-lg hover:opacity-90 transition-opacity self-start"
            href="/signup"
          >
            Start Planning
          </Link>
          <div className="flex items-center gap-3 max-w-xs">
            <span className="flex-1 h-px bg-outline-variant" />
            <span className="font-label-sm text-label-sm text-outline">or join the waitlist</span>
            <span className="flex-1 h-px bg-outline-variant" />
          </div>
          <WaitlistForm />
        </section>
      </main>

      {/* Footer */}
      <footer className="w-full border-t border-outline-variant mt-auto">
        <div className="max-w-[1024px] mx-auto px-container-margin py-8 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center gap-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/pace-icon.svg" alt="" width={20} height={20} className="rounded" aria-hidden="true" />
            <span className="font-display text-headline-md text-primary">Pace</span>
          </div>
          <p className="font-body-sm text-body-sm text-on-surface-variant max-w-xs">
            No ads. No tracking. No sharing. Only what&rsquo;s needed to build your plan.
          </p>
          <div className="flex items-center gap-5">
            <Link href="/privacy" className="font-label-sm text-label-sm text-on-surface-variant hover:text-on-surface transition-colors">Privacy</Link>
            <Link href="/terms" className="font-label-sm text-label-sm text-on-surface-variant hover:text-on-surface transition-colors">Terms</Link>
            <p className="font-label-sm text-label-sm text-on-surface-variant">© 2026 Pace</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
