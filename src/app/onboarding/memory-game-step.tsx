"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Reading-comprehension assessment — 5 questions on a 400-word passage.
 * Measures direct recall, recognition, inference, detail-discrimination, and
 * deeper understanding. Timing data (reading time + per-question response
 * time) feeds the memory_score used for personalisation. The student never
 * sees a numeric score.
 */

// ── Constants ────────────────────────────────────────────────────────────────

export const READ_SECONDS = 120; // max reading time before auto-advance
export const QUESTION_SECONDS = 30; // per-question countdown

// ── Passage ──────────────────────────────────────────────────────────────────

const PASSAGE = `In June 1934, a five-person research team departed from Tromsø, Norway, to survey the coastline of the Nordvik Peninsula, a remote Arctic shoreline roughly 700 kilometres north of the town of Arkhangelsk. The expedition was funded by the Norwegian Cartographic Society and led by Dr. Ingrid Halvorsen, a glaciologist who had previously spent two winters on Svalbard.

Halvorsen was joined by four colleagues: meteorologist Pieter Van den Berg, who had earlier mapped wind patterns across Greenland; marine biologist Susanna Lüttich, who was studying ringed seal breeding behaviour; structural engineer Karl Bauer, who maintained the portable equipment shelter; and expedition photographer Marta Solís, who documented terrain and wildlife throughout the journey.

The team reached the peninsula on 14 June after a nine-day sea crossing complicated by dense pack ice. Upon arrival they established base camp on the western shore at an elevation of roughly 12 metres above sea level. Instruments registered an outside temperature of −9°C on the first morning — 6°C warmer than the historical average for that location in mid-June.

Over three weeks, Halvorsen's team completed a survey of 160 kilometres of coastline. Van den Berg recorded wind speeds exceeding 90 kilometres per hour on four occasions, damaging two of the team's three thermometer stands. Lüttich identified 23 individual ringed seals at two distinct rookeries; her field notes described the western rookery as roughly twice the size of the eastern one.

The most unexpected discovery came on the eighteenth day, when Bauer found a partially buried iron crate approximately 400 metres inland from base camp. Inside were weathered logbooks belonging to a Norwegian trapper named Arnstein Kvam, dated 1911. The crate also contained a copper surveying compass and six hand-drawn maps of the interior coastline, more detailed than any existing charts for the region.

Photographs of the find were published in the journal Arctic Survey in December 1934. The article credited the discovery primarily to Bauer, a decision that prompted a public letter from Halvorsen disputing that account. The expedition returned to Tromsø on 9 August after 56 days in the field.`;

// ── Questions ────────────────────────────────────────────────────────────────

type QuestionType = "recall" | "recognition" | "inference" | "discrimination" | "understanding";

type Question = {
  id: number;
  type: QuestionType;
  prompt: string;
  options: string[];
  correct: number;
};

const QUESTIONS: Question[] = [
  {
    id: 1,
    type: "recall",
    prompt: "Who led the Nordvik expedition?",
    options: [
      "Pieter Van den Berg",
      "Dr. Ingrid Halvorsen",
      "Karl Bauer",
      "Arnstein Kvam",
    ],
    correct: 1,
  },
  {
    id: 2,
    type: "recognition",
    prompt: "Which of the following is accurate according to the passage?",
    options: [
      "The team departed from Arkhangelsk",
      "The expedition was funded by the Swedish Cartographic Society",
      "The team reached the peninsula on 14 June",
      "Base camp was established on the eastern shore",
    ],
    correct: 2,
  },
  {
    id: 3,
    type: "inference",
    prompt:
      "Based on the first-morning temperature of −9°C being 6°C warmer than the historical average, what was the historical average for that location in mid-June?",
    options: ["−3°C", "−15°C", "−9°C", "−6°C"],
    correct: 1,
  },
  {
    id: 4,
    type: "discrimination",
    prompt:
      "The iron crate was found 400 metres inland. How high above sea level was the base camp?",
    options: ["400 metres", "23 metres", "12 metres", "90 metres"],
    correct: 2,
  },
  {
    id: 5,
    type: "understanding",
    prompt: "Why did Halvorsen write a public letter after the article was published?",
    options: [
      "The article stated the discovery was made on a different day",
      "The article misidentified the iron crate's contents",
      "The article attributed the discovery to Bauer rather than to the full team",
      "The article claimed the logbooks belonged to a different trapper",
    ],
    correct: 2,
  },
];

// ── Score calculation (exported for testing) ─────────────────────────────────

/**
 * Pure score calculator. Never exposed to the student — only stored in the
 * profile for personalisation.
 *
 * @param correct     Number of correct answers (0..totalQuestions)
 * @param totalQ      Total number of questions
 * @param avgMs       Average response time in milliseconds across all questions
 */
export function calculateMemoryScore(
  correct: number,
  totalQ: number,
  avgMs: number,
): number {
  const accuracy = correct / totalQ;
  // Speed bonus 0–20: full 20 pts under 8 s, linear decay to 0 at 20 s.
  const raw = 20 * Math.max(0, (20_000 - avgMs) / 12_000);
  const speedBonus = Math.max(0, Math.min(20, Math.round(raw)));
  return Math.min(100, Math.round(accuracy * 80) + speedBonus);
}

// ── Types ────────────────────────────────────────────────────────────────────

type QuestionResult = {
  questionId: number;
  correct: boolean;
  ms: number;
};

type Phase = "ready" | "reading" | "questions" | "done";

type Props = {
  onScore: (score: number) => void;
};

// ── Component ────────────────────────────────────────────────────────────────

export function MemoryGameStep({ onScore }: Props) {
  const [phase, setPhase] = useState<Phase>("ready");
  const [readingLeft, setReadingLeft] = useState(READ_SECONDS);
  const [qLeft, setQLeft] = useState(QUESTION_SECONDS);
  const [currentQ, setCurrentQ] = useState(0);
  const [results, setResults] = useState<QuestionResult[]>([]);
  const [chosen, setChosen] = useState<number | null>(null);
  const [answered, setAnswered] = useState(false);

  const readingStartRef = useRef<number>(0);
  const qStartRef = useRef<number>(0);
  // Refs mirror the countdown state so interval callbacks always read the
  // current value — vi.advanceTimersByTime fires all ticks before React
  // re-renders, which would leave useState closures stale.
  const readingCountRef = useRef(READ_SECONDS);
  const qCountRef = useRef(QUESTION_SECONDS);

  // ── Callbacks declared before the effects that use them ─────────────────

  const beginQuestions = useCallback(() => {
    qStartRef.current = Date.now();
    setQLeft(QUESTION_SECONDS);
    setCurrentQ(0);
    setResults([]);
    setChosen(null);
    setAnswered(false);
    setPhase("questions");
  }, []);

  const recordAnswer = useCallback(
    (idx: number) => {
      if (answered) return;
      const ms = Date.now() - qStartRef.current;
      const q = QUESTIONS[currentQ];
      const correct = idx === q.correct;
      setChosen(idx);
      setAnswered(true);
      setResults((prev) => [
        ...prev,
        { questionId: q.id, correct, ms: Math.min(ms, QUESTION_SECONDS * 1000) },
      ]);
    },
    [answered, currentQ],
  );

  // ── Reading countdown — single interval; ref avoids stale closure ─────────
  useEffect(() => {
    if (phase !== "reading") return;
    readingCountRef.current = READ_SECONDS;
    const id = window.setInterval(() => {
      const next = Math.max(0, readingCountRef.current - 1);
      readingCountRef.current = next;
      setReadingLeft(next);
      if (next === 0) {
        beginQuestions();
      }
    }, 1000);
    return () => clearInterval(id);
  }, [phase, beginQuestions]);

  // ── Per-question countdown — single interval; ref avoids stale closure ───
  useEffect(() => {
    if (phase !== "questions" || answered) return;
    qCountRef.current = QUESTION_SECONDS;
    const id = window.setInterval(() => {
      const next = Math.max(0, qCountRef.current - 1);
      qCountRef.current = next;
      setQLeft(next);
      if (next === 0) {
        recordAnswer(-1);
      }
    }, 1000);
    return () => clearInterval(id);
  }, [phase, answered, recordAnswer]);

  // ── Handlers ─────────────────────────────────────────────────────────────

  const startReading = useCallback(() => {
    readingStartRef.current = Date.now();
    setReadingLeft(READ_SECONDS);
    setPhase("reading");
  }, []);

  const advance = useCallback(() => {
    const nextResults = results;
    if (currentQ + 1 >= QUESTIONS.length) {
      // All questions done — calculate and emit score
      const correctCount = nextResults.filter((r) => r.correct).length;
      const avgMs =
        nextResults.length > 0
          ? nextResults.reduce((s, r) => s + r.ms, 0) / nextResults.length
          : QUESTION_SECONDS * 1000;
      const score = calculateMemoryScore(correctCount, QUESTIONS.length, avgMs);
      onScore(score);
      setPhase("done");
    } else {
      setCurrentQ((q) => q + 1);
      setChosen(null);
      setAnswered(false);
      setQLeft(QUESTION_SECONDS);
      qStartRef.current = Date.now();
    }
  }, [currentQ, results, onScore]);

  const q = QUESTIONS[currentQ];

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <section>
      <h1 className="font-headline-lg-mobile md:font-headline-lg text-headline-lg-mobile md:text-headline-lg text-on-surface mb-2">
        Quick learning check
      </h1>
      <p className="font-body-md text-body-md text-on-surface-variant mb-stack-lg">
        Pace uses this to understand how to present information most effectively
        for you.
      </p>

      {/* ── Ready ── */}
      {phase === "ready" && (
        <div className="text-center py-stack-lg flex flex-col items-center gap-4">
          <div className="w-14 h-14 rounded-full bg-secondary-container/30 flex items-center justify-center">
            <span className="material-symbols-outlined text-primary text-[28px]">
              psychology
            </span>
          </div>
          <p className="font-body-md text-body-md text-on-surface-variant max-w-xs">
            Read a short passage, then answer five questions. Takes about 3 minutes.
          </p>
          <button
            type="button"
            onClick={startReading}
            className="bg-primary text-on-primary font-label-md text-label-md px-8 py-3 rounded-xl hover:opacity-90 transition-opacity shadow-sm"
          >
            Start
          </button>
          <p className="font-body-sm text-body-sm text-outline">
            You can skip by pressing Continue below.
          </p>
        </div>
      )}

      {/* ── Reading ── */}
      {phase === "reading" && (
        <div className="flex flex-col gap-stack-md">
          <div className="flex items-center justify-between mb-1">
            <p className="font-label-sm text-label-sm text-outline uppercase tracking-wider">
              Read carefully
            </p>
            <ReadingTimer secondsLeft={readingLeft} />
          </div>
          <div className="p-5 bg-surface-container-low border border-outline-variant rounded-xl">
            {PASSAGE.split("\n\n").map((para, i) => (
              <p
                key={i}
                className="font-body-md text-body-md text-on-surface leading-relaxed mb-4 last:mb-0"
              >
                {para}
              </p>
            ))}
          </div>
          <button
            type="button"
            onClick={beginQuestions}
            className="self-end bg-primary text-on-primary font-label-md text-label-md px-6 py-3 rounded-xl hover:opacity-90 transition-opacity shadow-sm"
          >
            I&rsquo;m ready →
          </button>
        </div>
      )}

      {/* ── Questions ── */}
      {phase === "questions" && q && (
        <div className="flex flex-col gap-stack-md">
          {/* Progress + timer */}
          <div className="flex items-center gap-3">
            <span className="font-label-sm text-label-sm text-outline tabular-nums shrink-0">
              {currentQ + 1} / {QUESTIONS.length}
            </span>
            <div className="flex-grow h-1 bg-surface-container-highest rounded-full overflow-hidden">
              <div
                className="h-full bg-primary-container rounded-full transition-all duration-300"
                style={{ width: `${((currentQ + 1) / QUESTIONS.length) * 100}%` }}
              />
            </div>
            <QuestionTimer secondsLeft={qLeft} />
          </div>

          <p className="font-headline-sm text-headline-sm text-on-surface">{q.prompt}</p>

          <div className="flex flex-col gap-2">
            {q.options.map((opt, i) => {
              let cls =
                "w-full text-left px-4 py-3 rounded-xl border font-body-md text-body-md transition-all ";
              if (!answered) {
                cls +=
                  chosen === i
                    ? "border-primary bg-secondary-container/30 text-on-surface"
                    : "border-outline-variant text-on-surface hover:border-primary bg-surface";
              } else if (i === q.correct) {
                cls += "border-primary bg-secondary-container/30 text-on-surface";
              } else if (i === chosen) {
                cls += "border-error/60 bg-error/5 text-on-surface";
              } else {
                cls +=
                  "border-outline-variant text-on-surface-variant opacity-50 bg-surface";
              }
              return (
                <button
                  key={i}
                  type="button"
                  onClick={() => recordAnswer(i)}
                  disabled={answered}
                  aria-pressed={chosen === i}
                  className={cls}
                >
                  {opt}
                </button>
              );
            })}
          </div>

          {answered && (
            <button
              type="button"
              onClick={advance}
              className="self-end bg-primary text-on-primary font-label-md text-label-md px-6 py-3 rounded-xl hover:opacity-90 transition-opacity shadow-sm"
            >
              {currentQ + 1 < QUESTIONS.length ? "Next →" : "Finish"}
            </button>
          )}
        </div>
      )}

      {/* ── Done ── */}
      {phase === "done" && (
        <div className="text-center py-stack-lg flex flex-col items-center gap-4">
          <div className="w-14 h-14 rounded-full bg-secondary-container/30 flex items-center justify-center">
            <span className="material-symbols-outlined text-primary text-[28px]">
              check_circle
            </span>
          </div>
          <p className="font-headline-sm text-headline-sm text-on-surface">
            Nice — Pace has a better idea of how to help you learn.
          </p>
          <p className="font-body-md text-body-md text-on-surface-variant max-w-xs">
            Hit <strong>Continue</strong> below to finish your setup.
          </p>
        </div>
      )}
    </section>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function ReadingTimer({ secondsLeft }: { secondsLeft: number }) {
  const mins = Math.floor(secondsLeft / 60);
  const secs = secondsLeft % 60;
  const display = `${mins}:${String(secs).padStart(2, "0")}`;
  return (
    <span
      aria-live="polite"
      aria-label={`Reading time remaining: ${secondsLeft} seconds`}
      className="font-label-sm text-label-sm text-outline tabular-nums"
    >
      {display}
    </span>
  );
}

function QuestionTimer({ secondsLeft }: { secondsLeft: number }) {
  const urgent = secondsLeft <= 10;
  return (
    <span
      aria-live="polite"
      aria-label={`Time remaining: ${secondsLeft} seconds`}
      className={`font-label-md text-label-md tabular-nums shrink-0 transition-colors ${
        urgent ? "text-error" : "text-outline"
      }`}
    >
      {secondsLeft}s
    </span>
  );
}
