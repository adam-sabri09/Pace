"use client";

import { useEffect, useReducer, useState, useTransition } from "react";

import {
  DAYS_OF_WEEK,
  hasOverlappingWindows,
  SESSION_LENGTHS,
  SubjectDraftSchema,
  AvailabilityWindowSchema,
  AGE_BANDS,
  AGE_BAND_LABELS,
  STUDY_HABITS,
  CHALLENGES,
  TASK_TYPES,
  type SessionLength,
  type AgeBand,
  type TaskType,
  type TaskFrequency,
} from "@/lib/validation/onboarding";
import { commitOnboardingAction } from "@/server/actions/onboarding";
import { suggestTopicsAction } from "@/server/actions/suggestions";
import { GoalRankingStep } from "./goal-ranking-step";
import { MemoryGameStep } from "./memory-game-step";

/**
 * Onboarding wizard — client state machine.
 *
 * Steps 1–9 = data capture, step 10 = review. All state lives in the client
 * until the final "Create my plan" click — one atomic-ish save at the end.
 * Validation runs on Continue and Create only (B-i).
 */

// Steps 1–9 are data-entry; 10 is review.
type StepIndex = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;
const TOTAL_DATA_STEPS = 9;

type TopicDraft = { clientId: string; name: string };
type WorkloadItemDraft = {
  clientId: string;
  taskType: TaskType;
  dueDate: string | null;
  frequency: TaskFrequency | null;
  priority: "low" | "medium" | "high";
};
type SubjectDraft = {
  clientId: string;
  name: string;
  examDate: string | null;
  topics: TopicDraft[];
  difficulty: "easy" | "medium" | "hard" | null;
  confidencePct: number | null;
  workloadItems: WorkloadItemDraft[];
};
type AvailabilityWindowDraft = {
  clientId: string;
  dayOfWeek: number;
  startsAt: string;
  endsAt: string;
};

type State = {
  step: StepIndex;
  // Core (original)
  subjects: SubjectDraft[];
  availability: AvailabilityWindowDraft[];
  sessionLengthMinutes: SessionLength | null;
  // Extended (new onboarding steps)
  ageBand: AgeBand | null;
  studyHabits: string[];
  studyChallenges: string[];
  goalRanking: string[];
  memoryScore: number | null;
};

type Action =
  | { type: "SET_STEP"; step: StepIndex }
  | { type: "ADD_SUBJECT"; name: string }
  | { type: "REMOVE_SUBJECT"; clientId: string }
  | { type: "SET_DIFFICULTY"; clientId: string; difficulty: "easy" | "medium" | "hard" | null }
  | { type: "SET_CONFIDENCE"; clientId: string; confidencePct: number | null }
  | { type: "ADD_WORKLOAD_ITEM"; subjectClientId: string; item: Omit<WorkloadItemDraft, "clientId"> }
  | { type: "REMOVE_WORKLOAD_ITEM"; subjectClientId: string; itemClientId: string }
  | { type: "ADD_TOPIC"; subjectClientId: string; name: string }
  | { type: "REMOVE_TOPIC"; subjectClientId: string; topicClientId: string }
  | { type: "SET_EXAM_DATE"; subjectClientId: string; date: string | null }
  | { type: "ADD_WINDOW"; dayOfWeek: number; startsAt: string; endsAt: string }
  | { type: "REMOVE_WINDOW"; clientId: string }
  | { type: "SET_SESSION_LENGTH"; minutes: SessionLength }
  | { type: "SET_AGE_BAND"; ageBand: AgeBand | null }
  | { type: "TOGGLE_STUDY_HABIT"; habit: string }
  | { type: "TOGGLE_CHALLENGE"; challenge: string }
  | { type: "SET_GOAL_RANKING"; ranking: string[] }
  | { type: "SET_MEMORY_SCORE"; score: number };

// Counter-based client ids — collisions across a single wizard session are
// impossible without needing crypto.randomUUID.
let nextClientId = 1;
const cid = () => `c${nextClientId++}`;

const initialState: State = {
  step: 1,
  subjects: [],
  availability: [],
  sessionLengthMinutes: null,
  ageBand: null,
  studyHabits: [],
  studyChallenges: [],
  goalRanking: [],
  memoryScore: null,
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
          { clientId: cid(), name, examDate: null, topics: [], difficulty: null, confidencePct: null, workloadItems: [] },
        ],
      };
    }
    case "REMOVE_SUBJECT":
      return {
        ...state,
        subjects: state.subjects.filter((s) => s.clientId !== action.clientId),
      };
    case "SET_DIFFICULTY":
      return {
        ...state,
        subjects: state.subjects.map((s) =>
          s.clientId === action.clientId ? { ...s, difficulty: action.difficulty } : s,
        ),
      };
    case "SET_CONFIDENCE":
      return {
        ...state,
        subjects: state.subjects.map((s) =>
          s.clientId === action.clientId ? { ...s, confidencePct: action.confidencePct } : s,
        ),
      };
    case "ADD_WORKLOAD_ITEM":
      return {
        ...state,
        subjects: state.subjects.map((s) =>
          s.clientId === action.subjectClientId
            ? { ...s, workloadItems: [...s.workloadItems, { clientId: cid(), ...action.item }] }
            : s,
        ),
      };
    case "REMOVE_WORKLOAD_ITEM":
      return {
        ...state,
        subjects: state.subjects.map((s) =>
          s.clientId === action.subjectClientId
            ? { ...s, workloadItems: s.workloadItems.filter((i) => i.clientId !== action.itemClientId) }
            : s,
        ),
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
    case "SET_AGE_BAND":
      return { ...state, ageBand: action.ageBand };
    case "TOGGLE_STUDY_HABIT": {
      const has = state.studyHabits.includes(action.habit);
      return {
        ...state,
        studyHabits: has
          ? state.studyHabits.filter((h) => h !== action.habit)
          : [...state.studyHabits, action.habit],
      };
    }
    case "TOGGLE_CHALLENGE": {
      const has = state.studyChallenges.includes(action.challenge);
      return {
        ...state,
        studyChallenges: has
          ? state.studyChallenges.filter((c) => c !== action.challenge)
          : [...state.studyChallenges, action.challenge],
      };
    }
    case "SET_GOAL_RANKING":
      return { ...state, goalRanking: action.ranking };
    case "SET_MEMORY_SCORE":
      return { ...state, memoryScore: action.score };
  }
}

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

/** Validate ONLY the current step. Returns null on success, or a message. */
function validateStep(state: State): string | null {
  switch (state.step) {
    case 1:
      // Age band is optional — user can proceed without selecting.
      return null;
    case 2:
      if (state.subjects.length === 0) return "Add at least one subject.";
      return null;
    case 3:
      if (state.subjects.some((s) => s.topics.length === 0)) {
        return "Add at least one topic per subject.";
      }
      return null;
    case 4:
      // Workload items are all optional — any combination (or none) is valid.
      return null;
    case 5: {
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
    case 6:
      if (state.sessionLengthMinutes == null) {
        return "Pick a session length.";
      }
      return null;
    case 7:
    case 8:
    case 9:
    case 10:
      // Study habits, goal ranking, memory game, and review are all optional/server-validated.
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
    if (state.step < 10) {
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
        difficulty: s.difficulty ?? undefined,
        confidencePct: s.confidencePct ?? undefined,
        workloadItems: s.workloadItems.map((w) => ({
          taskType: w.taskType,
          dueDate: w.dueDate,
          frequency: w.frequency ?? undefined,
          priority: w.priority,
        })),
      })),
      availability: state.availability.map((w) => ({
        dayOfWeek: w.dayOfWeek,
        startsAt: w.startsAt,
        endsAt: w.endsAt,
      })),
      sessionLengthMinutes: state.sessionLengthMinutes,
      ageBand: state.ageBand ?? undefined,
      studyHabits: state.studyHabits.length > 0 ? state.studyHabits : undefined,
      studyChallenges: state.studyChallenges.length > 0 ? state.studyChallenges : undefined,
      goalRanking: state.goalRanking.length > 0 ? state.goalRanking : undefined,
      memoryScore: state.memoryScore ?? undefined,
    };

    startTransition(async () => {
      const result = await commitOnboardingAction(null, payload);
      if (result && !result.ok) {
        setError(result.error);
      }
      // On success the action redirects — control never returns here.
    });
  };

  const isReview = state.step === 10;
  const stepLabel = isReview ? "Review" : `Step ${state.step} of ${TOTAL_DATA_STEPS}`;
  const progressPct = (state.step / 10) * 100;

  return (
    <div className="min-h-full flex flex-col bg-surface text-on-surface">
      {/* Sticky top header with logo + step indicator + progress bar */}
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
        {state.step === 1 && <AgeBandStep state={state} dispatch={dispatch} />}
        {state.step === 2 && <SubjectsStep state={state} dispatch={dispatch} />}
        {state.step === 3 && <TopicsStep state={state} dispatch={dispatch} />}
        {state.step === 4 && <WorkloadStep state={state} dispatch={dispatch} />}
        {state.step === 5 && <AvailabilityStep state={state} dispatch={dispatch} />}
        {state.step === 6 && <SessionLengthStep state={state} dispatch={dispatch} />}
        {state.step === 7 && <StudyHabitsStep state={state} dispatch={dispatch} />}
        {state.step === 8 && (
          <GoalRankingStep
            ranking={state.goalRanking}
            onChange={(ranking) => dispatch({ type: "SET_GOAL_RANKING", ranking })}
          />
        )}
        {state.step === 9 && (
          <MemoryGameStep
            onScore={(score) => dispatch({ type: "SET_MEMORY_SCORE", score })}
          />
        )}
        {state.step === 10 && (
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

      {/* Fixed bottom action bar */}
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
// Step 1 — Age band (new)
// -----------------------------------------------------------------------------

const AGE_BAND_ICONS: Record<AgeBand, string> = {
  junior: "🎒",
  intermediate: "📚",
  senior: "🎓",
  university: "🏛️",
  adult: "💼",
};

function AgeBandStep({
  state,
  dispatch,
}: {
  state: State;
  dispatch: React.Dispatch<Action>;
}) {
  return (
    <section>
      <h1 className="font-display text-display text-primary mb-stack-sm">
        Let&rsquo;s build your plan.
      </h1>
      <p className="font-body-lg text-body-lg text-on-surface-variant mb-stack-lg">
        Which stage best describes you?
      </p>
      <div className="flex flex-col gap-3">
        {AGE_BANDS.map((band) => {
          const selected = state.ageBand === band;
          return (
            <button
              key={band}
              type="button"
              onClick={() =>
                dispatch({
                  type: "SET_AGE_BAND",
                  ageBand: selected ? null : band,
                })
              }
              aria-pressed={selected}
              className={[
                "flex items-center gap-4 p-4 border rounded-xl bg-surface text-left transition-all",
                selected
                  ? "border-primary bg-secondary-container/20"
                  : "border-outline-variant hover:border-primary",
              ].join(" ")}
            >
              <span className="text-3xl" aria-hidden="true">
                {AGE_BAND_ICONS[band]}
              </span>
              <span className="font-body-lg text-body-lg text-on-surface">
                {AGE_BAND_LABELS[band]}
              </span>
              {selected && (
                <span className="material-symbols-outlined text-primary ml-auto text-[20px]">
                  check_circle
                </span>
              )}
            </button>
          );
        })}
      </div>
      <p className="font-body-sm text-body-sm text-outline mt-stack-md">
        This helps Pace calibrate the difficulty and pacing of your sessions.
      </p>
    </section>
  );
}

// -----------------------------------------------------------------------------
// Step 2 — Subjects (enhanced with comma trigger + per-subject difficulty)
// -----------------------------------------------------------------------------

const DIFFICULTY_LABELS = {
  easy: "Easy",
  medium: "Medium",
  hard: "Hard",
} as const;

function SubjectsStep({
  state,
  dispatch,
}: {
  state: State;
  dispatch: React.Dispatch<Action>;
}) {
  const [draft, setDraft] = useState("");

  const addFromDraft = (value: string) => {
    const parsed = SubjectDraftSchema.pick({ name: true }).safeParse({ name: value });
    if (parsed.success) {
      dispatch({ type: "ADD_SUBJECT", name: value });
      setDraft("");
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    // Comma-triggered: split on comma and add each non-empty part immediately.
    if (value.includes(",")) {
      const parts = value.split(",").map((p) => p.trim()).filter(Boolean);
      for (const part of parts) {
        dispatch({ type: "ADD_SUBJECT", name: part });
      }
      setDraft("");
    } else {
      setDraft(value);
    }
  };

  return (
    <section>
      <h1 className="font-display text-display text-primary mb-stack-sm">
        Your subjects
      </h1>
      <p className="font-body-lg text-body-lg text-on-surface-variant mb-stack-lg">
        Type a subject and press Enter — or separate multiple with commas.
      </p>

      <div className="relative mb-stack-md">
        <input
          type="text"
          value={draft}
          onChange={handleChange}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              addFromDraft(draft);
            }
          }}
          placeholder="e.g. Biology, Math, History"
          maxLength={100}
          className="w-full bg-transparent border-0 border-b border-outline-variant focus:border-primary-container focus:ring-0 px-0 py-3 font-body-lg text-body-lg text-on-surface placeholder:text-outline outline-none transition-colors"
        />
        <button
          type="button"
          onClick={() => addFromDraft(draft)}
          aria-label="Add subject"
          className="absolute right-0 bottom-2 text-primary-container hover:text-primary p-2 rounded-full hover:bg-surface-container-low transition-colors"
        >
          <span className="material-symbols-outlined">add</span>
        </button>
      </div>

      {/* Subject list with per-subject difficulty */}
      {state.subjects.length > 0 && (
        <div className="space-y-3">
          {state.subjects.map((s) => (
            <div
              key={s.clientId}
              className="border border-outline-variant rounded-xl p-4 bg-surface"
            >
              <div className="flex items-center justify-between mb-3">
                <span className="font-body-lg text-body-lg font-medium">{s.name}</span>
                <button
                  type="button"
                  onClick={() =>
                    dispatch({ type: "REMOVE_SUBJECT", clientId: s.clientId })
                  }
                  aria-label={`Remove ${s.name}`}
                  className="text-outline-variant hover:text-error transition-colors"
                >
                  <span className="material-symbols-outlined text-[20px]">close</span>
                </button>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-label-sm text-label-sm text-outline uppercase tracking-wider mr-1">
                  Difficulty
                </span>
                {(["easy", "medium", "hard"] as const).map((level) => {
                  const active = s.difficulty === level;
                  return (
                    <button
                      key={level}
                      type="button"
                      onClick={() =>
                        dispatch({
                          type: "SET_DIFFICULTY",
                          clientId: s.clientId,
                          difficulty: active ? null : level,
                        })
                      }
                      aria-pressed={active}
                      className={[
                        "px-3 py-1 rounded-full font-label-sm text-label-sm border transition-colors",
                        active
                          ? "border-primary bg-secondary-container/30 text-on-surface"
                          : "border-outline-variant text-outline hover:border-primary hover:text-on-surface",
                      ].join(" ")}
                    >
                      {DIFFICULTY_LABELS[level]}
                    </button>
                  );
                })}
              </div>
              <div className="mt-3">
                <div className="flex justify-between items-center mb-1">
                  <span className="font-label-sm text-label-sm text-outline uppercase tracking-wider">
                    How confident are you?
                  </span>
                  <span className="font-label-sm text-label-sm text-primary tabular-nums">
                    {s.confidencePct !== null ? `${s.confidencePct}%` : "—"}
                  </span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={5}
                  value={s.confidencePct ?? 50}
                  onChange={(e) =>
                    dispatch({
                      type: "SET_CONFIDENCE",
                      clientId: s.clientId,
                      confidencePct: Number(e.target.value),
                    })
                  }
                  onPointerDown={() => {
                    if (s.confidencePct === null) {
                      dispatch({ type: "SET_CONFIDENCE", clientId: s.clientId, confidencePct: 50 });
                    }
                  }}
                  aria-label={`Confidence for ${s.name}`}
                  className="w-full accent-primary"
                />
                <div className="flex justify-between font-label-sm text-label-sm text-outline mt-0.5">
                  <span>Not at all</span>
                  <span>Very confident</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

// -----------------------------------------------------------------------------
// Step 3 — Topics (unchanged)
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
        <div className="flex flex-wrap gap-2 mt-3" aria-label="Loading suggestions">
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
                  <span className="material-symbols-outlined text-[14px]" aria-hidden="true">
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
// Step 4 — Academic workload & deadlines
// -----------------------------------------------------------------------------

function WorkloadStep({
  state,
  dispatch,
}: {
  state: State;
  dispatch: React.Dispatch<Action>;
}) {
  return (
    <section>
      <h1 className="font-headline-lg-mobile md:font-headline-lg text-headline-lg-mobile md:text-headline-lg text-on-surface mb-2">
        What do you have coming up?
      </h1>
      <p className="font-body-md text-body-md text-on-surface-variant mb-stack-lg">
        Add upcoming tasks and deadlines. Nothing is required — skip ahead if you&rsquo;re not sure yet.
      </p>

      {state.subjects.length === 0 ? (
        <p className="font-body-md text-body-md text-outline">
          Go back and add at least one subject first.
        </p>
      ) : (
        <div className="space-y-3">
          {state.subjects.map((s) => (
            <SubjectWorkload key={s.clientId} subject={s} dispatch={dispatch} />
          ))}
        </div>
      )}

      <p className="font-body-sm text-body-sm text-outline mt-stack-md">
        Exam dates help Pace prioritise your study sessions automatically.
      </p>
    </section>
  );
}

function SubjectWorkload({
  subject,
  dispatch,
}: {
  subject: SubjectDraft;
  dispatch: React.Dispatch<Action>;
}) {
  const [open, setOpen] = useState(false);
  const [taskType, setTaskType] = useState<TaskType>("exam");
  const [dueDate, setDueDate] = useState("");

  const add = () => {
    dispatch({
      type: "ADD_WORKLOAD_ITEM",
      subjectClientId: subject.clientId,
      item: { taskType, dueDate: dueDate || null, frequency: null, priority: "medium" },
    });
    if (taskType === "exam" && dueDate) {
      dispatch({ type: "SET_EXAM_DATE", subjectClientId: subject.clientId, date: dueDate });
    }
    setOpen(false);
    setTaskType("exam");
    setDueDate("");
  };

  return (
    <div className="border border-outline-variant rounded-xl p-4 bg-surface">
      <div className="flex items-center justify-between mb-2">
        <span className="font-body-lg text-body-lg font-medium text-on-surface">{subject.name}</span>
        {!open && (
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="flex items-center gap-1 font-label-sm text-label-sm text-outline hover:text-primary transition-colors"
          >
            <span className="material-symbols-outlined text-[16px]">add</span>
            Add
          </button>
        )}
      </div>

      {subject.workloadItems.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-3">
          {subject.workloadItems.map((item) => {
            const typeLabel = TASK_TYPES.find((t) => t.key === item.taskType)?.label ?? item.taskType;
            return (
              <span
                key={item.clientId}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-surface-container-low border border-outline-variant font-label-sm text-label-sm text-on-surface"
              >
                {typeLabel}
                {item.dueDate ? ` — ${item.dueDate}` : ""}
                <button
                  type="button"
                  onClick={() =>
                    dispatch({
                      type: "REMOVE_WORKLOAD_ITEM",
                      subjectClientId: subject.clientId,
                      itemClientId: item.clientId,
                    })
                  }
                  aria-label={`Remove ${typeLabel}`}
                  className="ml-0.5 text-outline hover:text-error transition-colors"
                >
                  <span className="material-symbols-outlined text-[14px]">close</span>
                </button>
              </span>
            );
          })}
        </div>
      )}

      {open && (
        <div className="space-y-3 border-t border-outline-variant/50 pt-3">
          <div className="flex flex-wrap gap-1.5">
            {TASK_TYPES.map((t) => (
              <button
                key={t.key}
                type="button"
                onClick={() => setTaskType(t.key)}
                aria-pressed={taskType === t.key}
                className={[
                  "px-3 py-1 rounded-full font-label-sm text-label-sm border transition-colors",
                  taskType === t.key
                    ? "border-primary bg-secondary-container/30 text-on-surface"
                    : "border-outline-variant text-outline hover:border-primary hover:text-on-surface",
                ].join(" ")}
              >
                {t.label}
              </button>
            ))}
          </div>
          <div>
            <label className="font-label-sm text-label-sm text-outline uppercase tracking-wider block mb-1">
              Due date (optional)
            </label>
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="bg-transparent border-b border-outline-variant focus:border-primary outline-none font-body-md text-body-md text-on-surface py-1 px-0 transition-colors"
            />
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={add}
              className="px-4 py-1.5 rounded-lg bg-primary text-on-primary font-label-sm text-label-sm hover:opacity-90 transition-opacity"
            >
              Add
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="font-label-sm text-label-sm text-outline hover:text-on-surface transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// -----------------------------------------------------------------------------
// Step 5 — Availability (unchanged)
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
        <AddWindowInline day={day} existingWindows={windows} dispatch={dispatch} />
      </div>
    </div>
  );
}

function AddWindowInline({
  day,
  existingWindows,
  dispatch,
}: {
  day: number;
  existingWindows: AvailabilityWindowDraft[];
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
    // Check for overlaps against the existing windows on this day before dispatching.
    const candidate = { dayOfWeek: day, startsAt, endsAt };
    if (hasOverlappingWindows([...existingWindows, candidate])) {
      setLocalError("This window overlaps an existing one.");
      return;
    }
    setLocalError(null);
    dispatch({ type: "ADD_WINDOW", dayOfWeek: day, startsAt, endsAt });
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
// Step 6 — Session length (unchanged)
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
              onClick={() => dispatch({ type: "SET_SESSION_LENGTH", minutes })}
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
// Step 7 — Study habits + biggest challenge (new)
// -----------------------------------------------------------------------------

function StudyHabitsStep({
  state,
  dispatch,
}: {
  state: State;
  dispatch: React.Dispatch<Action>;
}) {
  return (
    <section>
      <h1 className="font-headline-lg-mobile md:font-headline-lg text-headline-lg-mobile md:text-headline-lg text-on-surface mb-2">
        How do you study?
      </h1>
      <p className="font-body-md text-body-md text-on-surface-variant mb-stack-lg">
        Select all that apply — Pace will build on what already works for you.
      </p>

      <div className="flex flex-wrap gap-2 mb-stack-lg">
        {STUDY_HABITS.map(({ key, label }) => {
          const active = state.studyHabits.includes(key);
          return (
            <button
              key={key}
              type="button"
              onClick={() => dispatch({ type: "TOGGLE_STUDY_HABIT", habit: key })}
              aria-pressed={active}
              className={[
                "px-4 py-2 rounded-full font-label-md text-label-md border transition-colors",
                active
                  ? "border-primary bg-secondary-container/30 text-on-surface"
                  : "border-outline-variant text-on-surface-variant hover:border-primary hover:text-on-surface",
              ].join(" ")}
            >
              {label}
            </button>
          );
        })}
      </div>

      <div className="border-t border-outline-variant pt-stack-md">
        <h2 className="font-label-md text-label-md text-outline uppercase tracking-wider mb-1">
          What are your study challenges?
        </h2>
        <p className="font-body-sm text-body-sm text-outline mb-3">Select all that apply.</p>
        <div className="flex flex-wrap gap-2">
          {CHALLENGES.map(({ key, label }) => {
            const active = state.studyChallenges.includes(key);
            return (
              <button
                key={key}
                type="button"
                onClick={() => dispatch({ type: "TOGGLE_CHALLENGE", challenge: key })}
                aria-pressed={active}
                className={[
                  "px-4 py-2 rounded-full font-label-md text-label-md border transition-colors",
                  active
                    ? "border-primary bg-secondary-container/30 text-on-surface"
                    : "border-outline-variant text-on-surface-variant hover:border-primary hover:text-on-surface",
                ].join(" ")}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}

// -----------------------------------------------------------------------------
// Step 10 — Review (updated links point to new step numbers)
// -----------------------------------------------------------------------------

const AGE_BAND_LABEL_MAP: Record<string, string> = {
  junior: "Junior (11–13)",
  intermediate: "Intermediate (14–15)",
  senior: "Senior (16–18)",
  university: "University (18–24)",
  adult: "Adult (24+)",
};

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
        {state.ageBand && (
          <ReviewRow
            label="Stage"
            value={AGE_BAND_LABEL_MAP[state.ageBand] ?? state.ageBand}
            onEdit={() => onEdit(1)}
          />
        )}
        <ReviewRow
          label="Subjects & topics"
          value={state.subjects
            .map(
              (s) =>
                `${s.name}${s.topics.length ? ` (${s.topics.map((t) => t.name).join(", ")})` : ""}`,
            )
            .join("; ")}
          onEdit={() => onEdit(2)}
        />
        <ReviewRow
          label="Deadlines & workload"
          value={(() => {
            const items = state.subjects.flatMap((s) =>
              s.workloadItems.map((w) => {
                const type = TASK_TYPES.find((t) => t.key === w.taskType)?.label ?? w.taskType;
                return `${s.name}: ${type}${w.dueDate ? ` (${w.dueDate})` : ""}`;
              }),
            );
            return items.length > 0 ? items.join("; ") : "(none added)";
          })()}
          onEdit={() => onEdit(4)}
        />
        <ReviewRow
          label="Weekly availability"
          value={`~${totalHours} h/week (${availabilityDays || "none"})`}
          onEdit={() => onEdit(5)}
        />
        <ReviewRow
          label="Session length"
          value={
            state.sessionLengthMinutes
              ? `${state.sessionLengthMinutes} minutes`
              : "(not set)"
          }
          onEdit={() => onEdit(6)}
        />
        {state.goalRanking.length > 0 && (
          <ReviewRow
            label="Top goal"
            value={state.goalRanking[0]}
            onEdit={() => onEdit(8)}
          />
        )}
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
