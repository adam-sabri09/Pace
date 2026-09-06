"use client";

import { useState, useTransition } from "react";

import {
  DAYS_OF_WEEK,
  AvailabilityWindowSchema,
  hasOverlappingWindows,
  SESSION_LENGTHS,
  type SessionLength,
} from "@/lib/validation/onboarding";
import {
  saveAvailabilityAction,
  saveSessionLengthAction,
  type AvailabilityWindowInput,
} from "@/server/actions/settings";

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const DAY_LABELS_FULL = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const SESSION_LENGTH_LABELS: Record<SessionLength, string> = {
  25: "25 min — short sprints",
  45: "45 min — balanced focus",
  60: "60 min — deep work",
};

type WindowDraft = AvailabilityWindowInput & { clientId: string };

let _clientId = 0;
function cid() { return String(++_clientId); }

function windowsFromDb(rows: AvailabilityWindowInput[]): WindowDraft[] {
  return rows.map((w) => ({ ...w, clientId: cid() }));
}

// ---------------------------------------------------------------------------
// Per-day section — shows existing windows and an inline add form
// ---------------------------------------------------------------------------

function DaySection({
  day,
  windows,
  onAdd,
  onRemove,
}: {
  day: number;
  windows: WindowDraft[];
  onAdd: (w: AvailabilityWindowInput) => void;
  onRemove: (clientId: string) => void;
}) {
  const [startsAt, setStartsAt] = useState("16:00");
  const [endsAt, setEndsAt] = useState("18:00");
  const [addError, setAddError] = useState<string | null>(null);

  const handleAdd = () => {
    const candidate = { dayOfWeek: day, startsAt, endsAt };
    const parsed = AvailabilityWindowSchema.safeParse(candidate);
    if (!parsed.success) {
      setAddError(parsed.error.issues[0].message);
      return;
    }
    // Check overlaps against existing windows on this day.
    if (hasOverlappingWindows([...windows, candidate])) {
      setAddError("This window overlaps an existing one on this day.");
      return;
    }
    setAddError(null);
    onAdd(candidate);
  };

  return (
    <div
      className={`p-3 rounded-lg border transition-colors ${
        windows.length > 0
          ? "border-primary/30 bg-surface-container"
          : "border-outline-variant bg-surface"
      }`}
    >
      <div className="flex items-center justify-between mb-2">
        <span
          className={`font-label-md text-label-md font-semibold uppercase tracking-wide ${
            windows.length > 0 ? "text-primary" : "text-on-surface-variant"
          }`}
        >
          {DAY_LABELS_FULL[day]}
        </span>
        {windows.length > 0 && (
          <span className="font-label-sm text-label-sm text-on-surface-variant">
            {windows.length} block{windows.length > 1 ? "s" : ""}
          </span>
        )}
      </div>

      {/* Existing windows */}
      {windows.length > 0 && (
        <div className="flex flex-col gap-1.5 mb-2">
          {windows.map((w) => (
            <div
              key={w.clientId}
              className="flex items-center justify-between gap-3 bg-surface border border-outline-variant rounded-md px-3 py-1.5"
            >
              <span className="font-body-md text-body-md text-on-surface tabular-nums">
                {w.startsAt} – {w.endsAt}
              </span>
              <button
                type="button"
                onClick={() => onRemove(w.clientId)}
                className="text-on-surface-variant hover:text-error transition-colors"
                aria-label={`Remove ${DAY_LABELS[day]} ${w.startsAt}–${w.endsAt}`}
              >
                <span className="material-symbols-outlined text-[18px]" aria-hidden="true">
                  close
                </span>
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Inline add form */}
      <div className="flex flex-wrap items-end gap-2">
        <label className="flex flex-col gap-0.5">
          <span className="font-label-sm text-label-sm text-on-surface-variant">From</span>
          <input
            type="time"
            value={startsAt}
            onChange={(e) => setStartsAt(e.target.value)}
            aria-label={`${DAY_LABELS_FULL[day]} start time`}
            className="border border-outline-variant rounded-md px-2 py-1.5 bg-surface text-on-surface font-body-md text-body-md focus:outline-none focus:border-primary w-28"
          />
        </label>
        <label className="flex flex-col gap-0.5">
          <span className="font-label-sm text-label-sm text-on-surface-variant">To</span>
          <input
            type="time"
            value={endsAt}
            onChange={(e) => setEndsAt(e.target.value)}
            aria-label={`${DAY_LABELS_FULL[day]} end time`}
            className="border border-outline-variant rounded-md px-2 py-1.5 bg-surface text-on-surface font-body-md text-body-md focus:outline-none focus:border-primary w-28"
          />
        </label>
        <button
          type="button"
          onClick={handleAdd}
          className="font-label-sm text-label-sm text-primary border border-primary/30 px-3 py-1.5 rounded-md hover:bg-primary/5 transition-colors flex items-center gap-1 self-end"
        >
          <span className="material-symbols-outlined text-[15px]" aria-hidden="true">add</span>
          Add block
        </button>
      </div>
      {addError && (
        <p role="alert" className="font-body-sm text-body-sm text-error mt-1">
          {addError}
        </p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main editor
// ---------------------------------------------------------------------------

export function AvailabilityEditor({
  initialWindows,
  initialSessionLength,
}: {
  initialWindows: AvailabilityWindowInput[];
  initialSessionLength: SessionLength;
}) {
  const [windows, setWindows] = useState<WindowDraft[]>(() =>
    windowsFromDb(initialWindows),
  );
  const [sessionLength, setSessionLength] = useState<SessionLength>(initialSessionLength);

  const [availMsg, setAvailMsg] = useState<string | null>(null);
  const [lengthMsg, setLengthMsg] = useState<string | null>(null);
  const [isPendingAvail, startAvail] = useTransition();
  const [isPendingLength, startLength] = useTransition();

  const windowsByDay = DAYS_OF_WEEK.reduce(
    (acc, d) => {
      acc[d] = windows.filter((w) => w.dayOfWeek === d);
      return acc;
    },
    {} as Record<number, WindowDraft[]>,
  );

  function handleAdd(w: AvailabilityWindowInput) {
    setWindows((prev) => [...prev, { ...w, clientId: cid() }]);
  }

  function handleRemove(clientId: string) {
    setWindows((ws) => ws.filter((w) => w.clientId !== clientId));
  }

  function handleSaveAvailability() {
    setAvailMsg(null);
    startAvail(async () => {
      const result = await saveAvailabilityAction(
        windows.map(({ dayOfWeek, startsAt, endsAt }) => ({ dayOfWeek, startsAt, endsAt })),
      );
      setAvailMsg(result.ok ? "Saved — your plan has been updated." : result.error);
    });
  }

  function handleSaveLength() {
    setLengthMsg(null);
    startLength(async () => {
      const result = await saveSessionLengthAction(sessionLength);
      setLengthMsg(result.ok ? "Saved — your plan has been updated." : result.error);
    });
  }

  return (
    <div className="flex flex-col gap-stack-md">
      {/* Availability */}
      <section className="border border-outline-variant rounded-xl p-stack-md bg-surface-container-lowest">
        <h2 className="font-headline-md text-headline-md text-on-surface flex items-center gap-base border-b border-outline-variant pb-base mb-stack-md">
          <span className="material-symbols-outlined text-outline" aria-hidden="true">
            calendar_month
          </span>
          Weekly availability
        </h2>

        <p className="font-body-sm text-body-sm text-on-surface-variant mb-4">
          Add one or more study blocks per day. Pace schedules sessions inside each block — it
          never merges separate blocks into one.
        </p>

        <div className="flex flex-col gap-3">
          {DAYS_OF_WEEK.map((d) => (
            <DaySection
              key={d}
              day={d}
              windows={windowsByDay[d]}
              onAdd={handleAdd}
              onRemove={handleRemove}
            />
          ))}
        </div>

        <div className="flex items-center gap-4 mt-stack-md">
          <button
            type="button"
            onClick={handleSaveAvailability}
            disabled={isPendingAvail}
            className="font-label-md text-label-md bg-primary text-on-primary px-6 py-2 rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-60"
          >
            {isPendingAvail ? "Saving…" : "Save availability"}
          </button>
          {availMsg && (
            <p
              className={`font-body-sm text-body-sm ${availMsg.startsWith("Saved") ? "text-secondary" : "text-error"}`}
            >
              {availMsg}
            </p>
          )}
        </div>
      </section>

      {/* Session length */}
      <section className="border border-outline-variant rounded-xl p-stack-md bg-surface-container-lowest">
        <h2 className="font-headline-md text-headline-md text-on-surface flex items-center gap-base border-b border-outline-variant pb-base mb-stack-md">
          <span className="material-symbols-outlined text-outline" aria-hidden="true">
            timer
          </span>
          Session length
        </h2>
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap gap-3">
            {SESSION_LENGTHS.map((len) => (
              <button
                key={len}
                type="button"
                onClick={() => setSessionLength(len)}
                className={`flex flex-col items-start px-4 py-3 rounded-lg border transition-colors ${
                  sessionLength === len
                    ? "border-primary bg-primary/5 text-primary"
                    : "border-outline-variant text-on-surface hover:bg-surface-container"
                }`}
              >
                <span className="font-headline-sm text-headline-sm">{len} min</span>
                <span className="font-body-sm text-body-sm text-on-surface-variant">
                  {SESSION_LENGTH_LABELS[len].split("—")[1].trim()}
                </span>
              </button>
            ))}
          </div>
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={handleSaveLength}
              disabled={isPendingLength}
              className="font-label-md text-label-md bg-primary text-on-primary px-6 py-2 rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-60"
            >
              {isPendingLength ? "Saving…" : "Save session length"}
            </button>
            {lengthMsg && (
              <p
                className={`font-body-sm text-body-sm ${lengthMsg.startsWith("Saved") ? "text-secondary" : "text-error"}`}
              >
                {lengthMsg}
              </p>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
