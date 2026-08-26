"use client";

import { useEffect, useReducer, useState, useTransition } from "react";

import {
  DAYS_OF_WEEK,
  hasOverlappingWindows,
  SESSION_LENGTHS,
  SubjectDraftSchema,
  AvailabilityWindowSchema,
  type SessionLength,
} from "@/lib/validation/onboarding";
import { commitOnboardingAction } from "@/server/actions/onboarding";
import { suggestTopicsAction } from "@/server/actions/suggestions";

/**
 * Onboarding wizard — client state machine.
 *
 * Steps 1..5 = data capture, step 6 = review. All state lives in the client
 * until the final "Create my plan" click — one atomic-ish save at the end.
 * Validation runs on Continue and Create only (B-i).
 */

type StepIndex = 1 | 2 | 3 | 4 | 5 | 6;

type TopicDraft = { clientId: string; name: string };
type SubjectDraft = {
  clientId: string;
  name: string;
  examDate: string | null;
  topics: TopicDraft[];
};
type AvailabilityWindowDraft = {
  clientId: string;
  dayOfWeek: number;
  startsAt: string;
  endsAt: string;
};

type State = {
  step: StepIndex;
  subjects: SubjectDraft[];
  availability: AvailabilityWindowDraft[];
  sessionLengthMinutes: SessionLength | null;
};

type Action =
  | { type: "SET_STEP"; step: StepIndex }
  | { type: "ADD_SUBJECT"; name: string }
  | { type: "REMOVE_SUBJECT"; clientId: string }
  | { type: "ADD_TOPIC"; subjectClientId: string; name: string }
  | { type: "REMOVE_TOPIC"; subjectClientId: string; topicClientId: string }
  | { type: "SET_EXAM_DATE"; subjectClientId: string; date: string | null }
  | {
      type: "ADD_WINDOW";
      dayOfWeek: number;
      startsAt: string;
      endsAt: string;
    }
  | { type: "REMOVE_WINDOW"; clientId: string }
  | { type: "SET_SESSION_LENGTH"; minutes: SessionLength };

// Counter-based client ids — collisions across a single wizard session are
// impossible without needing crypto.randomUUID (which triggered our
// no-Date.now-style caveats elsewhere).
let nextClientId = 1;
const cid = () => `c${nextClientId++}`;

const initialState: State = {
  step: 1,
  subjects: [],
  availability: [],
  sessionLengthMinutes: null,
};

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "SET_STEP":
      return { ...state, step: action.step };
    case "ADD_SUBJECT": {
      const name = action.name.trim();
      if (!name) return state;
      if (state.subjects.some((s) => s.name.toLowerCase() === name.toLowerCase())) {
        return state;
      }
      return {
        ...state,
        subjects: [
          ...state.subjects,
          { clientId: cid(), name, examDate: null, topics: [] },
        ],
      };
    }
    case "REMOVE_SUBJECT":
      return {
        ...state,
        subjects: state.subjects.filter((s) => s.clientId !== action.clientId),
      };
    case "ADD_TOPIC": {
      const name = action.name.trim();
      if (!name) return state;
      return {
        ...state,
        subjects: state.subjects.map((s) =>
          s.clientId === action.subjectClientId
            ? {
                ...s,
                topics: s.topics.some(
                  (t) => t.name.toLowerCase() === name.toLowerCase(),
                )
                  ? s.topics
                  : [...s.topics, { clientId: cid(), name }],
              }
            : s,
        ),
      };
    }
    case "REMOVE_TOPIC":
      return {
        ...state,
        subjects: state.subjects.map((s) =>
          s.clientId === action.subjectClientId
            ? {
                ...s,
                topics: s.topics.filter(
                  (t) => t.clientId !== action.topicClientId,
                ),
              }
            : s,
        ),
      };
    case "SET_EXAM_DATE":
      return {
        ...state,
        subjects: state.subjects.map((s) =>
          s.clientId === action.subjectClientId
            ? { ...s, examDate: action.date }
            : s,
        ),
      };
    case "ADD_WINDOW":
      return {
        ...state,
        availability: [
          ...state.availability,
          {
            clientId: cid(),
            dayOfWeek: action.dayOfWeek,
            startsAt: action.startsAt,
            endsAt: action.endsAt,
          },
        ],
      };
    case "REMOVE_WINDOW":
      return {
        ...state,
        availability: state.availability.filter(
          (w) => w.clientId !== action.clientId,
        ),
      };
    case "SET_SESSION_LENGTH":
      return { ...state, sessionLengthMinutes: action.minutes };
  }
}

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

/** Validate ONLY the current step. Returns null on success, or a message. */
function validateStep(state: State): string | null {
  switch (state.step) {
    case 1:
      if (state.subjects.length === 0) return "Add at least one subject.";
      return null;
    case 2:
      if (state.subjects.some((s) => s.topics.length === 0)) {
        return "Add at least one topic per subject.";
      }
      return null;
    case 3:
      if (!state.subjects.some((s) => s.examDate !== null)) {
        return "At least one subject needs an exam or target date.";
      }
      return null;
    case 4: {
      if (state.availability.length === 0) {
        return "Add at least one availability window.";
      }
      for (const w of state.availability) {
        const parsed = AvailabilityWindowSchema.safeParse(w);
        if (!parsed.success) return parsed.error.issues[0].message;
      }
      if (hasOverlappingWindows(state.availability)) {
        return "Availability windows overlap on the same day.";
      }
      return null;
    }
    case 5:
      if (state.sessionLengthMinutes == null) {
        return "Pick a session length.";
      }
      return null;
    case 6:
      // Full-input schema is validated on the server; no client-only check here.
      return null;
  }
}

export function Wizard() {
  const [state, dispatch] = useReducer(reducer, initialState);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const currentValidation = () => {
    const msg = validateStep(state);
    setError(msg);
    return msg === null;
  };

  const goNext = () => {
    if (!currentValidation()) return;
    if (state.step < 6) {
      setError(null);
      dispatch({ type: "SET_STEP", step: (state.step + 1) as StepIndex });
    }
  };

  const goBack = () => {
    if (state.step > 1) {
      setError(null);
      dispatch({ type: "SET_STEP", step: (state.step - 1) as StepIndex });
    }
  };

  const submit = () => {
    // Strip clientIds before sending — matches OnboardingSchema.
    const payload = {
      subjects: state.subjects.map((s) => ({
        name: s.name,
        examDate: s.examDate,
        topics: s.topics.map((t) => ({ name: t.name })),
      })),
      availability: state.availability.map((w) => ({
        dayOfWeek: w.dayOfWeek,
        startsAt: w.startsAt,
        endsAt: w.endsAt,
      })),
      sessionLengthMinutes: state.sessionLengthMinutes,
    };

    startTransition(async () => {
      const result = await commitOnboardingAction(null, payload);
      if (result && !result.ok) {
        setError(result.error);
      }
      // On success the action redirects — control never returns here.
    });
  };

  const isReview = state.step === 6;
  const stepLabel = isReview ? "Review" : `Step ${state.step} of 5`;
  const progressPct = (state.step / 6) * 100;

  return (
    <div className="min-h-full flex flex-col bg-surface text-on-surface">
      {/* Sticky top header with logo + step indicator + progress bar (DESIGN-SPEC.md §2.16) */}
      <header className="w-full max-w-[600px] mx-auto px-container-margin pt-stack-lg">
        <div className="flex items-center justify-between mb-base">
          <span className="font-display text-headline-md text-primary">Pace</span>
          <span className="font-label-md text-label-md text-on-surface-variant">
            {stepLabel}
          </span>
        </div>
        <div className="w-full h-1 bg-surface-container-highest rounded-full overflow-hidden">
          <div
            className="h-full bg-primary-container rounded-full transition-all duration-500 ease-out"
            style={{ width: `${progressPct}%` }}
          />
        </div>
      </header>

      <main className="flex-grow w-full max-w-[600px] mx-auto px-container-margin pt-stack-lg pb-32">
        {state.step === 1 && <SubjectsStep state={state} dispatch={dispatch} />}
        {state.step === 2 && <TopicsStep state={state} dispatch={dispatch} />}
        {state.step === 3 && <ExamDatesStep state={state} dispatch={dispatch} />}
        {state.step === 4 && <AvailabilityStep state={state} dispatch={dispatch} />}
        {state.step === 5 && <SessionLengthStep state={state} dispatch={dispatch} />}
        {state.step === 6 && (
          <ReviewStep state={state} onEdit={(s) => dispatch({ type: "SET_STEP", step: s })} />
        )}

        {error && (
          <p
            role="alert"
            className="mt-stack-md font-label-md text-label-md text-error"
          >
            {error}
          </p>
        )}
      </main>

      {/* Fixed bottom action bar (§2.16). */}
      <div className="fixed bottom-0 left-0 w-full bg-surface/95 backdrop-blur-sm border-t border-outline-variant px-container-margin py-4 z-50">
        <div className="max-w-[600px] mx-auto flex justify-between items-center">
          <button
            type="button"
            onClick={goBack}
            disabled={state.step === 1 || isPending}
            className="font-label-md text-label-md text-on-surface-variant hover:text-primary transition-colors px-4 py-2 disabled:opacity-30 disabled:cursor-not-allowed"
          >
            Back
          </button>
          {isReview ? (
            <button
              type="button"
              onClick={submit}
              disabled={isPending}
              aria-busy={isPending}
              className="bg-primary text-on-primary font-label-md text-label-md px-6 py-3 rounded-lg hover:opacity-90 transition-opacity shadow-sm disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {isPending ? "Building…" : "Create my plan"}
            </button>
          ) : (
            <button
              type="button"
              onClick={goNext}
              disabled={isPending}
              className="bg-primary-container text-on-primary font-label-md text-label-md px-6 py-3 rounded-lg hover:opacity-90 transition-opacity shadow-sm disabled:opacity-60 disabled:cursor-not-allowed"
            >
              Continue
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// -----------------------------------------------------------------------------
// Step 1 — Subjects
// -----------------------------------------------------------------------------

function SubjectsStep({
  state,
  dispatch,
}: {
  state: State;
  dispatch: React.Dispatch<Action>;
}) {
  const [draft, setDraft] = useState("");
  const add = () => {
    const parsed = SubjectDraftSchema.pick({ name: true }).safeParse({
      name: draft,
    });
    if (parsed.success) {
      dispatch({ type: "ADD_SUBJECT", name: draft });
      setDraft("");
    }
  };
  return (
    <section>
      <h1 className="font-display text-display text-primary mb-stack-sm">
        Let&rsquo;s build your plan.
      </h1>
      <p className="font-body-lg text-body-lg text-on-surface-variant mb-stack-lg">
        What subjects are you studying right now?
      </p>

      <div className="relative mb-stack-md">
        <input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add();
            }
          }}
          placeholder="e.g. Biology, Math, History"
          maxLength={100}
          className="w-full bg-transparent border-0 border-b border-outline-variant focus:border-primary-container focus:ring-0 px-0 py-3 font-body-lg text-body-lg text-on-surface placeholder:text-outline outline-none transition-colors"
        />
        <button
          type="button"
          onClick={add}
          aria-label="Add subject"
          className="absolute right-0 bottom-2 text-primary-container hover:text-primary p-2 rounded-full hover:bg-surface-container-low transition-colors"
        >
          <span className="material-symbols-outlined">add</span>
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        {state.subjects.map((s) => (
          <button
            key={s.clientId}
            type="button"
            onClick={() =>
              dispatch({ type: "REMOVE_SUBJECT", clientId: s.clientId })
            }
            aria-label={`Remove ${s.name}`}
            className="inline-flex items-center gap-2 bg-secondary-container text-on-secondary-container px-4 py-2 rounded-full font-label-md text-label-md group cursor-pointer transition-transform hover:scale-105"
          >
            {s.name}
            <span className="material-symbols-outlined text-[16px] opacity-60 group-hover:opacity-100 transition-opacity">
              close
            </span>
          </button>
        ))}
      </div>
    </section>
  );
}

// -----------------------------------------------------------------------------
// Step 2 — Topics
// -----------------------------------------------------------------------------

function TopicsStep({
  state,
  dispatch,
}: {
  state: State;
  dispatch: React.Dispatch<Action>;
}) {
  const [suggestions, setSuggestions] = useState<Record<string, string[]>>({});
  const [suggestionsLoading, setSuggestionsLoading] = useState(true);

  const subjectNames = state.subjects.map((s) => s.name);
  const subjectNamesKey = subjectNames.join("||");

  useEffect(() => {
    if (subjectNames.length === 0) {
      const id = setTimeout(() => setSuggestionsLoading(false), 0);
      return () => clearTimeout(id);
    }

    let cancelled = false;
    const id = setTimeout(() => {
      setSuggestionsLoading(true);
      suggestTopicsAction(subjectNames)
        .then((result) => {
          if (!cancelled) {
            setSuggestions(result);
            setSuggestionsLoading(false);
          }
        })
        .catch(() => {
          if (!cancelled) setSuggestionsLoading(false);
        });
    }, 0);
    return () => {
      cancelled = true;
      clearTimeout(id);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subjectNamesKey]);

  return (
    <section>
      <h1 className="font-headline-lg-mobile md:font-headline-lg text-headline-lg-mobile md:text-headline-lg text-on-surface mb-2">
        What are we tackling?
      </h1>
      <p className="font-body-md text-body-md text-on-surface-variant mb-stack-lg">
        Add the specific topics you need to focus on.
      </p>

      <div className="space-y-stack-lg">
        {state.subjects.map((s) => (
          <SubjectTopics
            key={s.clientId}
            subject={s}
            dispatch={dispatch}
            suggestions={suggestions[s.name]}
            suggestionsLoading={suggestionsLoading}
          />
        ))}
      </div>
    </section>
  );
}

function SubjectTopics({
  subject,
  dispatch,
  suggestions,
  suggestionsLoading,
}: {
  subject: SubjectDraft;
  dispatch: React.Dispatch<Action>;
  suggestions: string[] | undefined;
  suggestionsLoading: boolean;
}) {
  const [draft, setDraft] = useState("");
  const add = () => {
    if (!draft.trim()) return;
    dispatch({ type: "ADD_TOPIC", subjectClientId: subject.clientId, name: draft });
    setDraft("");
  };

  const addedNames = new Set(subject.topics.map((t) => t.name.toLowerCase()));

  const handleChipClick = (name: string) => {
    const existing = subject.topics.find(
      (t) => t.name.toLowerCase() === name.toLowerCase(),
    );
    if (existing) {
      dispatch({
        type: "REMOVE_TOPIC",
        subjectClientId: subject.clientId,
        topicClientId: existing.clientId,
      });
    } else {
      dispatch({ type: "ADD_TOPIC", subjectClientId: subject.clientId, name });
    }
  };

  return (
    <div>
      <h2 className="font-label-md text-label-md uppercase tracking-wider text-outline mb-3">
        {subject.name}
      </h2>
      <ul className="space-y-3 mb-3">
        {subject.topics.map((t) => (
          <li
            key={t.clientId}
            className="flex items-center justify-between p-3 border border-outline-variant rounded bg-surface"
          >
            <span className="font-body-md text-body-md">{t.name}</span>
            <button
              type="button"
              onClick={() =>
                dispatch({
                  type: "REMOVE_TOPIC",
                  subjectClientId: subject.clientId,
                  topicClientId: t.clientId,
                })
              }
              aria-label={`Remove topic ${t.name}`}
              className="text-outline hover:text-error transition-colors"
            >
              <span className="material-symbols-outlined text-[18px]">close</span>
            </button>
          </li>
        ))}
      </ul>
      <div className="relative">
        <input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add();
            }
          }}
          placeholder={`Add a ${subject.name} topic…`}
          maxLength={200}
          className="w-full bg-transparent border-b border-outline-variant focus:border-primary focus:outline-none py-2 pr-10 font-body-md text-body-md placeholder:text-outline-variant transition-colors"
        />
        <button
          type="button"
          onClick={add}
          aria-label="Add topic"
          className="absolute right-2 top-2 text-outline-variant hover:text-primary transition-colors"
        >
          <span className="material-symbols-outlined">add_circle</span>
        </button>
      </div>

      {/* AI suggestions */}
      {suggestionsLoading && (
        <div
          className="flex flex-wrap gap-2 mt-3"
          aria-label="Loading suggestions"
        >
          {[88, 110, 76, 96].map((w) => (
            <div
              key={w}
              className="h-8 rounded-full bg-surface-container-highest animate-pulse"
              style={{ width: `${w}px` }}
              aria-hidden="true"
            />
          ))}
        </div>
      )}
      {!suggestionsLoading && suggestions && suggestions.length > 0 && (
        <div className="mt-3">
          <p className="font-label-sm text-label-sm text-outline mb-2">
            Suggestions
          </p>
          <div className="flex flex-wrap gap-2">
            {[...new Set(suggestions)].map((name) => {
              const isAdded = addedNames.has(name.toLowerCase());
              return (
                <button
                  key={name}
                  type="button"
                  onClick={() => handleChipClick(name)}
                  aria-label={
                    isAdded
                      ? `Remove suggestion ${name}`
                      : `Add suggestion ${name}`
                  }
                  aria-pressed={isAdded}
                  className={
                    "inline-flex items-center gap-1 px-3 py-1.5 rounded-full font-label-sm text-label-sm border transition-colors " +
                    (isAdded
                      ? "bg-secondary-container text-on-secondary-container border-secondary-container"
                      : "bg-surface border-outline-variant text-on-surface-variant hover:border-primary hover:text-primary")
                  }
                >
                  <span
                    className="material-symbols-outlined text-[14px]"
                    aria-hidden="true"
                  >
                    {isAdded ? "check" : "add"}
                  </span>
                  {name}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// -----------------------------------------------------------------------------
// Step 3 — Exam dates (per subject; native input, per A-i)
// -----------------------------------------------------------------------------

function ExamDatesStep({
  state,
  dispatch,
}: {
  state: State;
  dispatch: React.Dispatch<Action>;
}) {
  return (
    <section>
      <h1 className="font-headline-lg-mobile md:font-headline-lg text-headline-lg-mobile md:text-headline-lg text-on-surface mb-2">
        When do you need to be ready?
      </h1>
      <p className="font-body-md text-body-md text-on-surface-variant mb-stack-lg">
        Add an exam or target date for each subject that has one.
      </p>

      <div className="space-y-stack-md">
        {state.subjects.map((s) => (
          <div
            key={s.clientId}
            className="flex flex-col gap-1 p-4 border border-outline-variant rounded-lg bg-surface"
          >
            <label
              htmlFor={`exam-${s.clientId}`}
              className="font-label-sm text-label-sm uppercase tracking-wider text-on-surface-variant"
            >
              {s.name}
            </label>
            <input
              id={`exam-${s.clientId}`}
              type="date"
              value={s.examDate ?? ""}
              onChange={(e) =>
                dispatch({
                  type: "SET_EXAM_DATE",
                  subjectClientId: s.clientId,
                  date: e.target.value || null,
                })
              }
              className="bg-transparent border-0 border-b border-outline-variant focus:border-primary-container focus:ring-0 px-0 py-2 font-body-lg text-body-lg text-on-surface outline-none transition-colors"
            />
          </div>
        ))}
      </div>
    </section>
  );
}

// -----------------------------------------------------------------------------
// Step 4 — Availability
// -----------------------------------------------------------------------------

function AvailabilityStep({
  state,
  dispatch,
}: {
  state: State;
  dispatch: React.Dispatch<Action>;
}) {
  return (
    <section>
      <h1 className="font-headline-lg-mobile md:font-headline-lg text-headline-lg-mobile md:text-headline-lg text-on-surface mb-2">
        When can you study?
      </h1>
      <p className="font-body-md text-body-md text-on-surface-variant mb-stack-lg">
        Define your available windows. We&rsquo;ll fit sessions inside them.
      </p>
      <div className="space-y-4">
        {DAYS_OF_WEEK.map((day) => (
          <DayRow
            key={day}
            day={day}
            windows={state.availability.filter((w) => w.dayOfWeek === day)}
            dispatch={dispatch}
          />
        ))}
      </div>
    </section>
  );
}

function DayRow({
  day,
  windows,
  dispatch,
}: {
  day: number;
  windows: AvailabilityWindowDraft[];
  dispatch: React.Dispatch<Action>;
}) {
  return (
    <div className="flex items-start gap-4 p-4 border border-outline-variant rounded-lg bg-surface">
      <div className="w-12 text-center pt-1">
        <span
          className={`font-label-md text-label-md font-bold block uppercase ${
            windows.length > 0 ? "text-primary" : "text-outline"
          }`}
        >
          {DAY_LABELS[day]}
        </span>
      </div>
      <div className="flex-grow space-y-3">
        {windows.map((w) => (
          <div key={w.clientId} className="flex items-center gap-3">
            <span className="font-body-md text-body-md">
              {w.startsAt} — {w.endsAt}
            </span>
            <button
              type="button"
              onClick={() =>
                dispatch({ type: "REMOVE_WINDOW", clientId: w.clientId })
              }
              aria-label={`Remove window ${w.startsAt} to ${w.endsAt}`}
              className="text-outline-variant hover:text-error ml-auto transition-colors"
            >
              <span className="material-symbols-outlined text-[20px]">close</span>
            </button>
          </div>
        ))}
        <AddWindowInline day={day} dispatch={dispatch} />
      </div>
    </div>
  );
}

function AddWindowInline({
  day,
  dispatch,
}: {
  day: number;
  dispatch: React.Dispatch<Action>;
}) {
  const [startsAt, setStartsAt] = useState("16:00");
  const [endsAt, setEndsAt] = useState("18:00");
  const [localError, setLocalError] = useState<string | null>(null);

  const add = () => {
    const parsed = AvailabilityWindowSchema.safeParse({
      dayOfWeek: day,
      startsAt,
      endsAt,
    });
    if (!parsed.success) {
      setLocalError(parsed.error.issues[0].message);
      return;
    }
    setLocalError(null);
    dispatch({
      type: "ADD_WINDOW",
      dayOfWeek: day,
      startsAt,
      endsAt,
    });
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <input
        type="time"
        value={startsAt}
        onChange={(e) => setStartsAt(e.target.value)}
        aria-label="Start time"
        className="bg-surface-container-lowest border-b border-outline-variant py-1 px-2 font-body-md text-body-md focus:outline-none focus:border-primary w-24"
      />
      <span className="text-outline-variant font-label-sm text-label-sm">to</span>
      <input
        type="time"
        value={endsAt}
        onChange={(e) => setEndsAt(e.target.value)}
        aria-label="End time"
        className="bg-surface-container-lowest border-b border-outline-variant py-1 px-2 font-body-md text-body-md focus:outline-none focus:border-primary w-24"
      />
      <button
        type="button"
        onClick={add}
        className="font-label-sm text-label-sm text-primary flex items-center gap-1 hover:underline ml-2"
      >
        <span className="material-symbols-outlined text-[16px]">add</span> Add window
      </button>
      {localError && (
        <p role="alert" className="w-full font-label-sm text-label-sm text-error">
          {localError}
        </p>
      )}
    </div>
  );
}

// -----------------------------------------------------------------------------
// Step 5 — Session length
// -----------------------------------------------------------------------------

const SESSION_DESCRIPTIONS: Record<SessionLength, string> = {
  25: "Pomodoro style. Short, intense bursts of focus.",
  45: "Balanced approach. Deep work with scheduled breaks.",
  60: "Standard block. Good for comprehensive review.",
};

function SessionLengthStep({
  state,
  dispatch,
}: {
  state: State;
  dispatch: React.Dispatch<Action>;
}) {
  return (
    <section>
      <h1 className="font-headline-lg-mobile md:font-headline-lg text-headline-lg-mobile md:text-headline-lg text-on-surface mb-2">
        Preferred session length
      </h1>
      <p className="font-body-md text-body-md text-on-surface-variant mb-stack-lg">
        How long do you typically focus before taking a break?
      </p>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {SESSION_LENGTHS.map((minutes) => {
          const selected = state.sessionLengthMinutes === minutes;
          return (
            <button
              key={minutes}
              type="button"
              onClick={() =>
                dispatch({ type: "SET_SESSION_LENGTH", minutes })
              }
              className={`text-left border rounded-xl p-6 h-full bg-surface transition-all ${
                selected
                  ? "border-primary bg-secondary-container/20"
                  : "border-outline-variant hover:border-primary"
              }`}
              aria-pressed={selected}
            >
              <div className="flex justify-between items-start mb-4">
                <span
                  className={`material-symbols-outlined ${
                    selected ? "text-primary" : "text-outline-variant"
                  }`}
                >
                  {minutes === 25 ? "timer" : minutes === 45 ? "schedule" : "hourglass_empty"}
                </span>
                <span
                  className={`w-5 h-5 rounded-full border flex items-center justify-center ${
                    selected ? "border-primary bg-primary" : "border-outline-variant"
                  }`}
                  aria-hidden="true"
                >
                  {selected && (
                    <span className="material-symbols-outlined text-[14px] text-on-primary filled">
                      check
                    </span>
                  )}
                </span>
              </div>
              <h3 className="font-headline-md text-headline-md mb-1">
                {minutes} minutes
              </h3>
              <p className="font-body-md text-body-md text-on-surface-variant text-sm">
                {SESSION_DESCRIPTIONS[minutes]}
              </p>
            </button>
          );
        })}
      </div>
    </section>
  );
}

// -----------------------------------------------------------------------------
// Step 6 — Review
// -----------------------------------------------------------------------------

function ReviewStep({
  state,
  onEdit,
}: {
  state: State;
  onEdit: (step: StepIndex) => void;
}) {
  const availabilityDays = Array.from(
    new Set(state.availability.map((w) => w.dayOfWeek)),
  )
    .sort()
    .map((d) => DAY_LABELS[d])
    .join(", ");
  const totalMinutes = state.availability.reduce((acc, w) => {
    const [sH, sM] = w.startsAt.split(":").map(Number);
    const [eH, eM] = w.endsAt.split(":").map(Number);
    return acc + (eH * 60 + eM - (sH * 60 + sM));
  }, 0);
  const totalHours = Math.round((totalMinutes / 60) * 10) / 10;

  return (
    <section>
      <div className="text-center mb-stack-lg">
        <span className="material-symbols-outlined text-primary text-[48px] mb-4">
          verified
        </span>
        <h1 className="font-headline-lg-mobile md:font-headline-lg text-headline-lg-mobile md:text-headline-lg text-on-surface mb-2">
          Review your setup
        </h1>
        <p className="font-body-md text-body-md text-on-surface-variant">
          Here&rsquo;s the structure we&rsquo;ll use to build your plan.
        </p>
      </div>
      <div className="border-y border-outline-variant divide-y divide-outline-variant">
        <ReviewRow
          label="Subjects & topics"
          value={state.subjects
            .map(
              (s) =>
                `${s.name}${s.topics.length ? ` (${s.topics.map((t) => t.name).join(", ")})` : ""}`,
            )
            .join("; ")}
          onEdit={() => onEdit(1)}
        />
        <ReviewRow
          label="Target dates"
          value={
            state.subjects.filter((s) => s.examDate).length > 0
              ? state.subjects
                  .filter((s) => s.examDate)
                  .map((s) => `${s.name}: ${s.examDate}`)
                  .join("; ")
              : "(none set)"
          }
          onEdit={() => onEdit(3)}
        />
        <ReviewRow
          label="Weekly availability"
          value={`~${totalHours} h/week (${availabilityDays || "none"})`}
          onEdit={() => onEdit(4)}
        />
        <ReviewRow
          label="Session length"
          value={
            state.sessionLengthMinutes
              ? `${state.sessionLengthMinutes} minutes`
              : "(not set)"
          }
          onEdit={() => onEdit(5)}
        />
      </div>
    </section>
  );
}

function ReviewRow({
  label,
  value,
  onEdit,
}: {
  label: string;
  value: string;
  onEdit: () => void;
}) {
  return (
    <div className="py-4 flex justify-between items-start gap-4">
      <div className="min-w-0">
        <h4 className="font-label-sm text-label-sm text-outline uppercase mb-1">
          {label}
        </h4>
        <p className="font-body-md text-body-md break-words">{value}</p>
      </div>
      <button
        type="button"
        onClick={onEdit}
        className="text-outline-variant hover:text-primary font-label-md text-label-md shrink-0"
      >
        Edit
      </button>
    </div>
  );
}
