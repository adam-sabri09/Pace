import Link from "next/link";

/*
 * Landing page — reproduces DESIGN-SPEC.md §3.1 in the Pace visual system.
 * Static only. No auth, no dynamic data. `/login` and `/signup` are not implemented yet
 * (Phase 4 Step 2) — the links here will 404 until that lands. That is expected.
 */
export default function LandingPage() {
  return (
    <div className="min-h-full flex flex-col bg-background text-on-surface">
      {/* Navbar — Minimalist structural clarity. */}
      <nav className="w-full flex justify-between items-center px-container-margin py-stack-md max-w-[1024px] mx-auto sticky top-0 bg-background/90 backdrop-blur-sm z-40 border-b border-outline-variant/30">
        <div className="font-display text-display text-primary flex items-center gap-2">
          <span className="font-display text-headline-md text-primary">Pace</span>
        </div>
        <div className="hidden md:flex gap-8 items-center">
          <a
            className="font-label-md text-label-md text-on-surface-variant hover:text-primary transition-colors"
            href="#method"
          >
            Method
          </a>
          <Link
            className="font-label-md text-label-md text-on-surface-variant hover:text-primary transition-colors"
            href="/login"
          >
            Log In
          </Link>
          <Link
            className="bg-primary-container text-on-primary font-label-md text-label-md px-6 py-2 rounded-lg hover:opacity-90 transition-opacity"
            href="/signup"
          >
            Get Started
          </Link>
        </div>
      </nav>

      {/* Main content canvas. */}
      <main className="flex-grow w-full max-w-[1024px] mx-auto px-container-margin pt-stack-lg md:pt-20 pb-stack-lg">
        {/* Hero — high visual density, centered intent. */}
        <section className="text-center max-w-3xl mx-auto flex flex-col gap-stack-md mb-stack-lg md:mb-32">
          <h1 className="font-display text-display md:text-5xl text-on-surface leading-tight">
            Your study plan that adapts when life doesn&rsquo;t.
          </h1>
          <p className="font-body-lg text-body-lg text-on-surface-variant max-w-2xl mx-auto">
            Pace builds a realistic study schedule for your exams and automatically
            adjusts if you miss a session. No stress, just the next step.
          </p>
          <div className="mt-4 flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              className="bg-primary-container text-on-primary font-label-md text-label-md px-8 py-3 rounded-lg hover:opacity-90 transition-opacity shadow-sm"
              href="/signup"
            >
              Get Started
            </Link>
            <a
              className="border border-outline-variant text-on-surface font-label-md text-label-md px-8 py-3 rounded-lg hover:bg-surface-container-low transition-colors"
              href="#method"
            >
              See how it works
            </a>
          </div>
        </section>

        {/* Product preview placeholder — bento tonal block. */}
        <section
          aria-hidden="true"
          className="relative w-full aspect-[16/9] md:aspect-[21/9] bg-surface-container-lowest border border-outline-variant rounded-xl overflow-hidden mb-stack-lg md:mb-32"
        >
          <div className="absolute inset-0 flex items-center justify-center text-outline-variant font-label-sm text-label-sm uppercase tracking-wider">
            Dashboard preview
          </div>
        </section>

        {/* Method grid — structural clarity, typography-driven. */}
        <section id="method" className="mb-stack-lg md:mb-32 scroll-mt-24">
          <div className="text-center mb-16">
            <h2 className="font-headline-lg-mobile md:font-headline-lg text-headline-lg-mobile md:text-headline-lg text-on-surface">
              The Quiet Mentor Methodology
            </h2>
            <p className="font-body-md text-body-md text-on-surface-variant mt-2">
              A systematic approach to academic pressure.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-gutter">
            <div className="bg-surface-container-lowest border border-outline-variant p-6 rounded-lg flex flex-col gap-4">
              <div className="w-10 h-10 rounded-full bg-secondary-container text-on-secondary-container flex items-center justify-center font-label-md text-label-md">
                01
              </div>
              <h3 className="font-headline-md text-headline-md text-on-surface">Plan</h3>
              <p className="font-body-md text-body-md text-on-surface-variant">
                Input your syllabus and exam dates. Pace calculates the precise hours required.
              </p>
            </div>
            <div className="bg-surface-container-lowest border border-outline-variant p-6 rounded-lg flex flex-col gap-4">
              <div className="w-10 h-10 rounded-full bg-secondary-container text-on-secondary-container flex items-center justify-center font-label-md text-label-md">
                02
              </div>
              <h3 className="font-headline-md text-headline-md text-on-surface">Study</h3>
              <p className="font-body-md text-body-md text-on-surface-variant">
                Enter focused, distraction-free sessions measured in structured blocks.
              </p>
            </div>
            <div className="bg-surface-container-lowest border border-outline-variant p-6 rounded-lg flex flex-col gap-4">
              <div className="w-10 h-10 rounded-full bg-secondary-container text-on-secondary-container flex items-center justify-center font-label-md text-label-md">
                03
              </div>
              <h3 className="font-headline-md text-headline-md text-on-surface">Complete / Miss</h3>
              <p className="font-body-md text-body-md text-on-surface-variant">
                Log your progress honestly. Life happens; a missed session is just data.
              </p>
            </div>
            <div className="bg-surface-container-lowest border border-outline-variant p-6 rounded-lg flex flex-col gap-4 border-l-4 border-l-primary-container">
              <div className="w-10 h-10 rounded-full bg-primary-container text-on-primary flex items-center justify-center font-label-md text-label-md">
                04
              </div>
              <h3 className="font-headline-md text-headline-md text-on-surface">Adapt</h3>
              <p className="font-body-md text-body-md text-on-surface-variant">
                The system quietly recalculates your future blocks to keep you on track. No guilt.
              </p>
            </div>
          </div>
        </section>

        {/* Final CTA. */}
        <section className="bg-surface-container-low border border-outline-variant/50 rounded-xl p-stack-lg text-center flex flex-col items-center justify-center gap-6 my-stack-lg">
          <h2 className="font-headline-lg-mobile md:font-headline-lg text-headline-lg-mobile md:text-headline-lg text-on-surface max-w-lg">
            Ready to structuralize your studies?
          </h2>
          <p className="font-body-md text-body-md text-on-surface-variant">
            Join Pace and let the system handle the planning.
          </p>
          <Link
            className="bg-primary-container text-on-primary font-label-md text-label-md px-10 py-4 rounded-lg hover:opacity-90 transition-opacity mt-4 shadow-sm"
            href="/signup"
          >
            Start Planning Now
          </Link>
        </section>
      </main>

      {/* Footer. */}
      <footer className="w-full max-w-[1024px] mx-auto py-stack-lg flex flex-col items-center gap-stack-sm text-center border-t border-outline-variant bg-surface mt-auto">
        <div className="font-display text-headline-md text-primary mb-2">Pace</div>
        <div className="flex gap-4 mb-2">
          <a
            className="font-label-sm text-label-sm text-on-surface-variant hover:text-primary transition-colors"
            href="#"
          >
            Privacy
          </a>
          <a
            className="font-label-sm text-label-sm text-on-surface-variant hover:text-primary transition-colors"
            href="#"
          >
            Terms
          </a>
          <a
            className="font-label-sm text-label-sm text-on-surface-variant hover:text-primary transition-colors"
            href="#"
          >
            Support
          </a>
        </div>
        <p className="font-body-md text-body-md text-on-surface-variant">
          © 2026 Pace. Academic pressure, managed.
        </p>
      </footer>
    </div>
  );
}
