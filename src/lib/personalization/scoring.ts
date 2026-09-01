import type {
  AgeGroup,
  FocusBand,
  StudyHabit,
  StudyChallenge,
  StudyGoal,
  MemoryRating,
  PersonalizationAnswers,
  ScoringResult,
  TechniqueKey,
  TechniqueScore,
} from './types';

// Configurable thresholds — tweak without rewriting the algorithm.
const CONFIDENCE_HIGH_THRESHOLD = 55;
const CONFIDENCE_MEDIUM_THRESHOLD = 35;
const CONFIDENCE_GAP_THRESHOLD = 15; // gap between top and 2nd needed for high confidence

// ---------------------------------------------------------------------------
// Weight matrix
//
// Each row defines how many raw points an answer contributes toward a
// technique. Points are summed across all 6 questions, then normalised
// to 0-100. All values are non-negative integers.
// ---------------------------------------------------------------------------

type Weights = Record<TechniqueKey, number>;

const FOCUS_BAND_WEIGHTS: Record<string, Weights> = {
  short: {
    active_recall: 2, spaced_repetition: 2, practice_testing: 2,
    pomodoro: 3, deep_work: 0, feynman: 1, interleaving: 1,
  },
  medium: {
    active_recall: 3, spaced_repetition: 3, practice_testing: 3,
    pomodoro: 2, deep_work: 1, feynman: 2, interleaving: 2,
  },
  long: {
    active_recall: 2, spaced_repetition: 2, practice_testing: 2,
    pomodoro: 1, deep_work: 3, feynman: 3, interleaving: 3,
  },
  very_long: {
    active_recall: 1, spaced_repetition: 1, practice_testing: 1,
    pomodoro: 0, deep_work: 3, feynman: 2, interleaving: 2,
  },
};

const STUDY_HABIT_WEIGHTS: Record<string, Weights> = {
  passive: {
    active_recall: 0, spaced_repetition: 1, practice_testing: 0,
    pomodoro: 2, deep_work: 0, feynman: 2, interleaving: 1,
  },
  note_taking: {
    active_recall: 1, spaced_repetition: 1, practice_testing: 1,
    pomodoro: 2, deep_work: 2, feynman: 3, interleaving: 2,
  },
  active: {
    active_recall: 3, spaced_repetition: 2, practice_testing: 3,
    pomodoro: 2, deep_work: 3, feynman: 1, interleaving: 3,
  },
  flashcards: {
    active_recall: 2, spaced_repetition: 3, practice_testing: 2,
    pomodoro: 1, deep_work: 1, feynman: 0, interleaving: 1,
  },
  passive_media: {
    active_recall: 0, spaced_repetition: 0, practice_testing: 0,
    pomodoro: 2, deep_work: 0, feynman: 2, interleaving: 0,
  },
};

const STUDY_CHALLENGE_WEIGHTS: Record<string, Weights> = {
  focus: {
    active_recall: 1, spaced_repetition: 0, practice_testing: 1,
    pomodoro: 3, deep_work: 1, feynman: 0, interleaving: 1,
  },
  memory: {
    active_recall: 3, spaced_repetition: 3, practice_testing: 2,
    pomodoro: 1, deep_work: 1, feynman: 1, interleaving: 2,
  },
  understanding: {
    active_recall: 2, spaced_repetition: 1, practice_testing: 3,
    pomodoro: 1, deep_work: 3, feynman: 3, interleaving: 2,
  },
  prioritization: {
    active_recall: 1, spaced_repetition: 2, practice_testing: 1,
    pomodoro: 2, deep_work: 2, feynman: 1, interleaving: 3,
  },
};

const STUDY_GOAL_WEIGHTS: Record<string, Weights> = {
  pass: {
    active_recall: 2, spaced_repetition: 2, practice_testing: 3,
    pomodoro: 2, deep_work: 1, feynman: 1, interleaving: 2,
  },
  excel: {
    active_recall: 3, spaced_repetition: 3, practice_testing: 3,
    pomodoro: 2, deep_work: 3, feynman: 2, interleaving: 3,
  },
  mastery: {
    active_recall: 2, spaced_repetition: 3, practice_testing: 2,
    pomodoro: 1, deep_work: 3, feynman: 3, interleaving: 2,
  },
  habits: {
    active_recall: 1, spaced_repetition: 2, practice_testing: 1,
    pomodoro: 3, deep_work: 2, feynman: 2, interleaving: 1,
  },
};

const MEMORY_RATING_WEIGHTS: Record<string, Weights> = {
  strong: {
    active_recall: 1, spaced_repetition: 1, practice_testing: 2,
    pomodoro: 1, deep_work: 2, feynman: 2, interleaving: 2,
  },
  average: {
    active_recall: 2, spaced_repetition: 2, practice_testing: 2,
    pomodoro: 2, deep_work: 2, feynman: 2, interleaving: 2,
  },
  weak: {
    active_recall: 3, spaced_repetition: 3, practice_testing: 1,
    pomodoro: 2, deep_work: 1, feynman: 2, interleaving: 1,
  },
  very_weak: {
    active_recall: 3, spaced_repetition: 3, practice_testing: 1,
    pomodoro: 2, deep_work: 0, feynman: 1, interleaving: 1,
  },
};

const AGE_GROUP_WEIGHTS: Record<string, Weights> = {
  younger: {
    active_recall: 2, spaced_repetition: 2, practice_testing: 3,
    pomodoro: 3, deep_work: 0, feynman: 1, interleaving: 1,
  },
  older: {
    active_recall: 3, spaced_repetition: 3, practice_testing: 3,
    pomodoro: 2, deep_work: 2, feynman: 2, interleaving: 2,
  },
  adult: {
    active_recall: 2, spaced_repetition: 2, practice_testing: 2,
    pomodoro: 1, deep_work: 3, feynman: 3, interleaving: 3,
  },
};

const ALL_TECHNIQUES: TechniqueKey[] = [
  'active_recall', 'spaced_repetition', 'practice_testing',
  'pomodoro', 'deep_work', 'feynman', 'interleaving',
];

/**
 * Map new onboarding profile fields → legacy PersonalizationAnswers format
 * so we can reuse the existing weight matrix without duplicating it.
 */
export function scoreFromNewProfile(profile: {
  ageBand: string | null;
  studyHabits: string[];
  biggestChallenge: string | null;
  studyChallenges?: string[];
  goalRanking: string[];
  memoryScore: number | null;
  sessionLengthMinutes: number | null;
}): ScoringResult {
  const ageGroup: AgeGroup =
    profile.ageBand === 'junior' || profile.ageBand === 'intermediate'
      ? 'younger'
      : profile.ageBand === 'adult'
        ? 'adult'
        : 'older';

  const minutes = profile.sessionLengthMinutes ?? 45;
  const focusBand: FocusBand =
    minutes <= 25 ? 'short' : minutes <= 45 ? 'medium' : 'long';

  const HABIT_MAP: Record<string, StudyHabit> = {
    flashcards: 'flashcards',
    practice_questions: 'active',
    notes: 'note_taking',
    reading: 'passive',
    videos: 'passive_media',
    group_study: 'active',
  };
  let studyHabit: StudyHabit = 'active';
  for (const h of profile.studyHabits) {
    if (h in HABIT_MAP) { studyHabit = HABIT_MAP[h]; break; }
  }

  const CHALLENGE_MAP: Record<string, StudyChallenge> = {
    focus: 'focus', memory: 'memory', understanding: 'understanding',
    time: 'prioritization', procrastination: 'prioritization',
    knowing_what: 'prioritization', motivation: 'prioritization',
    // New multi-select challenge keys
    starting: 'prioritization', homework: 'prioritization', exams: 'memory', other: 'focus',
  };
  // Prefer the new multi-select array; fall back to the legacy single value.
  const challenges: string[] =
    (profile.studyChallenges && profile.studyChallenges.length > 0)
      ? profile.studyChallenges
      : profile.biggestChallenge ? [profile.biggestChallenge] : [];
  // Aggregate: pick the most impactful challenge (first recognised value).
  const studyChallenge: StudyChallenge =
    challenges.map((c) => CHALLENGE_MAP[c]).find((v): v is StudyChallenge => v !== undefined) ?? 'focus';

  const GOAL_MAP: Record<string, StudyGoal> = {
    'Improve my grades': 'excel',
    'Pass my exams': 'pass',
    'Improve my focus': 'habits',
    'Build better study habits': 'habits',
    'Manage my time better': 'habits',
    'Get help from an AI coach': 'mastery',
  };
  const studyGoal: StudyGoal = GOAL_MAP[profile.goalRanking[0] ?? ''] ?? 'pass';

  const ms = profile.memoryScore;
  const memoryRating: MemoryRating =
    ms == null ? 'average' :
    ms >= 80 ? 'strong' :
    ms >= 60 ? 'average' :
    ms >= 40 ? 'weak' : 'very_weak';

  return scorePersonalization({ ageGroup, focusBand, studyHabit, studyChallenge, studyGoal, memoryRating });
}

export function scorePersonalization(answers: PersonalizationAnswers): ScoringResult {
  const rawPoints: Record<TechniqueKey, number> = {} as Record<TechniqueKey, number>;

  for (const t of ALL_TECHNIQUES) {
    rawPoints[t] =
      (FOCUS_BAND_WEIGHTS[answers.focusBand]?.[t] ?? 0) +
      (STUDY_HABIT_WEIGHTS[answers.studyHabit]?.[t] ?? 0) +
      (STUDY_CHALLENGE_WEIGHTS[answers.studyChallenge]?.[t] ?? 0) +
      (STUDY_GOAL_WEIGHTS[answers.studyGoal]?.[t] ?? 0) +
      (MEMORY_RATING_WEIGHTS[answers.memoryRating]?.[t] ?? 0) +
      (AGE_GROUP_WEIGHTS[answers.ageGroup]?.[t] ?? 0);
  }

  const maxRaw = Math.max(...Object.values(rawPoints));
  const normalise = (raw: number) =>
    maxRaw === 0 ? 0 : Math.round((raw / maxRaw) * 100);

  const scores: TechniqueScore[] = ALL_TECHNIQUES
    .map((t) => ({
      technique: t,
      score: normalise(rawPoints[t]),
      rawPoints: rawPoints[t],
    }))
    .sort((a, b) => b.score - a.score);

  const top = scores[0];
  const second = scores[1];
  const gap = top.score - (second?.score ?? 0);

  let confidence = top.score;
  let confidenceLevel: 'high' | 'medium' | 'low';
  if (
    top.score >= CONFIDENCE_HIGH_THRESHOLD &&
    gap >= CONFIDENCE_GAP_THRESHOLD
  ) {
    confidenceLevel = 'high';
  } else if (top.score >= CONFIDENCE_MEDIUM_THRESHOLD) {
    confidenceLevel = 'medium';
  } else {
    confidenceLevel = 'low';
    confidence = Math.max(0, confidence - 10);
  }

  return {
    scores,
    topTechnique: top.technique,
    confidence,
    confidenceLevel,
  };
}
