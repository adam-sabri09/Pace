import type { PlanInput } from "./schema";
import { utcToLocalParts } from "./time";

function addDays(dateStr: string, n: number): string {
  const d = new Date(dateStr + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/**
 * Build the prompt Gemini receives. Pure function of PlanInput — no
 * side effects, easily unit-testable.
 */
export function buildPrompt(input: PlanInput): string {
  const nowLocal = utcToLocalParts(input.now, input.timeZone);
  const nowStr = `${nowLocal.dateString} ${nowLocal.timeString} local`;

  // Planning horizon: max(future exam, future task due date, 28 days).
  const todayDateStr = nowLocal.dateString;
  const futureExam =
    input.subjects
      .map((s) => s.examDate)
      .filter((d): d is string => d != null && d > todayDateStr)
      .sort()
      .pop() ?? null;
  const latestTaskDue =
    (input.tasks ?? [])
      .map((t) => t.dueDate)
      .filter((d): d is string => d != null && d > todayDateStr)
      .sort()
      .pop() ?? null;
  const defaultHorizon = addDays(todayDateStr, 28);
  const horizon =
    [futureExam, latestTaskDue, defaultHorizon]
      .filter((d): d is string => d != null)
      .sort()
      .pop() ?? defaultHorizon;

  const subjectBlock = input.subjects
    .map((s) => {
      const topics = s.topics.map((t) => `    - ${t.name}`).join("\n");
      const exam = s.examDate ? ` (exam: ${s.examDate})` : " (no exam date set)";
      return `  * ${s.name}${exam}\n${topics}`;
    })
    .join("\n");

  const days = [
    "Sunday",
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
  ];
  const availabilityByDay = new Map<number, string[]>();
  for (const w of input.availability) {
    const list = availabilityByDay.get(w.dayOfWeek) ?? [];
    list.push(`${w.startsAt}–${w.endsAt}`);
    availabilityByDay.set(w.dayOfWeek, list);
  }
  const availabilityBlock = days
    .map((label, i) => {
      const windows = availabilityByDay.get(i);
      return `  - ${label}: ${windows ? windows.join(", ") : "(unavailable)"}`;
    })
    .join("\n");

  const completedBlock =
    input.completedSessions && input.completedSessions.length > 0
      ? "\nAlready-completed sessions (do not schedule these again):\n" +
        input.completedSessions
          .map(
            (c) =>
              `  - ${c.startsAt} · ${c.subjectName} · ${c.topicName} · ${c.durationMinutes} min`,
          )
          .join("\n")
      : "";

  const AGE_LABELS: Record<string, string> = {
    younger: "GCSE / Year 9-11 (14-15 year old)",
    older: "A-Level / Year 12-13 (16-17 year old)",
    adult: "University / 18+",
  };
  const AGE_BAND_LABELS: Record<string, string> = {
    junior: "Year 9-11 / GCSE (13-15)",
    intermediate: "Year 12-13 / A-Level (16-17)",
    senior: "Final year / Pre-university (17-18)",
    university: "University / Higher education",
    adult: "Adult learner",
  };
  const profileBlock = input.profile
    ? (() => {
        const {
          ageGroup, ageBand, topTechnique,
          studyHabits, studyChallenges, goalRanking, memoryScore,
          subjectIntelligence,
        } = input.profile;

        const ageLabel = ageBand
          ? (AGE_BAND_LABELS[ageBand] ?? ageBand)
          : ageGroup
          ? (AGE_LABELS[ageGroup] ?? ageGroup)
          : null;

        const subjectNotes =
          subjectIntelligence && subjectIntelligence.length > 0
            ? subjectIntelligence
                .filter((s) => s.difficulty || s.confidencePct != null)
                .map((s) => {
                  const parts: string[] = [];
                  if (s.difficulty) parts.push(s.difficulty);
                  if (s.confidencePct != null)
                    parts.push(`${s.confidencePct}% confident`);
                  return `    * ${s.subjectName}: ${parts.join(", ")}`;
                })
                .join("\n")
            : "";

        let block = "\nStudent profile (use to personalise session instructions):\n";
        if (ageLabel) block += `  - Age group: ${ageLabel}\n`;
        if (topTechnique) block += `  - Preferred study technique: ${topTechnique.replace(/_/g, " ")}\n`;
        if (studyHabits && studyHabits.length > 0)
          block += `  - Study habits: ${studyHabits.map((h) => h.replace(/_/g, " ")).join(", ")}\n`;
        if (studyChallenges && studyChallenges.length > 0)
          block += `  - Biggest challenges: ${studyChallenges.map((c) => c.replace(/_/g, " ")).join(", ")}\n`;
        if (goalRanking && goalRanking.length > 0)
          block += `  - Goals (top 3): ${goalRanking.slice(0, 3).map((g) => g.replace(/_/g, " ")).join(" > ")}\n`;
        if (memoryScore != null) {
          const memLabel = memoryScore >= 80 ? "strong" : memoryScore >= 50 ? "average" : "developing";
          block += `  - Memory/retention: ${memLabel} (score ${memoryScore}%)\n`;
        }
        if (subjectNotes) block += `  - Subject difficulty/confidence:\n${subjectNotes}\n`;
        block += `  When writing the "instruction" field, prefer wording that matches the preferred technique.\n`;
        block += `  For harder subjects with lower confidence, bias toward more frequent topic coverage.\n`;
        return block;
      })()
    : "";

  const tasksBlock =
    input.tasks && input.tasks.length > 0
      ? "\nTasks and deadlines (schedule study sessions to cover these — overdue tasks are highest priority):\n" +
        input.tasks
          .sort((a, b) => (a.dueDate ?? "9999") < (b.dueDate ?? "9999") ? -1 : 1)
          .map((t) => {
            const overdue = t.dueDate && t.dueDate < todayDateStr;
            return `  - [${t.taskType.toUpperCase()}] ${t.title} (${t.subjectName})${t.dueDate ? ` — due ${t.dueDate}${overdue ? " ⚠ OVERDUE" : ""}` : ""} — priority: ${t.priority}`;
          })
          .join("\n")
      : "";

  return `You are Pace, an adaptive study planner for high-school students.
Build a realistic, day-by-day study schedule.

Student's timezone: ${input.timeZone}
Right now: ${nowStr}
Planning horizon: ${horizon} (schedule sessions from now until this date)
Fixed session length: ${input.sessionLengthMinutes} minutes (every session must be exactly this)

Subjects and topics:
${subjectBlock}

Weekly availability windows (student's local time):
${availabilityBlock}
${completedBlock}
${tasksBlock}
${profileBlock}
Rules:
1. Every session's startsAt is a local wall-clock string in the student's
   timezone, formatted YYYY-MM-DDTHH:MM (no offset, no seconds).
2. Every session's durationMinutes must be exactly ${input.sessionLengthMinutes}.
3. Every session must fit entirely inside one availability window on the
   correct day of week — no session crosses a window boundary.
4. Leave at least a 5-minute gap between consecutive same-day sessions
   (implicit break; do not schedule a "break" session).
5. Sessions must not overlap.
6. Schedule sessions from "right now" to the planning horizon (${horizon}).
   Session priority, highest first:
   a. Topics linked to an OVERDUE task or task due within 2 days — schedule immediately.
   b. Topics linked to a task due within 7 days — schedule soon.
   c. Subjects with an exam date — schedule sessions before the exam, not after it.
   d. Weak subjects (low confidence or hard difficulty) with no near deadline.
   e. Remaining topics — distribute evenly through the horizon.
   Exam dates are optional. If a subject has no exam date, still schedule sessions
   for it using its tasks, difficulty, and confidence as signals.
7. If a topic cannot fit before its deadline given the availability,
   include a warning object with subjectName, topicName, and a short
   message. Never silently drop a topic.
8. subjectName must exactly match one of the subject names above.
   topicName must exactly match a topic listed under that subject.
9. instruction is a short (<= 60 chars) action label for the student,
   e.g. "Review chapter 4", "Practice problems", "Active recall".

Return a JSON object matching the schema.`;
}
