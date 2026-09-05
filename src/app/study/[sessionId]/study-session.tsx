"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import {
  markDoneAction,
  markMissedAction,
} from "@/server/actions/sessions";
import { recordSessionEventAction } from "@/server/actions/events";
import type { PlanChange, PlanWarning } from "@/server/llm/diff";
import { getAgeBandUI } from "@/lib/personalization/age-band";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Phase =
  | "idle"
  | "running"
  | "paused"
  | "completing"
  | "completed"
  | "missing"
  | "plan-updated"
  | "error";

/** Mutable timer values combined in one state object to allow atomic updates. */
type TimerState = {
  phase: Phase;
  elapsed: number; // seconds counted up from 0
  pausedElapsed: number; // seconds accumulated before the current run
};

export type StudySessionProps = {
  sessionId: string;
  subjectName: string;
  topicName: string;
  instruction: string;
  durationMinutes: number;
  ageBand?: string | null;
};

type StoredState = {
  pausedElapsed: number;
  startedAt: number | null; // Date.now() when running, null when paused
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function storageKey(id: string) {
  return `pace-study-${id}`;
}

function formatTime(totalSeconds: number): string {
  const clamped = Math.max(0, Math.floor(totalSeconds));
  const m = Math.floor(clamped / 60);
  const s = clamped % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function StudySession({
  sessionId,
  subjectName,
  topicName,
  instruction,
  durationMinutes,
  ageBand,
}: StudySessionProps) {
  const router = useRouter();
  const totalSeconds = durationMinutes * 60;
  const ageBandUI = getAgeBandUI(ageBand);

  const [timer, setTimer] = useState<TimerState>({
    phase: "idle",
    elapsed: 0,
    pausedElapsed: 0,
  });
  const { phase, elapsed, pausedElapsed } = timer;

  // startedAtRef holds Date.now() for the current running interval.
  // A ref avoids adding it to effect dependencies (would restart the interval).
  const startedAtRef = useRef<number | null>(null);

  // Focus-loss tracking via the Page Visibility API.
  const focusLossCountRef = useRef(0);
  const [focusLossCount, setFocusLossCount] = useState(0);
  const [welcomeBackVisible, setWelcomeBackVisible] = useState(false);
  const welcomeBackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Strict focus mode (fullscreen).
  const [strictMode, setStrictMode] = useState(false);

  const [missedResult, setMissedResult] = useState<{
    changes: PlanChange[];
    warnings: PlanWarning[];
  } | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const remaining = Math.max(0, totalSeconds - elapsed);
  const progressPct = Math.min(100, (elapsed / totalSeconds) * 100);

  // Restore timer state from sessionStorage on mount (page-refresh mid-session).
  useEffect(() => {
    const id = setTimeout(() => {
      try {
        const stored = sessionStorage.getItem(storageKey(sessionId));
        if (!stored) return;
        const parsed = JSON.parse(stored) as StoredState;
        if (parsed.startedAt !== null) {
          const nowElapsed = Math.min(
            parsed.pausedElapsed + (Date.now() - parsed.startedAt) / 1000,
            totalSeconds,
          );
          startedAtRef.current = parsed.startedAt;
          setTimer({
            phase: "running",
            elapsed: nowElapsed,
            pausedElapsed: parsed.pausedElapsed,
          });
        } else {
          setTimer({
            phase: "paused",
            elapsed: parsed.pausedElapsed,
            pausedElapsed: parsed.pausedElapsed,
          });
        }
      } catch {
        // Corrupt storage — stay idle.
      }
    }, 0);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Tick every second while running.
  useEffect(() => {
    if (phase !== "running") return;
    const id = setInterval(() => {
      if (startedAtRef.current === null) return;
      setTimer((t) => ({
        ...t,
        elapsed: Math.min(
          t.pausedElapsed + (Date.now() - startedAtRef.current!) / 1000,
          totalSeconds,
        ),
      }));
    }, 1000);
    return () => clearInterval(id);
  }, [phase, totalSeconds]);

  // Persist running/paused timer state to sessionStorage for resume on refresh.
  useEffect(() => {
    if (phase === "idle") {
      try { sessionStorage.removeItem(storageKey(sessionId)); } catch { /* ignore */ }
      return;
    }
    if (phase === "running" || phase === "paused") {
      try {
        const stored: StoredState = {
          pausedElapsed,
          startedAt: phase === "running" ? startedAtRef.current : null,
        };
        sessionStorage.setItem(storageKey(sessionId), JSON.stringify(stored));
      } catch { /* storage unavailable — safe to ignore */ }
    }
  }, [phase, pausedElapsed, sessionId]);

  // Auto-navigate to /today three seconds after the completion overlay appears.
  useEffect(() => {
    if (phase !== "completed") return;
    const t = setTimeout(() => router.push("/today"), 3000);
    return () => clearTimeout(t);
  }, [phase, router]);

  // Visibility API: count tab-hide events and show welcome-back message on return.
  useEffect(() => {
    const handler = () => {
      if (document.visibilityState === "hidden") {
        focusLossCountRef.current += 1;
        setFocusLossCount(focusLossCountRef.current);
      } else if (document.visibilityState === "visible" && phase === "running") {
        // Clear any pending timer and show the welcome-back banner for 3 s.
        if (welcomeBackTimerRef.current) clearTimeout(welcomeBackTimerRef.current);
        setWelcomeBackVisible(true);
        welcomeBackTimerRef.current = setTimeout(() => setWelcomeBackVisible(false), 3000);
      }
    };
    document.addEventListener("visibilitychange", handler);
    return () => {
      document.removeEventListener("visibilitychange", handler);
      if (welcomeBackTimerRef.current) clearTimeout(welcomeBackTimerRef.current);
    };
  }, [phase]); // re-register when phase changes so the visible-branch checks the current phase

  // Warn before leaving while a session is actively running.
  useEffect(() => {
    if (phase !== "running") return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      // returnValue is required for the browser dialog to appear.
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [phase]);

  // Fullscreen: enter when strict mode is toggled on, exit on toggle off.
  useEffect(() => {
    if (strictMode) {
      document.documentElement.requestFullscreen?.().catch(() => {
        // Fullscreen may be blocked (e.g. user denied, iframe) — silently degrade.
        setStrictMode(false);
      });
    } else if (document.fullscreenElement) {
      document.exitFullscreen?.().catch(() => {});
    }
  }, [strictMode]);

  // Sync strict mode state when the user exits fullscreen via Esc or browser UI.
  useEffect(() => {
    const handler = () => {
      if (!document.fullscreenElement) setStrictMode(false);
    };
    document.addEventListener("fullscreenchange", handler);
    return () => document.removeEventListener("fullscreenchange", handler);
  }, []);

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------

  const handleStart = useCallback(() => {
    startedAtRef.current = Date.now();
    focusLossCountRef.current = 0;
    setFocusLossCount(0);
    setTimer({ phase: "running", elapsed: 0, pausedElapsed: 0 });
    void recordSessionEventAction(sessionId, "started", {});
  }, [sessionId]);

  const handlePause = useCallback(() => {
    const acc =
      startedAtRef.current !== null
        ? pausedElapsed + (Date.now() - startedAtRef.current) / 1000
        : pausedElapsed;
    startedAtRef.current = null;
    setTimer({ phase: "paused", elapsed: acc, pausedElapsed: acc });
  }, [pausedElapsed]);

  const handleResume = useCallback(() => {
    startedAtRef.current = Date.now();
    setTimer((t) => ({ ...t, phase: "running" }));
  }, []);

  const handleDone = useCallback(async () => {
    setTimer((t) => ({ ...t, phase: "completing" }));
    const currentElapsed = startedAtRef.current !== null
      ? pausedElapsed + (Date.now() - startedAtRef.current) / 1000
      : pausedElapsed;
    const result = await markDoneAction(
      sessionId,
      focusLossCountRef.current,
      Math.round(currentElapsed),
    );
    if (result.ok) {
      try { sessionStorage.removeItem(storageKey(sessionId)); } catch { /* ignore */ }
      setTimer((t) => ({ ...t, phase: "completed" }));
    } else {
      setErrorMessage(result.error);
      setTimer((t) => ({ ...t, phase: "error" }));
    }
  }, [sessionId, pausedElapsed]);

  const handleMissed = useCallback(async () => {
    setTimer((t) => ({ ...t, phase: "missing" }));
    const currentElapsed = startedAtRef.current !== null
      ? pausedElapsed + (Date.now() - startedAtRef.current) / 1000
      : pausedElapsed;
    const result = await markMissedAction(sessionId, Math.round(currentElapsed));
    if (result.ok) {
      try { sessionStorage.removeItem(storageKey(sessionId)); } catch { /* ignore */ }
      setMissedResult({ changes: result.changes, warnings: result.warnings });
      setTimer((t) => ({ ...t, phase: "plan-updated" }));
    } else {
      setErrorMessage(result.error);
      setTimer((t) => ({ ...t, phase: "error" }));
    }
  }, [sessionId, pausedElapsed]);

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  const isStudying = phase === "idle" || phase === "running" || phase === "paused";
  const isOverlay =
    phase === "completing" ||
    phase === "completed" ||
    phase === "missing" ||
    phase === "plan-updated" ||
    phase === "error";

  return (
    <div
      className="min-h-screen bg-surface text-on-surface flex flex-col"
      data-testid="study-session"
      data-phase={phase}
    >
      {/* Back link — hidden during overlays to prevent accidental mid-action navigation */}
      {isStudying && (
        <header className="px-container-margin pt-stack-md flex items-center justify-between">
          <Link
            href="/today"
            className="inline-flex items-center gap-1 font-label-md text-label-md text-on-surface-variant hover:text-primary transition-colors"
          >
            <span
              className="material-symbols-outlined text-[18px]"
              aria-hidden="true"
            >
              arrow_back
            </span>
            Back to today
          </Link>

          {/* Strict Focus Mode toggle — only shown when session has started */}
          {(phase === "running" || phase === "paused") && (
            <button
              type="button"
              onClick={() => setStrictMode((v) => !v)}
              title={strictMode ? "Exit strict focus mode" : "Enter strict focus mode (fullscreen)"}
              className={
                "inline-flex items-center gap-1 font-label-sm text-label-sm transition-colors px-3 py-1.5 rounded-lg border " +
                (strictMode
                  ? "bg-primary-container text-on-primary border-primary/30"
                  : "text-on-surface-variant border-outline-variant hover:bg-surface-variant")
              }
            >
              <span className="material-symbols-outlined text-[16px]" aria-hidden="true">
                {strictMode ? "fullscreen_exit" : "fullscreen"}
              </span>
              {strictMode ? "Exit fullscreen" : "Focus mode"}
            </button>
          )}
        </header>
      )}

      {/* Study mode */}
      {isStudying && (
        <main className="flex-grow flex flex-col items-center justify-center px-container-margin gap-stack-md text-center">
          {/* Welcome-back banner — shown briefly after tab regains visibility */}
          {welcomeBackVisible && (
            <div
              role="status"
              aria-live="polite"
              className="bg-secondary-container text-on-secondary-container font-label-md text-label-md px-4 py-2 rounded-lg"
            >
              {ageBandUI.welcomeBack}
            </div>
          )}

          <span className="font-label-sm text-label-sm bg-secondary-container text-on-secondary-container px-3 py-1 rounded-full">
            {subjectName}
          </span>

          <div className="max-w-sm">
            <h1 className="font-headline-lg text-headline-lg text-on-surface mb-2">
              {topicName}
            </h1>
            <p className="font-body-lg text-body-lg text-on-surface-variant">
              {instruction}
            </p>
          </div>

          {/* Countdown timer */}
          <div
            className="text-[80px] leading-none font-mono font-bold text-primary tabular-nums"
            aria-live="polite"
            aria-label={`${formatTime(remaining)} remaining`}
            data-testid="timer-display"
          >
            {formatTime(remaining)}
          </div>

          {/* Progress track */}
          <div
            className="w-full max-w-xs h-2 bg-surface-container-highest rounded-full overflow-hidden"
            aria-hidden="true"
          >
            <div
              className="h-full bg-primary rounded-full transition-all duration-1000 ease-linear"
              style={{ width: `${progressPct}%` }}
            />
          </div>

          {/* Focus-loss indicator — subtle, shown only after the first interruption */}
          {focusLossCount > 0 && (phase === "running" || phase === "paused") && (
            <p className="font-label-sm text-label-sm text-outline">
              {focusLossCount} focus interruption{focusLossCount === 1 ? "" : "s"}
            </p>
          )}

          {/* Controls */}
          <div className="flex flex-col sm:flex-row gap-3 w-full max-w-xs">
            {phase === "idle" && (
              <button
                type="button"
                onClick={handleStart}
                className="flex-1 bg-primary text-on-primary font-label-md text-label-md px-6 py-4 rounded-xl hover:opacity-90 transition-opacity"
              >
                Start session
              </button>
            )}

            {(phase === "running" || phase === "paused") && (
              <>
                {phase === "running" ? (
                  <button
                    type="button"
                    onClick={handlePause}
                    className="flex-1 bg-surface-container border border-outline-variant text-on-surface font-label-md text-label-md px-4 py-3 rounded-xl hover:bg-surface-variant transition-colors"
                  >
                    Pause
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleResume}
                    className="flex-1 bg-surface-container border border-outline-variant text-on-surface font-label-md text-label-md px-4 py-3 rounded-xl hover:bg-surface-variant transition-colors"
                  >
                    Resume
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleDone}
                  className="flex-1 bg-primary-container text-on-primary font-label-md text-label-md px-4 py-3 rounded-xl hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
                >
                  <span
                    className="material-symbols-outlined text-[18px]"
                    aria-hidden="true"
                  >
                    check_circle
                  </span>
                  Done
                </button>
                <button
                  type="button"
                  onClick={handleMissed}
                  className="flex-1 border border-outline text-on-surface font-label-md text-label-md px-4 py-3 rounded-xl hover:bg-surface-variant transition-colors"
                >
                  Missed
                </button>
              </>
            )}
          </div>
        </main>
      )}

      {/* Overlays */}
      {isOverlay && (
        <div className="flex-grow flex flex-col items-center justify-center px-container-margin gap-stack-md text-center">
          {/* Pending */}
          {(phase === "completing" || phase === "missing") && (
            <>
              <span
                className="material-symbols-outlined text-[56px] text-primary"
                style={{
                  fontVariationSettings: "'wght' 300",
                  animation: "spin 1s linear infinite",
                }}
                aria-hidden="true"
              >
                progress_activity
              </span>
              <p className="font-headline-md text-headline-md text-on-surface">
                {phase === "completing"
                  ? "Marking complete…"
                  : "Rebuilding your plan…"}
              </p>
              {phase === "missing" && (
                <p className="font-body-md text-body-md text-on-surface-variant max-w-xs">
                  This may take a few seconds.
                </p>
              )}
            </>
          )}

          {/* Completed */}
          {phase === "completed" && (
            <>
              <span
                className="material-symbols-outlined text-[64px] text-primary"
                style={{ fontVariationSettings: "'FILL' 1" }}
                aria-hidden="true"
              >
                check_circle
              </span>
              <div>
                <h1 className="font-headline-lg text-headline-lg text-on-surface mb-2">
                  {ageBandUI.sessionCompleteMessage}
                </h1>
                <p className="font-body-lg text-body-lg text-on-surface-variant">
                  {ageBandUI.sessionCompleteSubtitle}
                </p>
              </div>
              <Link
                href="/today"
                className="mt-stack-sm inline-block bg-primary text-on-primary font-label-md text-label-md px-6 py-3 rounded-xl hover:opacity-90 transition-opacity"
              >
                Back to today
              </Link>
            </>
          )}

          {/* Plan updated */}
          {phase === "plan-updated" && missedResult && (
            <PlanUpdatedOverlay
              changes={missedResult.changes}
              warnings={missedResult.warnings}
              onDismiss={() => router.push("/today")}
            />
          )}

          {/* Error */}
          {phase === "error" && (
            <>
              <span
                className="material-symbols-outlined text-[56px] text-error"
                aria-hidden="true"
              >
                error
              </span>
              <div>
                <h1 className="font-headline-md text-headline-md text-on-surface mb-2">
                  Something went wrong
                </h1>
                <p className="font-body-md text-body-md text-on-surface-variant max-w-xs">
                  {errorMessage}
                </p>
              </div>
              <Link
                href="/today"
                className="border border-outline text-on-surface font-label-md text-label-md px-6 py-3 rounded-xl hover:bg-surface-variant transition-colors"
              >
                Back to today
              </Link>
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Plan Updated overlay
// ---------------------------------------------------------------------------

function PlanUpdatedOverlay({
  changes,
  warnings,
  onDismiss,
}: {
  changes: PlanChange[];
  warnings: PlanWarning[];
  onDismiss: () => void;
}) {
  const hasChanges = changes.length > 0;
  const hasWarnings = warnings.length > 0;

  return (
    <div className="w-full max-w-sm flex flex-col items-center gap-stack-md">
      <span
        className="material-symbols-outlined text-[64px] text-secondary"
        style={{ fontVariationSettings: "'FILL' 1" }}
        aria-hidden="true"
      >
        event_available
      </span>

      <div className="text-center">
        <h1 className="font-headline-lg text-headline-lg text-on-surface mb-2">
          Plan updated
        </h1>
        <p className="font-body-md text-body-md text-on-surface-variant">
          {hasChanges
            ? "We've rescheduled sessions around the one you missed."
            : "Your remaining sessions are unchanged."}
        </p>
      </div>

      {hasChanges && (
        <ul className="w-full space-y-2 text-left">
          {changes.map((c, i) => (
            <li
              key={i}
              className="flex items-start gap-3 p-3 bg-surface-container-lowest border border-outline-variant rounded-lg"
            >
              <span
                className={
                  "material-symbols-outlined text-[18px] mt-0.5 shrink-0 " +
                  (c.kind === "added"
                    ? "text-primary"
                    : c.kind === "removed"
                      ? "text-error"
                      : "text-secondary")
                }
                aria-hidden="true"
              >
                {c.kind === "added"
                  ? "add_circle"
                  : c.kind === "removed"
                    ? "remove_circle"
                    : "swap_horiz"}
              </span>
              <div>
                <p className="font-label-md text-label-md text-on-surface">
                  {c.label}
                </p>
                <p className="font-body-sm text-body-sm text-on-surface-variant">
                  {c.detail}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}

      {hasWarnings && (
        <ul className="w-full space-y-2 text-left">
          {warnings.map((w, i) => (
            <li
              key={i}
              className="flex items-start gap-2 p-3 bg-error-container rounded-lg"
            >
              <span
                className="material-symbols-outlined text-[18px] text-on-error-container mt-0.5 shrink-0"
                aria-hidden="true"
              >
                warning
              </span>
              <p className="font-body-sm text-body-sm text-on-error-container">
                <span className="font-label-sm text-label-sm">
                  {w.subjectName}:{" "}
                </span>
                {w.message}
              </p>
            </li>
          ))}
        </ul>
      )}

      <button
        type="button"
        onClick={onDismiss}
        className="bg-primary text-on-primary font-label-md text-label-md px-8 py-3 rounded-xl hover:opacity-90 transition-opacity"
      >
        Got it
      </button>
    </div>
  );
}
