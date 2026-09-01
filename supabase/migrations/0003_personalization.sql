-- 0003_personalization.sql
-- Adds personalization columns to profiles and subject intelligence to subjects.
-- All columns are optional / nullable so existing rows are unaffected.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS age_group text
    CHECK (age_group IN ('younger', 'older', 'adult')),
  ADD COLUMN IF NOT EXISTS personalization_answers jsonb,
  ADD COLUMN IF NOT EXISTS personalization_skipped boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS personalization_completed_at timestamptz;

ALTER TABLE public.subjects
  ADD COLUMN IF NOT EXISTS difficulty text
    CHECK (difficulty IN ('easy', 'medium', 'hard')),
  ADD COLUMN IF NOT EXISTS confidence_pct smallint
    CHECK (confidence_pct >= 0 AND confidence_pct <= 100);