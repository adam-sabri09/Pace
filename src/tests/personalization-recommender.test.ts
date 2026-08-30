import { describe, it, expect } from 'vitest';
import { rankSubjects, buildTodayRecommendation } from '@/lib/personalization/recommender';
import type { SubjectIntelligence } from '@/lib/personalization/types';

// Fixed reference date — makes every priority calculation deterministic.
const TODAY = '2026-09-01';

function subject(overrides: Partial<SubjectIntelligence> & { subjectId: string; subjectName: string }): SubjectIntelligence {
  return {
    difficulty: 'medium',
    confidencePct: 60,
    examDate: '2026-09-10', // 9 days from TODAY
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// rankSubjects
// ---------------------------------------------------------------------------

describe('rankSubjects', () => {
  it('returns empty array for empty input', () => {
    expect(rankSubjects([], TODAY)).toEqual([]);
  });

  it('returns one entry for a single subject', () => {
    const ranked = rankSubjects([subject({ subjectId: 'a', subjectName: 'Math' })], TODAY);
    expect(ranked).toHaveLength(1);
    expect(ranked[0].subject.subjectName).toBe('Math');
    expect(ranked[0].priority).toBeGreaterThan(0);
  });

  it('subject with exam in ≤7 days outranks one far in the future', () => {
    const urgent = subject({ subjectId: 'u', subjectName: 'Physics', examDate: '2026-09-04' }); // 3 days
    const distant = subject({ subjectId: 'd', subjectName: 'History', examDate: '2026-12-01' });
    const [first, second] = rankSubjects([distant, urgent], TODAY);
    expect(first.subject.subjectId).toBe('u');
    expect(first.priority).toBeGreaterThan(second.priority);
  });

  it('subject with no exam date gets urgency 1 (lowest)', () => {
    const noExam = subject({ subjectId: 'x', subjectName: 'Art', examDate: null, difficulty: 'medium', confidencePct: 60 });
    const ranked = rankSubjects([noExam], TODAY);
    // urgency=1, difficulty=medium→2, confidenceInverse(60)=3 (60≤60 band) → priority = 1*2*3 = 6
    expect(ranked[0].priority).toBe(6);
  });

  it('hard subject with low confidence outranks easy subject with high confidence at equal urgency', () => {
    const hard = subject({ subjectId: 'h', subjectName: 'Hard', difficulty: 'hard', confidencePct: 10, examDate: null });
    const easy = subject({ subjectId: 'e', subjectName: 'Easy', difficulty: 'easy', confidencePct: 90, examDate: null });
    const [first] = rankSubjects([easy, hard], TODAY);
    expect(first.subject.subjectId).toBe('h');
  });

  it('null confidence uses moderate inverse priority (2)', () => {
    const noConf = subject({ subjectId: 'n', subjectName: 'Biology', confidencePct: null, examDate: null, difficulty: 'medium' });
    const ranked = rankSubjects([noConf], TODAY);
    // urgency=1, difficulty=medium→2, confidence=null→2 → priority = 1*2*2 = 4
    expect(ranked[0].priority).toBe(4);
  });

  it('null difficulty defaults to medium weight (2)', () => {
    const noDiff = subject({ subjectId: 'm', subjectName: 'Music', difficulty: null, confidencePct: null, examDate: null });
    const ranked = rankSubjects([noDiff], TODAY);
    // urgency=1, difficulty=null→medium→2, confidence=null→2 → 1*2*2 = 4
    expect(ranked[0].priority).toBe(4);
  });

  it('orders multiple subjects with mixed signals correctly', () => {
    const subjects = [
      subject({ subjectId: 'low', subjectName: 'Art', examDate: null, difficulty: 'easy', confidencePct: 90 }),
      subject({ subjectId: 'high', subjectName: 'Chem', examDate: '2026-09-03', difficulty: 'hard', confidencePct: 10 }),
      subject({ subjectId: 'mid', subjectName: 'English', examDate: null, difficulty: 'medium', confidencePct: 50 }),
    ];
    const ranked = rankSubjects(subjects, TODAY);
    // Chem: urgency 10 (2 days), hard(3), conf 10% → inv 5 → priority = 10*3*5 = 150
    expect(ranked[0].subject.subjectId).toBe('high');
  });
});

// ---------------------------------------------------------------------------
// buildTodayRecommendation
// ---------------------------------------------------------------------------

describe('buildTodayRecommendation', () => {
  it('returns null for an empty subjects array', () => {
    expect(buildTodayRecommendation([], 'active_recall', 45, TODAY)).toBeNull();
  });

  it('returns a recommendation with the correct shape', () => {
    const rec = buildTodayRecommendation(
      [subject({ subjectId: 's1', subjectName: 'Mathematics' })],
      'active_recall',
      45,
      TODAY,
    );
    expect(rec).not.toBeNull();
    expect(rec!.subjectId).toBe('s1');
    expect(rec!.subjectName).toBe('Mathematics');
    expect(rec!.durationMinutes).toBe(45);
    expect(rec!.technique).toBe('active_recall');
    expect(rec!.techniqueLabel).toBe('Active Recall');
    expect(typeof rec!.rationale).toBe('string');
    expect(rec!.rationale.length).toBeGreaterThan(0);
    expect(typeof rec!.sessionInstruction).toBe('string');
    expect(rec!.sessionInstruction.length).toBeGreaterThan(0);
    expect(rec!.topicName).toBeNull(); // recommender does not pick individual topics
  });

  it('recommends the highest-priority subject when multiple are present', () => {
    const subjects = [
      subject({ subjectId: 'low', subjectName: 'Art', difficulty: 'easy', confidencePct: 90, examDate: null }),
      subject({ subjectId: 'high', subjectName: 'Physics', examDate: '2026-09-02', difficulty: 'hard', confidencePct: 5 }),
    ];
    const rec = buildTodayRecommendation(subjects, 'spaced_repetition', 25, TODAY);
    expect(rec!.subjectId).toBe('high');
  });

  it('passes the correct session length to the recommendation', () => {
    const rec = buildTodayRecommendation(
      [subject({ subjectId: 's', subjectName: 'Biology' })],
      'pomodoro',
      60,
      TODAY,
    );
    expect(rec!.durationMinutes).toBe(60);
  });

  it('produces a valid techniqueLabel and sessionInstruction for every technique key', () => {
    const techniques = [
      'active_recall', 'spaced_repetition', 'practice_testing',
      'pomodoro', 'deep_work', 'feynman', 'interleaving',
    ] as const;
    for (const t of techniques) {
      const rec = buildTodayRecommendation(
        [subject({ subjectId: 's', subjectName: 'Test' })],
        t,
        45,
        TODAY,
      );
      expect(rec).not.toBeNull();
      expect(rec!.technique).toBe(t);
      expect(rec!.techniqueLabel.length).toBeGreaterThan(0);
      expect(rec!.sessionInstruction.length).toBeGreaterThan(0);
    }
  });

  it('rationale mentions urgency when exam is imminent (≤7 days)', () => {
    const rec = buildTodayRecommendation(
      [subject({ subjectId: 's', subjectName: 'Chemistry', examDate: '2026-09-04' })], // 3 days
      'active_recall',
      45,
      TODAY,
    );
    // rationale should mention "soon" or contain a days count
    expect(rec!.rationale).toMatch(/soon|days/i);
  });

  it('rationale mentions difficulty for hard subjects without imminent exam', () => {
    const rec = buildTodayRecommendation(
      [subject({ subjectId: 's', subjectName: 'Physics', difficulty: 'hard', examDate: null })],
      'deep_work',
      45,
      TODAY,
    );
    expect(rec!.rationale).toMatch(/challenging|hard/i);
  });

  it('rationale mentions confidence when it is low (below 50%) and exam is not imminent', () => {
    const rec = buildTodayRecommendation(
      [subject({ subjectId: 's', subjectName: 'History', difficulty: 'medium', confidencePct: 30, examDate: null })],
      'feynman',
      45,
      TODAY,
    );
    expect(rec!.rationale).toMatch(/confidence|practice/i);
  });
});
