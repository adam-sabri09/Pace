import type { PlanInput } from "./schema";
import { utcToLocalParts } from "./time";

/**
 * Build the prompt Gemini receives. Pure function of PlanInput — no
 * side effects, easily unit-testable.
 */
export function buildPrompt(input: PlanInput): string {
  const nowLocal = utcToLocalParts(input.now, input.timeZone);
  const nowStr = `${nowLocal.dateString} ${nowLocal.timeString} local`;

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
  const profileBlock = input.profile
    ? (() => {
        const { ageGroup, topTechnique, subjectIntelligence } = input.profile;
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
        return (
          "\nStudent profile (use to personalise session instructions):\n" +
          `  - Age group: ${AGE_LABELS[ageGroup] ?? ageGroup}\n` +
          `  - Preferred study technique: ${topTechnique.replace(/_/g, " ")}\n` +
          (subjectNotes
            ? `  - Subject difficulty/confidence:\n${subjectNotes}\n`
            : "") +
          `  When writing the "instruction" field, prefer wording that matches the preferred technique.\n` +
          `  For harder subjects with lower confidence, bias toward more frequent topic coverage.\n`
        );
      })()
    : "";

  const tasksBlock =
    input.tasks && input.tasks.length > 0
      ? "\nUpcoming tasks / deadlines (prioritise study sessions for these):\n" +
        input.tasks
          .filter((t) => !t.dueDate || t.dueDate >= nowLocal.dateString)
          .sort((a, b) => (a.dueDate ?? "9999") < (b.dueDate ?? "9999") ? -1 : 1)
          .map(
            (t) =>
              `  - [${t.taskType.toUpperCase()}] ${t.title} (${t.subjectName})${t.dueDate ? ` — due ${t.dueDate}` : ""} — priority: ${t.priority}`,
          )
          .join("\n")
      : "";

  return `You are Pace, an adaptive study planner for high-school students.
Build a realistic, day-by-day study schedule.

Student's timezone: ${input.timeZone}
Right now: ${nowStr}
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
6. Schedule sessions between "right now" and each subject's exam date.
   Prioritise topics whose subject has a nearer exam date; if a subject
   has no exam date, distribute its topics gently through the whole plan.
7. If a topic cannot fit before its exam date given the availability,
   include a warning object with subjectName, topicName, and a short
   message. Never silently drop a topic.
8. subjectName must exactly match one of the subject names above.
   topicName must exactly match a topic listed under that subject.
9. instruction is a short (<= 60 chars) action label for the student,
   e.g. "Review chapter 4", "Practice problems", "Active recall".

Return a JSON object matching the schema.`;
}
