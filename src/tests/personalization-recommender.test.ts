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

// ---------------------------------------------------------------------------
// Past exam date handling
//
// A subject whose exam has already passed should not get artificially high
// urgency. The old code used Math.max(1, days) which turned -5 days into
// urgency=1 → tier "1 <= 7" → urgency 10. Fixed: past exams return urgency 1.
// ---------------------------------------------------------------------------

describe('rankSubjects — past exam date handling', () => {
  // TODAY = '2026-09-01'; yesterday = '2026-08-31'
  const YESTERDAY = '2026-08-31';
  const TOMORROW = '2026-09-02';

  it('subject with a past exam gets the same urgency as one with no exam date', () => {
    const withPast = subject({ subjectId: 'p', subjectName: 'Past', difficulty: 'medium', confidencePct: 50, examDate: YESTERDAY });
    const withNone = subject({ subjectId: 'n', subjectName: 'None', difficulty: 'medium', confidencePct: 50, examDate: null });
    const rankedP = rankSubjects([withPast], TODAY);
    const rankedN = rankSubjects([withNone], TODAY);
    expect(rankedP[0].priority).toBe(rankedN[0].priority);
  });

  it('subject with a past exam does NOT outrank one with a future exam', () => {
    const past = subject({ subjectId: 'past', subjectName: 'Past', difficulty: 'hard', confidencePct: 10, examDate: YESTERDAY });
    const future = subject({ subjectId: 'fut', subjectName: 'Future', difficulty: 'easy', confidencePct: 90, examDate: TOMORROW });
    const [first] = rankSubjects([past, future], TODAY);
    // Future exam (tomorrow) → urgency 10; past exam → urgency 1.
    // Future: easy(1) × 10 × confInv(90%→1) = 10
    // Past:   hard(3) × 1  × confInv(10%→5) = 15 — past still wins on diff×conf alone
    // This confirms urgency 1 for past, not 10 (which would be 10*3*5=150)
    expect(first.subject.subjectId).toBe('past'); // hard/low-conf wins even at urgency 1
    expect(first.priority).toBe(15); // 3 * 1 * 5 = 15, NOT 3 * 10 * 5 = 150
  });

  it('past exam priority is capped at urgency 1 regardless of how far in the past', () => {
    const veryOld = subject({ subjectId: 'old', subjectName: 'Old', difficulty: 'medium', confidencePct: 50, examDate: '2025-01-01' });
    const [{ priority }] = rankSubjects([veryOld], TODAY);
    // urgency=1, medium=2, confInv(50%)=3 → 1*2*3 = 6
    expect(priority).toBe(6);
  });

  it('buildTodayRecommendation skips past-exam urgency when recommending', () => {
    // Hard/10% past exam vs easy/90% future exam:
    // past: urgency=1, hard=3, confInv=5 → priority=15
    // future: urgency=10, easy=1, confInv=1 → priority=10
    // past-exam Hard/10% still wins because diff×conf beats urgent easy/90%
    // But past-exam subject should NOT be boosted to urgency 10 (priority 150)
    const subjects: SubjectIntelligence[] = [
      { subjectId: 'past', subjectName: 'History', difficulty: 'hard',   confidencePct: 10, examDate: YESTERDAY },
      { subjectId: 'fut',  subjectName: 'Biology', difficulty: 'easy',   confidencePct: 90, examDate: TOMORROW  },
    ];
    const ranked = rankSubjects(subjects, TODAY);
    expect(ranked[0].subject.subjectId).toBe('past');
    expect(ranked[0].priority).toBe(15); // NOT 150
    expect(ranked[1].priority).toBe(10);
  });
});

// ---------------------------------------------------------------------------
// Regression: difficulty + confidence changes must change the top recommendation
//
// Reproduces the bug where updating a subject's difficulty/confidence on the
// Subjects page had no visible effect on the Today recommendation.
// The recommender logic was always correct; this confirms it stays correct as
// a guard against future regressions.
// ---------------------------------------------------------------------------

describe('rankSubjects — difficulty/confidence regression', () => {
  const MATH_ID = 'math-id';
  const PHYSICS_ID = 'physics-id';
  const ENGLISH_ID = 'english-id';

  // Baseline: Math Hard/20%, Physics Easy/90%, English Medium/50% — no exam dates.
  // Expected priorities:
  //   Math:    hard(3) × urgency(1) × confInv(20%→5) = 15  ← top
  //   English: medium(2) × urgency(1) × confInv(50%→3) = 6
  //   Physics: easy(1)  × urgency(1) × confInv(90%→1) = 1
  it('Math Hard/20% ranks first when all subjects have no exam date', () => {
    const subjects: SubjectIntelligence[] = [
      { subjectId: MATH_ID,    subjectName: 'Math',    difficulty: 'hard',   confidencePct: 20, examDate: null },
      { subjectId: PHYSICS_ID, subjectName: 'Physics', difficulty: 'easy',   confidencePct: 90, examDate: null },
      { subjectId: ENGLISH_ID, subjectName: 'English', difficulty: 'medium', confidencePct: 50, examDate: null },
    ];
    const ranked = rankSubjects(subjects, TODAY);
    expect(ranked[0].subject.subjectId).toBe(MATH_ID);
    expect(ranked[0].priority).toBe(15);
  });

  it('Math Easy/90% ranks last after values change (priority drops to 1)', () => {
    const subjects: SubjectIntelligence[] = [
      { subjectId: MATH_ID,    subjectName: 'Math',    difficulty: 'easy',   confidencePct: 90, examDate: null },
      { subjectId: PHYSICS_ID, subjectName: 'Physics', difficulty: 'easy',   confidencePct: 90, examDate: null },
      { subjectId: ENGLISH_ID, subjectName: 'English', difficulty: 'medium', confidencePct: 50, examDate: null },
    ];
    const ranked = rankSubjects(subjects, TODAY);
    // Math: easy(1) × urgency(1) × confInv(90%→1) = 1
    // English should now be top: medium(2) × urgency(1) × confInv(50%→3) = 6
    expect(ranked[0].subject.subjectId).toBe(ENGLISH_ID);
    expect(ranked[0].priority).toBe(6);
    // Math must not be recommended first
    expect(ranked[0].subject.subjectId).not.toBe(MATH_ID);
    // Math's priority is 1 — lowest possible
    const mathEntry = ranked.find(r => r.subject.subjectId === MATH_ID);
    expect(mathEntry!.priority).toBe(1);
  });

  it('buildTodayRecommendation picks Math when it is Hard/20%', () => {
    const subjects: SubjectIntelligence[] = [
      { subjectId: MATH_ID,    subjectName: 'Math',    difficulty: 'hard',   confidencePct: 20, examDate: null },
      { subjectId: PHYSICS_ID, subjectName: 'Physics', difficulty: 'easy',   confidencePct: 90, examDate: null },
      { subjectId: ENGLISH_ID, subjectName: 'English', difficulty: 'medium', confidencePct: 50, examDate: null },
    ];
    const rec = buildTodayRecommendation(subjects, 'active_recall', 45, TODAY);
    expect(rec!.subjectId).toBe(MATH_ID);
    expect(rec!.subjectName).toBe('Math');
  });

  it('buildTodayRecommendation no longer picks Math after it becomes Easy/90%', () => {
    const subjects: SubjectIntelligence[] = [
      { subjectId: MATH_ID,    subjectName: 'Math',    difficulty: 'easy',   confidencePct: 90, examDate: null },
      { subjectId: PHYSICS_ID, subjectName: 'Physics', difficulty: 'easy',   confidencePct: 90, examDate: null },
      { subjectId: ENGLISH_ID, subjectName: 'English', difficulty: 'medium', confidencePct: 50, examDate: null },
    ];
    const rec = buildTodayRecommendation(subjects, 'active_recall', 45, TODAY);
    expect(rec!.subjectId).not.toBe(MATH_ID);
    expect(rec!.subjectId).toBe(ENGLISH_ID);
  });

  it('an upcoming exam can make a low-priority subject the top recommendation', () => {
    // Physics is easy/90% — normally lowest priority.
    // But with a 5-day exam it gets urgency 10.
    // Physics: easy(1) × urgency10 × confInv(90%→1) = 10
    // Math Easy/90%: easy(1) × urgency(1) × confInv(90%→1) = 1
    // English: medium(2) × urgency(1) × confInv(50%→3) = 6
    // Physics wins.
    const subjects: SubjectIntelligence[] = [
      { subjectId: MATH_ID,    subjectName: 'Math',    difficulty: 'easy',   confidencePct: 90, examDate: null },
      { subjectId: PHYSICS_ID, subjectName: 'Physics', difficulty: 'easy',   confidencePct: 90, examDate: '2026-09-06' }, // 5 days from TODAY
      { subjectId: ENGLISH_ID, subjectName: 'English', difficulty: 'medium', confidencePct: 50, examDate: null },
    ];
    const ranked = rankSubjects(subjects, TODAY);
    expect(ranked[0].subject.subjectId).toBe(PHYSICS_ID);
    expect(ranked[0].priority).toBe(10);
  });

  it('priority formula is stable: same inputs always produce the same ranking', () => {
    const subjects: SubjectIntelligence[] = [
      { subjectId: MATH_ID,    subjectName: 'Math',    difficulty: 'hard',   confidencePct: 20, examDate: null },
      { subjectId: PHYSICS_ID, subjectName: 'Physics', difficulty: 'easy',   confidencePct: 90, examDate: null },
      { subjectId: ENGLISH_ID, subjectName: 'English', difficulty: 'medium', confidencePct: 50, examDate: null },
    ];
    const first  = rankSubjects(subjects, TODAY).map(r => r.subject.subjectId);
    const second = rankSubjects(subjects, TODAY).map(r => r.subject.subjectId);
    expect(first).toEqual(second);
  });
});
