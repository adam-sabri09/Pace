import { describe, it, expect } from 'vitest';
import {
  PersonalizationAnswersSchema,
  OcrSubjectSchema,
  OcrSubjectsSchema,
  ConfirmedOcrSubjectSchema,
  ConfirmedOcrSubjectsSchema,
} from '@/lib/validation/personalization';

const VALID_ANSWERS = {
  ageGroup: 'older',
  focusBand: 'medium',
  studyHabit: 'active',
  studyChallenge: 'memory',
  studyGoal: 'excel',
  memoryRating: 'average',
};

// ---------------------------------------------------------------------------
// PersonalizationAnswersSchema
// ---------------------------------------------------------------------------

describe('PersonalizationAnswersSchema', () => {
  it('accepts all six required fields with valid values', () => {
    expect(PersonalizationAnswersSchema.safeParse(VALID_ANSWERS).success).toBe(true);
  });

  it('rejects when ageGroup is missing', () => {
    const rest = { focusBand: VALID_ANSWERS.focusBand, studyHabit: VALID_ANSWERS.studyHabit, studyChallenge: VALID_ANSWERS.studyChallenge, studyGoal: VALID_ANSWERS.studyGoal, memoryRating: VALID_ANSWERS.memoryRating };
    expect(PersonalizationAnswersSchema.safeParse(rest).success).toBe(false);
  });

  it('rejects when focusBand is missing', () => {
    const rest = { ageGroup: VALID_ANSWERS.ageGroup, studyHabit: VALID_ANSWERS.studyHabit, studyChallenge: VALID_ANSWERS.studyChallenge, studyGoal: VALID_ANSWERS.studyGoal, memoryRating: VALID_ANSWERS.memoryRating };
    expect(PersonalizationAnswersSchema.safeParse(rest).success).toBe(false);
  });

  it('rejects an unknown ageGroup value', () => {
    expect(PersonalizationAnswersSchema.safeParse({ ...VALID_ANSWERS, ageGroup: 'teen' }).success).toBe(false);
  });

  it('rejects an unknown focusBand value', () => {
    expect(PersonalizationAnswersSchema.safeParse({ ...VALID_ANSWERS, focusBand: 'forever' }).success).toBe(false);
  });

  it('rejects an unknown studyHabit value', () => {
    expect(PersonalizationAnswersSchema.safeParse({ ...VALID_ANSWERS, studyHabit: 'watching_tv' }).success).toBe(false);
  });

  it('rejects an unknown memoryRating value', () => {
    expect(PersonalizationAnswersSchema.safeParse({ ...VALID_ANSWERS, memoryRating: 'photographic' }).success).toBe(false);
  });

  it('accepts all valid ageGroup values', () => {
    for (const ageGroup of ['younger', 'older', 'adult']) {
      expect(PersonalizationAnswersSchema.safeParse({ ...VALID_ANSWERS, ageGroup }).success).toBe(true);
    }
  });

  it('accepts all valid focusBand values', () => {
    for (const focusBand of ['short', 'medium', 'long', 'very_long']) {
      expect(PersonalizationAnswersSchema.safeParse({ ...VALID_ANSWERS, focusBand }).success).toBe(true);
    }
  });

  it('accepts all valid memoryRating values', () => {
    for (const memoryRating of ['strong', 'average', 'weak', 'very_weak']) {
      expect(PersonalizationAnswersSchema.safeParse({ ...VALID_ANSWERS, memoryRating }).success).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// OcrSubjectSchema (topics as { name: string } objects — onboarding wizard shape)
// ---------------------------------------------------------------------------

const VALID_OCR_SUBJECT = {
  name: 'Mathematics',
  examDate: '2026-11-15',
  topics: [{ name: 'Algebra' }, { name: 'Calculus' }],
  difficulty: 'hard',
  confidencePct: 45,
};

describe('OcrSubjectSchema', () => {
  it('accepts a valid subject with all fields', () => {
    expect(OcrSubjectSchema.safeParse(VALID_OCR_SUBJECT).success).toBe(true);
  });

  it('accepts null examDate', () => {
    expect(OcrSubjectSchema.safeParse({ ...VALID_OCR_SUBJECT, examDate: null }).success).toBe(true);
  });

  it('accepts null difficulty', () => {
    expect(OcrSubjectSchema.safeParse({ ...VALID_OCR_SUBJECT, difficulty: null }).success).toBe(true);
  });

  it('accepts null confidencePct', () => {
    expect(OcrSubjectSchema.safeParse({ ...VALID_OCR_SUBJECT, confidencePct: null }).success).toBe(true);
  });

  it('rejects an empty subject name', () => {
    expect(OcrSubjectSchema.safeParse({ ...VALID_OCR_SUBJECT, name: '' }).success).toBe(false);
  });

  it('rejects a badly formatted exam date', () => {
    expect(OcrSubjectSchema.safeParse({ ...VALID_OCR_SUBJECT, examDate: '15/11/2026' }).success).toBe(false);
    expect(OcrSubjectSchema.safeParse({ ...VALID_OCR_SUBJECT, examDate: 'November 15' }).success).toBe(false);
  });

  it('rejects an empty topics array', () => {
    expect(OcrSubjectSchema.safeParse({ ...VALID_OCR_SUBJECT, topics: [] }).success).toBe(false);
  });

  it('rejects confidencePct below 0', () => {
    expect(OcrSubjectSchema.safeParse({ ...VALID_OCR_SUBJECT, confidencePct: -1 }).success).toBe(false);
  });

  it('rejects confidencePct above 100', () => {
    expect(OcrSubjectSchema.safeParse({ ...VALID_OCR_SUBJECT, confidencePct: 101 }).success).toBe(false);
  });

  it('rejects an invalid difficulty value', () => {
    expect(OcrSubjectSchema.safeParse({ ...VALID_OCR_SUBJECT, difficulty: 'extreme' }).success).toBe(false);
  });
});

describe('OcrSubjectsSchema', () => {
  it('rejects an empty array', () => {
    expect(OcrSubjectsSchema.safeParse([]).success).toBe(false);
  });

  it('accepts an array with at least one valid subject', () => {
    expect(OcrSubjectsSchema.safeParse([VALID_OCR_SUBJECT]).success).toBe(true);
  });

  it('accepts multiple subjects', () => {
    const second = { ...VALID_OCR_SUBJECT, name: 'Biology', topics: [{ name: 'Cells' }] };
    expect(OcrSubjectsSchema.safeParse([VALID_OCR_SUBJECT, second]).success).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// ConfirmedOcrSubjectSchema (topics as plain strings — upload-form shape)
// ---------------------------------------------------------------------------

const VALID_CONFIRMED = {
  name: 'Chemistry',
  examDate: '2026-10-20',
  topics: ['Organic Chemistry', 'Acids and Bases'],
  difficulty: 'medium',
  confidencePct: 55,
};

describe('ConfirmedOcrSubjectSchema', () => {
  it('accepts a valid confirmed subject', () => {
    expect(ConfirmedOcrSubjectSchema.safeParse(VALID_CONFIRMED).success).toBe(true);
  });

  it('accepts null examDate, difficulty, and confidencePct', () => {
    expect(ConfirmedOcrSubjectSchema.safeParse({
      ...VALID_CONFIRMED,
      examDate: null,
      difficulty: null,
      confidencePct: null,
    }).success).toBe(true);
  });

  it('rejects empty subject name', () => {
    expect(ConfirmedOcrSubjectSchema.safeParse({ ...VALID_CONFIRMED, name: '' }).success).toBe(false);
  });

  it('rejects an empty topics array', () => {
    expect(ConfirmedOcrSubjectSchema.safeParse({ ...VALID_CONFIRMED, topics: [] }).success).toBe(false);
  });

  it('rejects a badly formatted exam date', () => {
    expect(ConfirmedOcrSubjectSchema.safeParse({ ...VALID_CONFIRMED, examDate: '20/10/2026' }).success).toBe(false);
  });

  it('rejects confidencePct out of range', () => {
    expect(ConfirmedOcrSubjectSchema.safeParse({ ...VALID_CONFIRMED, confidencePct: 101 }).success).toBe(false);
    expect(ConfirmedOcrSubjectSchema.safeParse({ ...VALID_CONFIRMED, confidencePct: -1 }).success).toBe(false);
  });

  it('rejects invalid difficulty', () => {
    expect(ConfirmedOcrSubjectSchema.safeParse({ ...VALID_CONFIRMED, difficulty: 'extreme' }).success).toBe(false);
  });
});

describe('ConfirmedOcrSubjectsSchema', () => {
  it('rejects an empty array', () => {
    expect(ConfirmedOcrSubjectsSchema.safeParse([]).success).toBe(false);
  });

  it('accepts an array with at least one valid subject', () => {
    expect(ConfirmedOcrSubjectsSchema.safeParse([VALID_CONFIRMED]).success).toBe(true);
  });

  it('accepts an array with multiple valid subjects', () => {
    const second = { ...VALID_CONFIRMED, name: 'Biology', topics: ['Cells'] };
    expect(ConfirmedOcrSubjectsSchema.safeParse([VALID_CONFIRMED, second]).success).toBe(true);
  });
});
