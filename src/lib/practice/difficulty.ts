/**
 * Adaptive difficulty for practice sessions.
 *
 * Levels: 1 (foundational), 2 (intermediate), 3 (advanced).
 * Adjustment rules:
 *   correct + fast (<30 s)  → level +1 (max 3)
 *   correct + slow          → stay
 *   incorrect               → level -1 (min 1)
 */

export type Difficulty = 1 | 2 | 3;

export const DIFFICULTY_LABELS: Record<Difficulty, string> = {
  1: "foundational",
  2: "intermediate",
  3: "advanced",
};

export const FAST_THRESHOLD_MS = 30_000;

export type DifficultyAdjustment = {
  next: Difficulty;
  reason: "correct_fast" | "correct_slow" | "incorrect";
};

export function adjustDifficulty(
  current: Difficulty,
  isCorrect: boolean,
  responseTimeMs: number,
): DifficultyAdjustment {
  if (!isCorrect) {
    return { next: (Math.max(1, current - 1) as Difficulty), reason: "incorrect" };
  }
  if (responseTimeMs < FAST_THRESHOLD_MS) {
    return { next: (Math.min(3, current + 1) as Difficulty), reason: "correct_fast" };
  }
  return { next: current, reason: "correct_slow" };
}

export type QuestionType =
  | "recall"
  | "understanding"
  | "application"
  | "comparison"
  | "problem_solving"
  | "find_mistake"
  | "changed_detail";

// Interleave question types by difficulty so practice is varied.
const TYPE_POOLS: Record<Difficulty, QuestionType[]> = {
  1: ["recall", "understanding", "recall", "changed_detail", "understanding"],
  2: ["understanding", "application", "comparison", "recall", "find_mistake"],
  3: ["application", "comparison", "problem_solving", "find_mistake", "changed_detail"],
};

export function pickQuestionType(difficulty: Difficulty, attemptCount: number): QuestionType {
  const pool = TYPE_POOLS[difficulty];
  return pool[attemptCount % pool.length];
}

export function questionTypeInstruction(type: QuestionType, difficulty: Difficulty): string {
  const level = DIFFICULTY_LABELS[difficulty];
  switch (type) {
    case "recall":
      return `Generate a ${level}-level retrieval question. Ask the student to recall a definition, fact, or concept from the material. Start with "Without looking at your notes, ..." or "From memory, ..."`;
    case "understanding":
      return `Generate a ${level}-level "why" or "how" question. Ask the student to explain the reasoning behind a concept. Use "Why does...", "How does...", or "Explain in your own words..."`;
    case "application":
      return `Generate a ${level}-level application question. Give a scenario and ask the student to apply the concept. Start with "Imagine..." or "Apply your knowledge of..."`;
    case "comparison":
      return `Generate a ${level}-level comparison question. Ask the student to compare two concepts. Use "Compare...", "What is the difference between...", or "How are X and Y similar yet different?"`;
    case "problem_solving":
      return `Generate a ${level}-level problem-solving question. Present a specific problem that requires using the concepts to reach a solution.`;
    case "find_mistake":
      return `Generate a ${level}-level "find the mistake" question. Write a short explanation that contains one subtle error and ask the student to identify and correct it. Label it: "Find the mistake in this explanation:"`;
    case "changed_detail":
      return `Generate a ${level}-level "what if" question. Change one key detail and ask what would happen. Use "What would happen if...", "Suppose instead that...", or "If X were different, then..."`;
  }
}
