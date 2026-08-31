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

  const [addDay, setAddDay] = useState<number>(1);
  const [addStart, setAddStart] = useState("09:00");
  const [addEnd, setAddEnd] = useState("11:00");
  const [addError, setAddError] = useState<string | null>(null);

  const [availMsg, setAvailMsg] = useState<string | null>(null);
  const [lengthMsg, setLengthMsg] = useState<string | null>(null);
  const [isPendingAvail, startAvail] = useTransition();
  const [isPendingLength, startLength] = useTransition();

  function handleAdd() {
    const candidate = { dayOfWeek: addDay, startsAt: addStart, endsAt: addEnd };
    const parsed = AvailabilityWindowSchema.safeParse(candidate);
    if (!parsed.success) { setAddError(parsed.error.issues[0].message); return; }
    const merged = [...windows, { ...candidate, clientId: cid() }];
    if (hasOverlappingWindows(merged)) { setAddError("This window overlaps an existing one."); return; }
    setAddError(null);
    setWindows(merged);
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

  const windowsByDay = DAYS_OF_WEEK.reduce(
    (acc, d) => {
      acc[d] = windows.filter((w) => w.dayOfWeek === d);
      return acc;
    },
    {} as Record<number, WindowDraft[]>,
  );

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

        <div className="flex flex-col gap-4">
          {/* Existing windows */}
          {DAYS_OF_WEEK.map((d) => (
            <div key={d}>
              <p className="font-label-md text-label-md text-on-surface-variant mb-1.5">
                {DAY_LABELS[d]}
              </p>
              {windowsByDay[d].length === 0 ? (
                <p className="font-body-sm text-body-sm text-on-surface-variant italic">
                  No windows
                </p>
              ) : (
                <div className="flex flex-col gap-1.5">
                  {windowsByDay[d].map((w) => (
                    <div
                      key={w.clientId}
                      className="flex items-center justify-between gap-3 bg-surface-container border border-outline-variant rounded-lg px-3 py-2"
                    >
                      <span className="font-body-md text-body-md text-on-surface">
                        {w.startsAt} – {w.endsAt}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleRemove(w.clientId)}
                        className="text-on-surface-variant hover:text-error transition-colors"
                        aria-label={`Remove ${DAY_LABELS[d]} ${w.startsAt}–${w.endsAt}`}
                      >
                        <span className="material-symbols-outlined text-base" aria-hidden="true">
                          close
                        </span>
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}

          {/* Add window form */}
          <div className="border-t border-outline-variant pt-4 flex flex-col gap-3">
            <p className="font-label-md text-label-md text-on-surface">Add a window</p>
            <div className="flex flex-wrap items-end gap-3">
              <label className="flex flex-col gap-1">
                <span className="font-label-sm text-label-sm text-on-surface-variant">Day</span>
                <select
                  value={addDay}
                  onChange={(e) => setAddDay(Number(e.target.value))}
                  className="border border-outline-variant rounded-lg px-3 py-2 bg-surface text-on-surface font-body-md text-body-md"
                >
                  {DAYS_OF_WEEK.map((d) => (
                    <option key={d} value={d}>{DAY_LABELS[d]}</option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1">
                <span className="font-label-sm text-label-sm text-on-surface-variant">Start</span>
                <input
                  type="time"
                  value={addStart}
                  onChange={(e) => setAddStart(e.target.value)}
                  className="border border-outline-variant rounded-lg px-3 py-2 bg-surface text-on-surface font-body-md text-body-md"
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="font-label-sm text-label-sm text-on-surface-variant">End</span>
                <input
                  type="time"
                  value={addEnd}
                  onChange={(e) => setAddEnd(e.target.value)}
                  className="border border-outline-variant rounded-lg px-3 py-2 bg-surface text-on-surface font-body-md text-body-md"
                />
              </label>
              <button
                type="button"
                onClick={handleAdd}
                className="font-label-md text-label-md text-primary border border-primary/30 px-4 py-2 rounded-lg hover:bg-primary/5 transition-colors"
              >
                Add
              </button>
            </div>
            {addError && (
              <p className="font-body-sm text-body-sm text-error">{addError}</p>
            )}
          </div>

          {/* Save button */}
          <div className="flex items-center gap-4">
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
