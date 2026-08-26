export type SubjectProgressData = {
  id: string;
  name: string;
  examDate: string; // YYYY-MM-DD
  completedSessions: number;
  totalSessions: number; // completed + scheduled (missed excluded)
  progressPct: number; // 0–100
  daysToExam: number; // negative = past, 0 = today, positive = future
  hasWarning: boolean;
};

/**
 * Calendar-day difference between two YYYY-MM-DD strings.
 * Positive → future, 0 → today, negative → past.
 */
export function daysUntilExam(examDate: string, todayDate: string): number {
  const parse = (s: string) =>
    Date.UTC(+s.slice(0, 4), +s.slice(5, 7) - 1, +s.slice(8, 10));
  return Math.round((parse(examDate) - parse(todayDate)) / 86_400_000);
}

/**
 * Derive per-subject progress from raw query results and active plan warnings.
 *
 * Missed sessions are excluded from the denominator — they are removed from
 * the active plan on replan, so including them would shrink the ratio
 * artificially each time a student misses a session.
 */
export function computeSubjectProgress(
  subjects: Array<{
    id: string;
    name: string;
    examDate: string;
    topics: Array<{ sessions: Array<{ status: string }> }>;
  }>,
  warnings: Array<{ subjectName: string }>,
  todayDate: string,
): SubjectProgressData[] {
  const warnedSubjects = new Set(warnings.map((w) => w.subjectName));

  return subjects.map((s) => {
    const allSessions = s.topics.flatMap((t) => t.sessions);
    const completedSessions = allSessions.filter(
      (sess) => sess.status === "completed",
    ).length;
    const scheduledSessions = allSessions.filter(
      (sess) => sess.status === "scheduled",
    ).length;
    const totalSessions = completedSessions + scheduledSessions;
    const progressPct =
      totalSessions === 0
        ? 0
        : Math.round((completedSessions / totalSessions) * 100);

    return {
      id: s.id,
      name: s.name,
      examDate: s.examDate,
      completedSessions,
      totalSessions,
      progressPct,
      daysToExam: daysUntilExam(s.examDate, todayDate),
      hasWarning: warnedSubjects.has(s.name),
    };
  });
}
