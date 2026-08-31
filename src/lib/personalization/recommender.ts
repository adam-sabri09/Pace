import type { TechniqueKey, SubjectIntelligence, TodayRecommendation, Difficulty } from './types';
import { TECHNIQUES } from './techniques';

// ---------------------------------------------------------------------------
// Subject scoring — deterministic rules, no LLM
// ---------------------------------------------------------------------------

const DIFFICULTY_WEIGHT: Record<Difficulty, number> = {
  hard: 3,
  medium: 2,
  easy: 1,
};

function urgencyScore(examDate: string | null, todayIso: string): number {
  if (!examDate) return 1; // no exam → low urgency
  const days = Math.round(
    (new Date(examDate + 'T00:00:00Z').getTime() -
      new Date(todayIso + 'T00:00:00Z').getTime()) /
      (24 * 60 * 60 * 1000),
  );
  // Past exam: treat same as no exam — the student should focus on what's ahead.
  if (days < 0) return 1;
  if (days <= 7) return 10;
  if (days <= 14) return 7;
  if (days <= 30) return 5;
  if (days <= 60) return 3;
  return 1;
}

function confidenceInverseScore(confidencePct: number | null): number {
  if (confidencePct == null) return 2; // unknown → moderate priority
  // Lower confidence → higher priority
  if (confidencePct <= 20) return 5;
  if (confidencePct <= 40) return 4;
  if (confidencePct <= 60) return 3;
  if (confidencePct <= 80) return 2;
  return 1;
}

interface SubjectPriority {
  subject: SubjectIntelligence;
  priority: number;
}

export function rankSubjects(
  subjects: SubjectIntelligence[],
  todayIso: string,
): SubjectPriority[] {
  return subjects
    .map((s) => {
      const difficulty = DIFFICULTY_WEIGHT[s.difficulty ?? 'medium'];
      const urgency = urgencyScore(s.examDate, todayIso);
      const lowConfidence = confidenceInverseScore(s.confidencePct);
      const priority = difficulty * urgency * lowConfidence;
      return { subject: s, priority };
    })
    .sort((a, b) => b.priority - a.priority);
}

// ---------------------------------------------------------------------------
// Today recommendation builder
// ---------------------------------------------------------------------------

export function buildTodayRecommendation(
  subjects: SubjectIntelligence[],
  topTechnique: TechniqueKey,
  sessionLengthMinutes: number,
  todayIso: string,
): TodayRecommendation | null {
  if (subjects.length === 0) return null;

  const ranked = rankSubjects(subjects, todayIso);
  const top = ranked[0].subject;
  const technique = TECHNIQUES[topTechnique];

  const difficultyLabel =
    top.difficulty === 'hard'
      ? 'a challenging subject'
      : top.difficulty === 'easy'
        ? 'a subject you find easier'
        : 'this subject';

  const urgency = urgencyScore(top.examDate, todayIso);
  const rawDays = top.examDate
    ? Math.round(
        (new Date(top.examDate + 'T00:00:00Z').getTime() -
          new Date(todayIso + 'T00:00:00Z').getTime()) /
          (24 * 60 * 60 * 1000),
      )
    : null;
  const daysLabel =
    rawDays == null
      ? 'no exam date set'
      : rawDays < 0
        ? 'exam has passed'
        : `${rawDays} day${rawDays === 1 ? '' : 's'} until the exam`;

  let rationale = `${top.subjectName} is the highest priority today`;
  if (urgency >= 7) {
    rationale += ` — the exam is very soon (${daysLabel}).`;
  } else if (top.difficulty === 'hard') {
    rationale += `, as ${difficultyLabel} it benefits from regular attention.`;
  } else if (top.confidencePct != null && top.confidencePct < 50) {
    rationale += ` — your confidence here is lower and focused practice will help.`;
  } else {
    rationale += '.';
  }

  return {
    subjectId: top.subjectId,
    subjectName: top.subjectName,
    topicName: null,
    durationMinutes: sessionLengthMinutes,
    technique: topTechnique,
    techniqueLabel: technique.label,
    rationale,
    sessionInstruction: technique.sessionInstruction,
  };
}
