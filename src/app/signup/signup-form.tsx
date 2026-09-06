"use client";

import Link from "next/link";
import { useActionState, useEffect, useRef, useState } from "react";
import { signUpAction, type AuthActionState } from "@/server/actions/auth";
import { GoogleSignInButton } from "@/components/auth/google-sign-in-button";

declare global {
  interface Window {
    hcaptcha?: {
      render: (container: HTMLElement, options: Record<string, unknown>) => number;
      reset: (widgetId: number) => void;
    };
  }
}

/**
 * Signup form — Pace visual system (DESIGN-SPEC.md §7 / §2.4 / §2.1).
 * Centered max-w-md column, no nav shell, bottom-border inputs, primary CTA,
 * small text link at the bottom for the opposite action.
 *
 * hCaptcha is loaded on mount when NEXT_PUBLIC_HCAPTCHA_SITE_KEY is set.
 * The token is captured in a ref (no re-render) and forwarded to the server
 * action via FormData. Supabase verifies the token server-side.
 * The secret key never appears in frontend code.
 */
export function SignupForm() {
  const [state, formAction, pending] = useActionState<AuthActionState, FormData>(
    signUpAction,
    null,
  );

  const siteKey = process.env.NEXT_PUBLIC_HCAPTCHA_SITE_KEY;
  const captchaContainerRef = useRef<HTMLDivElement>(null);
  const captchaTokenRef = useRef<string>("");
  const captchaWidgetIdRef = useRef<number | null>(null);
  const [captchaError, setCaptchaError] = useState<string | null>(null);

  // Load the hCaptcha script and render the widget once the container is mounted.
  // render=explicit prevents hCaptcha from auto-scanning the DOM.
  useEffect(() => {
    if (!siteKey || !captchaContainerRef.current) return;

    const renderWidget = () => {
      if (!captchaContainerRef.current || captchaWidgetIdRef.current !== null) return;
      if (!window.hcaptcha) return;
      captchaWidgetIdRef.current = window.hcaptcha.render(captchaContainerRef.current, {
        sitekey: siteKey,
        size: "normal",
        theme: window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light',
        callback: (token: string) => {
          captchaTokenRef.current = token;
          setCaptchaError(null);
        },
        "expired-callback": () => {
          captchaTokenRef.current = "";
        },
        "error-callback": () => {
          captchaTokenRef.current = "";
        },
      });
    };

    // Script may already be in the DOM (e.g. back-navigation).
    if (document.getElementById("hcaptcha-script")) {
      renderWidget();
      return;
    }

    const script = document.createElement("script");
    script.id = "hcaptcha-script";
    script.src = "https://js.hcaptcha.com/1/api.js?render=explicit";
    script.async = true;
    script.defer = true;
    script.onload = renderWidget;
    document.head.appendChild(script);
  }, [siteKey]);

  // Reset the widget whenever the server action returns an error so the user
  // must complete a fresh challenge before resubmitting.
  useEffect(() => {
    if (state && !state.ok) {
      captchaTokenRef.current = "";
      if (captchaWidgetIdRef.current !== null && window.hcaptcha) {
        window.hcaptcha.reset(captchaWidgetIdRef.current);
      }
    }
  }, [state]);

  // Inject the browser's IANA timezone at submit time so the server action can
  // persist it to profiles.time_zone. Done here (not in state/effect) to
  // avoid an SSR/hydration mismatch and to keep the render pass side-effect free.
  const submit = (formData: FormData) => {
    try {
      formData.set(
        "timeZone",
        Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
      );
    } catch {
      formData.set("timeZone", "UTC");
    }

    // Client-side guard: if the CAPTCHA widget is loaded but the user hasn't
    // completed it, block submission and surface a clear message.
    if (siteKey && !captchaTokenRef.current) {
      setCaptchaError("Please complete the CAPTCHA to continue.");
      return;
    }

    formData.set("captchaToken", captchaTokenRef.current);
    return formAction(formData);
  };

  return (
    <main className="min-h-full flex-grow flex items-center justify-center px-container-margin py-stack-lg">
      <div className="w-full max-w-md flex flex-col gap-stack-lg">
        <header className="flex flex-col items-center gap-base text-center">
          <span className="font-display text-headline-md text-primary">Pace</span>
          <h1 className="font-display text-headline-lg-mobile md:text-headline-lg text-on-surface">
            Create your account
          </h1>
          <p className="font-body-md text-body-md text-on-surface-variant">
            Study plans that adapt when life doesn&rsquo;t.
          </p>
        </header>

        <form action={submit} className="flex flex-col gap-stack-md" noValidate>

          <div className="flex flex-col gap-1">
            <label
              htmlFor="firstName"
              className="font-label-sm text-label-sm uppercase tracking-wider text-on-surface-variant"
            >
              First name
            </label>
            <input
              id="firstName"
              name="firstName"
              type="text"
              autoComplete="given-name"
              required
              maxLength={50}
              className="bg-transparent border-0 border-b border-outline-variant focus:border-primary-container focus:ring-0 px-0 py-3 font-body-lg text-body-lg text-on-surface placeholder:text-outline transition-colors duration-200 outline-none"
              placeholder="Alex"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label
              htmlFor="email"
              className="font-label-sm text-label-sm uppercase tracking-wider text-on-surface-variant"
            >
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              className="bg-transparent border-0 border-b border-outline-variant focus:border-primary-container focus:ring-0 px-0 py-3 font-body-lg text-body-lg text-on-surface placeholder:text-outline transition-colors duration-200 outline-none"
              placeholder="you@example.com"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label
              htmlFor="password"
              className="font-label-sm text-label-sm uppercase tracking-wider text-on-surface-variant"
            >
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="new-password"
              required
              minLength={8}
              className="bg-transparent border-0 border-b border-outline-variant focus:border-primary-container focus:ring-0 px-0 py-3 font-body-lg text-body-lg text-on-surface placeholder:text-outline transition-colors duration-200 outline-none"
              placeholder="At least 8 characters"
            />
          </div>

          <label className="flex items-start gap-3 mt-2 cursor-pointer">
            <input
              id="ageConfirmed13Plus"
              name="ageConfirmed13Plus"
              type="checkbox"
              required
              className="mt-1 w-4 h-4 accent-primary-container"
            />
            <span className="font-body-md text-body-md text-on-surface-variant">
              I am 13 years old or older and I agree to the{" "}
              <Link href="/terms" className="underline hover:text-primary">Terms</Link>{" "}
              and{" "}
              <Link href="/privacy" className="underline hover:text-primary">Privacy Policy</Link>.
            </span>
          </label>

          {/* hCaptcha widget — only rendered when the site key is configured */}
          {siteKey && (
            <div className="flex flex-col gap-1">
              <div ref={captchaContainerRef} />
              {captchaError && (
                <p role="alert" className="font-label-sm text-label-sm text-error">
                  {captchaError}
                </p>
              )}
            </div>
          )}

          {state && !state.ok && (
            <p
              role="alert"
              className="font-label-md text-label-md text-error mt-2"
            >
              {state.error}
            </p>
          )}

          <button
            type="submit"
            disabled={pending}
            aria-busy={pending}
            className="bg-primary-container text-on-primary font-label-md text-label-md px-8 py-3 rounded-lg hover:opacity-90 transition-opacity shadow-sm disabled:opacity-60 disabled:cursor-not-allowed mt-2"
          >
            {pending ? "Creating account…" : "Get Started"}
          </button>
        </form>

        <div className="flex items-center gap-3">
          <span className="flex-1 h-px bg-outline-variant" aria-hidden="true" />
          <span className="font-label-sm text-label-sm text-outline">or</span>
          <span className="flex-1 h-px bg-outline-variant" aria-hidden="true" />
        </div>

        <GoogleSignInButton mode="signup" />

        <p className="text-center font-label-md text-label-md text-on-surface-variant">
          Already have an account?{" "}
          <Link
            href="/login"
            className="text-primary hover:underline underline-offset-2"
          >
            Log in
          </Link>
        </p>
      </div>
    </main>
  );
}
