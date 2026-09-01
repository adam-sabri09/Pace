export type CoachContext = {
  firstName: string;
  ageBand: string | null;
  subjects: Array<{
    name: string;
    examDate: string | null;
    confidence: number | null;
    difficulty: string | null;
  }>;
  sessionLength: number;
  completionRate: number | null;
  topTechnique: string | null;
  upcomingTasks: Array<{ title: string; taskType: string; dueDate: string | null }>;
  recentCoursework: Array<{ title: string; subjectName: string | null; topicCount: number }>;
  recentPractice: { sessionsLast7Days: number; avgAccuracy: number | null } | null;
  weakTopics: Array<{ name: string; mastery: number }>;
};

export function buildSystemPrompt(ctx: CoachContext, today: string): string {
  const subjectLines = ctx.subjects
    .map((s) => {
      const parts: string[] = [`• ${s.name}`];
      if (s.examDate) parts.push(`exam ${s.examDate}`);
      if (s.difficulty) parts.push(s.difficulty);
      if (s.confidence != null) parts.push(`${s.confidence}% confidence`);
      return parts.join(" — ");
    })
    .join("\n");

  const taskLines =
    ctx.upcomingTasks.length > 0
      ? ctx.upcomingTasks
          .map((t) => `• ${t.title} [${t.taskType}]${t.dueDate ? ` due ${t.dueDate}` : ""}`)
          .join("\n")
      : "None listed.";

  const completionText =
    ctx.completionRate != null
      ? `${Math.round(ctx.completionRate * 100)}% of scheduled sessions completed`
      : "No session history yet";

  const courseworkLines =
    ctx.recentCoursework.length > 0
      ? ctx.recentCoursework
          .map(
            (c) =>
              `• "${c.title}"${c.subjectName ? ` (${c.subjectName})` : ""}${c.topicCount > 0 ? ` — ${c.topicCount} topics` : ""}`,
          )
          .join("\n")
      : "None uploaded yet.";

  const practiceText = ctx.recentPractice
    ? `${ctx.recentPractice.sessionsLast7Days} session(s) this week${ctx.recentPractice.avgAccuracy !== null ? `, avg accuracy ${ctx.recentPractice.avgAccuracy}%` : ""}`
    : "No practice sessions yet.";

  const weakTopicsText =
    ctx.weakTopics.length > 0
      ? ctx.weakTopics
          .map((t) => `• ${t.name} (${t.mastery}% mastery)`)
          .join("\n")
      : null;

  return `You are Pace Coach, a friendly and encouraging AI study coach for high-school students.
You help students study smarter, stay motivated, and manage their workload.

Today's date: ${today}
Student name: ${ctx.firstName}
Age band: ${ctx.ageBand ?? "not set"}
Session length: ${ctx.sessionLength} minutes
Session completion rate: ${completionText}

Subjects:
${subjectLines || "No subjects set yet."}

Upcoming tasks/deadlines:
${taskLines}

Uploaded coursework (ready for practice):
${courseworkLines}

Practice this week: ${practiceText}
${weakTopicsText ? `\nTopics needing attention (mastery < 50%):\n${weakTopicsText}` : ""}
Guidelines:
1. Be warm, encouraging, and concise — this is a teenager. No walls of text.
2. Give specific, actionable study advice tied to the student's actual subjects.
3. When asked about a subject, reference their confidence/difficulty if available.
4. If they ask about uploaded coursework or a specific topic, refer to their uploaded materials when relevant.
5. Suggest concrete study techniques (active recall, spaced repetition, practice tests, Feynman, interleaving).
6. If they have coursework uploaded, encourage them to use the Practice feature to test themselves.
7. Never be dismissive. If they're struggling, normalise it and offer a small next step.
8. Keep each response under 150 words unless a longer answer is truly needed.
9. You cannot see their plan or schedule directly — if asked, tell them to check the Plan tab.
10. You are not a therapist. If they mention serious distress, kindly suggest they talk to a trusted adult.`;
}
