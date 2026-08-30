import type { AgeGroup, TechniqueKey } from './types';

export interface AgeGroupConfig {
  label: string;
  sessionLengthSuggestion: 25 | 45 | 60;
  maxDailyStudyHours: number;
  uiDensity: 'simple' | 'standard' | 'dense';
  encouragedTechniques: TechniqueKey[];
  discouragedTechniques: TechniqueKey[];
  rationale: string;
}

export const AGE_GROUP_CONFIG: Record<AgeGroup, AgeGroupConfig> = {
  younger: {
    label: 'GCSE / Year 9–11',
    sessionLengthSuggestion: 25,
    maxDailyStudyHours: 2,
    uiDensity: 'simple',
    encouragedTechniques: ['pomodoro', 'active_recall', 'practice_testing'],
    discouragedTechniques: ['deep_work'],
    rationale:
      'Shorter sessions match younger adolescents\' typical focus span. Pomodoro builds the study habit before advanced techniques.',
  },
  older: {
    label: 'A-Level / Year 12–13',
    sessionLengthSuggestion: 45,
    maxDailyStudyHours: 3,
    uiDensity: 'standard',
    encouragedTechniques: ['active_recall', 'spaced_repetition', 'practice_testing', 'feynman'],
    discouragedTechniques: [],
    rationale:
      'A-Level content depth rewards deeper techniques. Longer sessions allow proper retrieval practice and essay planning.',
  },
  adult: {
    label: 'University / 18+',
    sessionLengthSuggestion: 60,
    maxDailyStudyHours: 5,
    uiDensity: 'dense',
    encouragedTechniques: ['deep_work', 'feynman', 'interleaving'],
    discouragedTechniques: ['pomodoro'],
    rationale:
      'University demands sustained focus and metacognitive flexibility. Deep work and interleaving match higher-level cognitive expectations.',
  },
};

export function getAgeGroupConfig(ageGroup: AgeGroup): AgeGroupConfig {
  return AGE_GROUP_CONFIG[ageGroup];
}

export function inferAgeGroup(ageYears: number): AgeGroup {
  if (ageYears >= 19) return 'adult';
  if (ageYears >= 16) return 'older';
  return 'younger';
}
