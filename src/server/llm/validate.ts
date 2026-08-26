import type { PlanInput, PlanOutput } from "./schema";
import { hhmmToMinutes, localWallClockToUTC, utcToLocalParts } from "./time";

/**
 * Server-side validation of a PlanOutput against the user's PlanInput.
 *
 * Returns either enriched sessions ready for insertion (with resolved
 * topicId, startsAtUTC, endsAtUTC), or a single human-readable error
 * describing why the plan is unusable. Per API.md, the caller retries
 * once on failure with an addendum, then surfaces the error to the user.
 */

const MIN_BREAK_MINUTES = 5;

export type ValidatedSession = {
  topicId: string;
  subjectName: string;
  topicName: string;
  instruction: string;
  durationMinutes: number;
  startsAtUTC: Date;
  endsAtUTC: Date;
};

export type ValidationResult =
  | { ok: true; sessions: ValidatedSession[]; warnings: PlanOutput["warnings"] }
  | { ok: false; error: string };

export function validatePlanOutput(
  input: PlanInput,
  output: PlanOutput,
  latestExamDate: string | null,
): ValidationResult {
  const subjectByName = new Map(
    input.subjects.map((s) => [
      s.name,
      { name: s.name, examDate: s.examDate, topics: new Map(s.topics.map((t) => [t.name, t.id])) },
    ]),
  );

  const availByDay = new Map<number, Array<{ startsAt: number; endsAt: number }>>();
  for (const w of input.availability) {
    const list = availByDay.get(w.dayOfWeek) ?? [];
    list.push({ startsAt: hhmmToMinutes(w.startsAt), endsAt: hhmmToMinutes(w.endsAt) });
    availByDay.set(w.dayOfWeek, list);
  }

  const validated: ValidatedSession[] = [];
  const nowUTC = input.now.getTime();

  for (const s of output.sessions) {
    // 1. subjectName exists
    const subj = subjectByName.get(s.subjectName);
    if (!subj) {
      return { ok: false, error: `Unknown subject "${s.subjectName}" in plan output.` };
    }
    // 2. topicName exists under that subject
    const topicId = subj.topics.get(s.topicName);
    if (!topicId) {
      return {
        ok: false,
        error: `Topic "${s.topicName}" is not under subject "${s.subjectName}".`,
      };
    }
    // 3. duration matches user's chosen session length
    if (s.durationMinutes !== input.sessionLengthMinutes) {
      return {
        ok: false,
        error: `Session duration ${s.durationMinutes} does not match chosen ${input.sessionLengthMinutes} min.`,
      };
    }

    // 4. startsAt parses as local wall clock and converts to UTC
    let startsAtUTC: Date;
    try {
      startsAtUTC = localWallClockToUTC(s.startsAt, input.timeZone);
    } catch {
      return { ok: false, error: `Invalid startsAt "${s.startsAt}".` };
    }
    const endsAtUTC = new Date(startsAtUTC.getTime() + s.durationMinutes * 60_000);

    // 5. session is in the future
    if (startsAtUTC.getTime() < nowUTC) {
      return {
        ok: false,
        error: `Session ${s.startsAt} · ${s.subjectName} is in the past.`,
      };
    }

    // 6. session date is <= latest exam date (if any subject has one)
    if (latestExamDate) {
      const localStart = utcToLocalParts(startsAtUTC, input.timeZone);
      if (localStart.dateString > latestExamDate) {
        return {
          ok: false,
          error: `Session on ${localStart.dateString} is after the last exam date ${latestExamDate}.`,
        };
      }
    }

    // 7. session fits inside an availability window on the correct day
    const localStart = utcToLocalParts(startsAtUTC, input.timeZone);
    const localEnd = utcToLocalParts(endsAtUTC, input.timeZone);
    if (localStart.dateString !== localEnd.dateString) {
      return {
        ok: false,
        error: `Session ${s.startsAt} crosses midnight; sessions must fit in one day.`,
      };
    }
    const windows = availByDay.get(localStart.dayOfWeek);
    const fits = windows?.some(
      (w) =>
        localStart.minutesInDay >= w.startsAt &&
        localStart.minutesInDay + s.durationMinutes <= w.endsAt,
    );
    if (!fits) {
      return {
        ok: false,
        error: `Session ${s.startsAt} does not fit inside any availability window.`,
      };
    }

    validated.push({
      topicId,
      subjectName: subj.name,
      topicName: s.topicName,
      instruction: s.instruction,
      durationMinutes: s.durationMinutes,
      startsAtUTC,
      endsAtUTC,
    });
  }

  // 8. no overlaps between sessions, with a >= MIN_BREAK_MINUTES gap for
  //    consecutive same-day sessions.
  const sorted = [...validated].sort(
    (a, b) => a.startsAtUTC.getTime() - b.startsAtUTC.getTime(),
  );
  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1];
    const curr = sorted[i];
    if (curr.startsAtUTC.getTime() < prev.endsAtUTC.getTime()) {
      return {
        ok: false,
        error: `Session at ${curr.startsAtUTC.toISOString()} overlaps a previous session.`,
      };
    }
    const prevLocal = utcToLocalParts(prev.startsAtUTC, input.timeZone);
    const currLocal = utcToLocalParts(curr.startsAtUTC, input.timeZone);
    if (prevLocal.dateString === currLocal.dateString) {
      const gapMs = curr.startsAtUTC.getTime() - prev.endsAtUTC.getTime();
      if (gapMs < MIN_BREAK_MINUTES * 60_000) {
        return {
          ok: false,
          error: `Consecutive same-day sessions need at least a ${MIN_BREAK_MINUTES}-min break.`,
        };
      }
    }
  }

  return { ok: true, sessions: sorted, warnings: output.warnings };
}

/** Warnings whose subjectName+topicName don't exist are dropped; safer than surfacing garbage. */
export function sanitizeWarnings(
  input: PlanInput,
  warnings: PlanOutput["warnings"],
): PlanOutput["warnings"] {
  const knownSubjects = new Map(
    input.subjects.map((s) => [s.name, new Set(s.topics.map((t) => t.name))]),
  );
  return warnings.filter((w) => {
    const topics = knownSubjects.get(w.subjectName);
    return topics ? topics.has(w.topicName) : false;
  });
}

/** Compute the latest exam date across all subjects, or null. */
export function latestExamDateOf(input: PlanInput): string | null {
  let latest: string | null = null;
  for (const s of input.subjects) {
    if (s.examDate && (latest === null || s.examDate > latest)) latest = s.examDate;
  }
  return latest;
}

/**
 * Pre-flight feasibility check, run BEFORE calling the LLM.
 *
 * Catches the impossible-input cases that otherwise make the model return an
 * empty plan (which used to crash with an opaque error). Returns a specific,
 * actionable message the user can act on instead of a generic failure.
 */
export function checkPlanFeasibility(
  input: PlanInput,
): { ok: true } | { ok: false; error: string } {
  // 1. At least one exam/target date must be strictly in the future (the
  //    user's local "today"). An exam today or in the past leaves no room to
  //    schedule study before it.
  const todayLocal = utcToLocalParts(input.now, input.timeZone);
  const todayDateStr = todayLocal.dateString;
  const latestExam = latestExamDateOf(input);
  if (!latestExam || latestExam <= todayDateStr) {
    return {
      ok: false,
      error:
        "Set an exam or target date in the future so Pace can schedule study time before it.",
    };
  }

  // 2. At least one availability window must be long enough for a single
  //    session. If every window is shorter than the session length, no
  //    session can ever fit.
  const longestWindow = input.availability.reduce((max, w) => {
    const len = hhmmToMinutes(w.endsAt) - hhmmToMinutes(w.startsAt);
    return len > max ? len : max;
  }, 0);
  if (longestWindow < input.sessionLengthMinutes) {
    return {
      ok: false,
      error: `Your available time blocks are shorter than your ${input.sessionLengthMinutes}-minute sessions. Add a longer window or choose a shorter session length.`,
    };
  }

  // 3. At least one availability window occurrence must actually fall between
  //    now and the latest exam date, with enough room remaining for a full
  //    session. Checks 1–2 verify that a long-enough window exists globally,
  //    but miss the case where the exam is soon and that window's day-of-week
  //    never appears before the exam (e.g. exam tomorrow, available only on
  //    Wednesdays, and today is Tuesday evening with the window already closed).
  const todayMinutes = todayLocal.minutesInDay;
  const windowsByDOW = new Map<number, Array<{ startsAt: number; endsAt: number }>>();
  for (const w of input.availability) {
    const list = windowsByDOW.get(w.dayOfWeek) ?? [];
    list.push({ startsAt: hhmmToMinutes(w.startsAt), endsAt: hhmmToMinutes(w.endsAt) });
    windowsByDOW.set(w.dayOfWeek, list);
  }

  // Using noon UTC as anchor so the date stays correct in any timezone.
  const todayDate = new Date(todayDateStr + "T12:00:00Z");
  const examDate = new Date(latestExam + "T12:00:00Z");
  const daysToExam = Math.round((examDate.getTime() - todayDate.getTime()) / 86_400_000);

  // 7+ days guarantees every day-of-week appears at least once; check 2 already
  // confirmed a sufficient-length window exists, so feasibility is certain.
  if (daysToExam >= 7) return { ok: true };

  // Short range: walk day-by-day and confirm at least one session can fit.
  let hasFeasibleSlot = false;
  for (let d = 0; d <= daysToExam && !hasFeasibleSlot; d++) {
    const dayDate = new Date(todayDate.getTime() + d * 86_400_000);
    const { dayOfWeek } = utcToLocalParts(dayDate, input.timeZone);
    const windows = windowsByDOW.get(dayOfWeek);
    if (!windows) continue;
    hasFeasibleSlot = windows.some((w) => {
      if (d === 0) {
        // Today: session must start at or after the current local time.
        return w.endsAt - input.sessionLengthMinutes >= todayMinutes;
      }
      // Future day: window must be long enough for a full session.
      return w.endsAt - w.startsAt >= input.sessionLengthMinutes;
    });
  }

  if (!hasFeasibleSlot) {
    return {
      ok: false,
      error:
        "No study slots fit between now and your exam. Add availability on the days leading up to it, or move your exam date out.",
    };
  }

  return { ok: true };
}
