import type { TechniqueKey, SubjectIntelligence, TodayRecommendation, Difficulty } from './types';
import { TECHNIQUES } from './techniques';

/** Lightweight topic descriptor added to SubjectIntelligence when available. */
export type TopicInfo = {
  id: string;
  name: string;
};

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

/**
 * Extended subject info including topics (optional).
 * When topics are provided, the recommendation includes a specific topic.
 */
export type SubjectIntelligenceWithTopics = SubjectIntelligence & {
  topics?: TopicInfo[];
};

export function buildTodayRecommendation(
  subjects: SubjectIntelligenceWithTopics[],
  topTechnique: TechniqueKey,
  sessionLengthMinutes: number,
  todayIso: string,
  /** topicId → mastery_pct (0-100). Lower mastery = higher priority. */
  topicMastery?: Map<string, number>,
): TodayRecommendation | null {
  if (subjects.length === 0) return null;

  const ranked = rankSubjects(subjects, todayIso);
  const top = ranked[0].subject as SubjectIntelligenceWithTopics;
  const technique = TECHNIQUES[topTechnique];

  // Pick the lowest-mastery topic under the top subject (if topics are available).
  let recommendedTopic: string | null = null;
  if (top.topics && top.topics.length > 0 && topicMastery) {
    const sorted = [...top.topics].sort((a, b) => {
      const ma = topicMastery.get(a.id) ?? 0;
      const mb = topicMastery.get(b.id) ?? 0;
      return ma - mb; // lowest mastery first
    });
    recommendedTopic = sorted[0].name;
  }

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

  if (recommendedTopic) {
    rationale += ` Focus on ${recommendedTopic} — this topic needs the most work.`;
  }

  return {
    subjectId: top.subjectId,
    subjectName: top.subjectName,
    topicName: recommendedTopic,
    durationMinutes: sessionLengthMinutes,
    technique: topTechnique,
    techniqueLabel: technique.label,
    rationale,
    sessionInstruction: technique.sessionInstruction,
  };
}
