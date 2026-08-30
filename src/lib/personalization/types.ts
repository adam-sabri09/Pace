export type AgeGroup = 'younger' | 'older' | 'adult';
export type FocusBand = 'short' | 'medium' | 'long' | 'very_long';
export type StudyHabit = 'passive' | 'note_taking' | 'active' | 'flashcards' | 'passive_media';
export type StudyChallenge = 'focus' | 'memory' | 'understanding' | 'prioritization';
export type StudyGoal = 'pass' | 'excel' | 'mastery' | 'habits';
export type MemoryRating = 'strong' | 'average' | 'weak' | 'very_weak';
export type Difficulty = 'easy' | 'medium' | 'hard';

export type TechniqueKey =
  | 'active_recall'
  | 'spaced_repetition'
  | 'practice_testing'
  | 'pomodoro'
  | 'deep_work'
  | 'feynman'
  | 'interleaving';

export interface PersonalizationAnswers {
  ageGroup: AgeGroup;
  focusBand: FocusBand;
  studyHabit: StudyHabit;
  studyChallenge: StudyChallenge;
  studyGoal: StudyGoal;
  memoryRating: MemoryRating;
}

export interface TechniqueScore {
  technique: TechniqueKey;
  score: number; // 0-100, normalised
  rawPoints: number;
}

export interface ScoringResult {
  scores: TechniqueScore[];
  topTechnique: TechniqueKey;
  confidence: number; // 0-100 — system's confidence in this recommendation
  confidenceLevel: 'high' | 'medium' | 'low';
}

export interface SubjectIntelligence {
  subjectId: string;
  subjectName: string;
  difficulty: Difficulty | null;
  confidencePct: number | null; // 0-100
  examDate: string | null; // YYYY-MM-DD
}

export interface TodayRecommendation {
  subjectId: string;
  subjectName: string;
  topicName: string | null;
  durationMinutes: number;
  technique: TechniqueKey;
  techniqueLabel: string;
  rationale: string;
  sessionInstruction: string;
}
