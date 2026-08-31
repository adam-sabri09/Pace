-- 0004_extended_onboarding.sql
-- Adds extended onboarding fields, error logging, and session analytics.
-- All new profile/subject columns are nullable so existing rows are unaffected.

-- ─── Extended profile fields ─────────────────────────────────────────────────

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS age_band text
    CHECK (age_band IS NULL OR age_band IN ('junior','intermediate','senior','university','adult')),
  ADD COLUMN IF NOT EXISTS study_habits text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS biggest_challenge text
    CHECK (biggest_challenge IS NULL OR biggest_challenge IN (
      'focus','memory','understanding','time','procrastination',
      'knowing_what','motivation','other'
    )),
  ADD COLUMN IF NOT EXISTS goal_ranking text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS memory_score smallint
    CHECK (memory_score IS NULL OR (memory_score >= 0 AND memory_score <= 100));

-- ─── Extended subject workload fields ─────────────────────────────────────────

ALTER TABLE public.subjects
  ADD COLUMN IF NOT EXISTS homework_frequency text
    CHECK (homework_frequency IS NULL OR homework_frequency IN ('rarely','sometimes','often','daily')),
  ADD COLUMN IF NOT EXISTS project_frequency text
    CHECK (project_frequency IS NULL OR project_frequency IN ('none','occasionally','regularly')),
  ADD COLUMN IF NOT EXISTS subject_duration text
    CHECK (subject_duration IS NULL OR subject_duration IN ('full_year','first_semester','second_semester'));

-- ─── Application error log ────────────────────────────────────────────────────
-- Written by server-side service role; no user-facing policies.
-- Service role bypasses RLS so no SELECT policy is needed for /admin.

CREATE TABLE IF NOT EXISTS public.app_errors (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at  timestamptz NOT NULL DEFAULT now(),
  error_type  text        NOT NULL,
  user_id     uuid        REFERENCES public.profiles(id) ON DELETE SET NULL,
  message     text        NOT NULL,
  context     jsonb       NOT NULL DEFAULT '{}'
);

ALTER TABLE public.app_errors ENABLE ROW LEVEL SECURITY;
-- No policies → only the service role can read/write (RLS blocks authenticated role).

-- ─── Session analytics events ─────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.session_events (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at       timestamptz NOT NULL DEFAULT now(),
  user_id          uuid        REFERENCES public.profiles(id) ON DELETE CASCADE,
  study_session_id uuid        REFERENCES public.sessions(id) ON DELETE SET NULL,
  event_type       text        NOT NULL
    CHECK (event_type IN ('started','paused','resumed','completed','abandoned')),
  metadata         jsonb       NOT NULL DEFAULT '{}'
);

ALTER TABLE public.session_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own events"
  ON public.session_events
  FOR ALL
  TO authenticated
  USING  (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));
