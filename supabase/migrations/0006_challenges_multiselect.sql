-- 0006_challenges_multiselect.sql
-- Replaces single biggest_challenge with an array column so students can
-- report multiple study challenges. The old column is retained for backward
-- compatibility with any existing data; the new column is what the app writes.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS study_challenges text[] NOT NULL DEFAULT '{}';

-- Back-fill existing single-value rows into the new array.
UPDATE public.profiles
  SET study_challenges = ARRAY[biggest_challenge]
  WHERE biggest_challenge IS NOT NULL
    AND array_length(study_challenges, 1) IS NULL;
