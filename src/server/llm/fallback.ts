import "server-only";

import type { PlanInput } from "./schema";
import type { ValidatedSession } from "./validate";
import { hhmmToMinutes, localWallClockToUTC, utcToLocalParts } from "./time";
import { latestExamDateOf } from "./validate";

/**
 * Deterministic fallback plan generator.
 *
 * Called when the LLM fails twice (name mismatch, window fitting error, etc.)
 * AND feasibility pre-checks already confirmed at least one slot exists.
 * This means the fallback ALWAYS produces ≥1 session — it never errors.
 *
 * Algorithm:
 *  1. Prioritise subjects by urgency × difficulty × inverse-confidence.
 *  2. Walk day-by-day from now to the latest exam date (or 28 days out).
 *  3. For each day's availability windows place sessions sequentially,
 *     cycling through topics in priority order.
 *  4. Leave a 5-minute break between same-day sessions.
 */

const MIN_BREAK_MS = 5 * 60_000;
const MAX_SESSIONS = 80;

// ── Helpers ──────────────────────────────────────────────────────────────────

function minutesToHhmm(mins: number): string {
  return `${String(Math.floor(mins / 60)).padStart(2, "0")}:${String(mins % 60).padStart(2, "0")}`;
}

/** Increment a YYYY-MM-DD string by n days. */
function addDays(dateStr: string, n: number): string {
  const d = new Date(dateStr + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

function computeUrgency(examDate: string | null, todayStr: string): number {
  if (!examDate || examDate <= todayStr) return 1;
  const days = Math.round(
    (new Date(examDate + "T00:00:00Z").getTime() -
      new Date(todayStr + "T00:00:00Z").getTime()) /
      86_400_000,
  );
  if (days <= 7) return 10;
  if (days <= 14) return 7;
  if (days <= 30) return 5;
  if (days <= 60) return 3;
  return 1;
}

type PrioritizedTopic = {
  topicId: string;
  subjectName: string;
  topicName: string;
  instruction: string;
};

const INSTRUCTIONS_BY_TECHNIQUE: Record<string, string[]> = {
  active_recall: ["Active recall: write key points from memory", "Self-quiz on key concepts", "Recall without notes"],
  spaced_repetition: ["Spaced review of prior material", "Review and self-test", "Interval practice"],
  practice_testing: ["Work through practice problems", "Test yourself on this topic", "Practice questions"],
  feynman: ["Explain the concept in simple terms", "Feynman technique: teach it back", "Simplify and explain"],
  interleaving: ["Mixed practice with related topics", "Interleaved review", "Alternate question types"],
  pomodoro: ["Focused study sprint", "Concentrated review session", "Deep focus on key concepts"],
  deep_work: ["Deep focus review", "Concentrated study", "Extended deep work"],
};

const FALLBACK_INSTRUCTIONS = ["Review key concepts", "Study and take notes", "Active practice", "Self-quiz"];

function pickInstruction(technique: string | undefined, idx: number): string {
  const list =
    INSTRUCTIONS_BY_TECHNIQUE[technique ?? ""] ?? FALLBACK_INSTRUCTIONS;
  return list[idx % list.length];
}

/** Build a cycling topic list in priority order, long enough to fill any plan. */
function buildTopicCycle(input: PlanInput, todayStr: string): PrioritizedTopic[] {
  const DW: Record<string, number> = { hard: 3, medium: 2, easy: 1 };

  const scoredSubjects = input.subjects
    .filter((s) => s.topics.length > 0 && !(s.examDate && s.examDate < todayStr))
    .map((s) => {
      const si = input.profile?.subjectIntelligence?.find((p) => p.subjectName === s.name);
      const dw = DW[si?.difficulty ?? "medium"] ?? 2;
      const cp = si?.confidencePct;
      const cw = cp == null ? 2 : cp <= 20 ? 5 : cp <= 40 ? 4 : cp <= 60 ? 3 : cp <= 80 ? 2 : 1;
      const uw = computeUrgency(s.examDate, todayStr);
      return { subject: s, score: dw * uw * cw };
    })
    .sort((a, b) => b.score - a.score);

  if (!scoredSubjects.length) return [];

  const technique = input.profile?.topTechnique;
  const cycle: PrioritizedTopic[] = [];

  // 4 full rounds through all subjects (enough for any 4-week horizon).
  for (let round = 0; round < 4; round++) {
    for (const { subject } of scoredSubjects) {
      for (let ti = 0; ti < subject.topics.length; ti++) {
        const topic = subject.topics[ti];
        cycle.push({
          topicId: topic.id,
          subjectName: subject.name,
          topicName: topic.name,
          instruction: pickInstruction(technique, cycle.length),
        });
      }
    }
  }

  return cycle;
}

// ── Main export ───────────────────────────────────────────────────────────────

export function generateFallbackPlan(input: PlanInput): ValidatedSession[] {
  const sessions: ValidatedSession[] = [];
  const sessionMs = input.sessionLengthMinutes * 60_000;

  const nowLocal = utcToLocalParts(input.now, input.timeZone);
  const todayStr = nowLocal.dateString;

  const cycle = buildTopicCycle(input, todayStr);
  if (!cycle.length) return [];

  // Plan horizon: up to latest exam date, or 28 days.
  const latestExamStr = latestExamDateOf(input);
  const horizonStr = latestExamStr ?? addDays(todayStr, 28);

  // Availability windows by day-of-week (in minutes-in-day).
  const windowsByDow = new Map<number, Array<{ sm: number; em: number }>>();
  for (const w of input.availability) {
    const list = windowsByDow.get(w.dayOfWeek) ?? [];
    list.push({ sm: hhmmToMinutes(w.startsAt), em: hhmmToMinutes(w.endsAt) });
    windowsByDow.set(w.dayOfWeek, list);
  }

  let topicIdx = 0;
  let cursorStr = todayStr;

  while (cursorStr <= horizonStr && sessions.length < MAX_SESSIONS) {
    const cursorDate = new Date(cursorStr + "T12:00:00Z");
    const localDay = utcToLocalParts(cursorDate, input.timeZone);
    const windows = windowsByDow.get(localDay.dayOfWeek) ?? [];

    for (const w of windows) {
      if (sessions.length >= MAX_SESSIONS) break;

      // Convert window start/end to UTC for this specific date.
      const wStartUTC = localWallClockToUTC(
        `${cursorStr}T${minutesToHhmm(w.sm)}`,
        input.timeZone,
      ).getTime();
      const wEndUTC = localWallClockToUTC(
        `${cursorStr}T${minutesToHhmm(w.em)}`,
        input.timeZone,
      ).getTime();

      // Slot start: must be at or after (now + 1 min) AND at or after window start.
      const minStart = input.now.getTime() + 60_000;
      let slotMs = Math.max(wStartUTC, minStart);

      // Also respect the last session's end + break (same-day back-to-back).
      if (sessions.length > 0) {
        const prev = sessions[sessions.length - 1];
        const prevEndDay = utcToLocalParts(prev.endsAtUTC, input.timeZone).dateString;
        if (prevEndDay === cursorStr) {
          slotMs = Math.max(slotMs, prev.endsAtUTC.getTime() + MIN_BREAK_MS);
        }
      }

      while (slotMs + sessionMs <= wEndUTC && sessions.length < MAX_SESSIONS) {
        const startsAtUTC = new Date(slotMs);
        const endsAtUTC = new Date(slotMs + sessionMs);

        // Don't schedule past the horizon (exam date).
        if (endsAtUTC.getTime() > localWallClockToUTC(horizonStr + "T23:59", input.timeZone).getTime()) break;

        const topic = cycle[topicIdx % cycle.length];
        topicIdx++;

        sessions.push({
          topicId: topic.topicId,
          subjectName: topic.subjectName,
          topicName: topic.topicName,
          instruction: topic.instruction,
          durationMinutes: input.sessionLengthMinutes,
          startsAtUTC,
          endsAtUTC,
        });

        slotMs = endsAtUTC.getTime() + MIN_BREAK_MS;
      }
    }

    cursorStr = addDays(cursorStr, 1);
  }

  return sessions;
}
