-- 0005_subject_tasks.sql
-- Per-subject academic workload items (homework, assignments, projects, quizzes, etc.)
-- and a general-purpose analytics events table.

-- ─── Subject tasks ─────────────────────────────────────────────────────────────
-- Tracks recurring and one-off academic work per subject.
-- Replaces the limited homework_frequency / project_frequency columns on subjects.

CREATE TABLE IF NOT EXISTS public.subject_tasks (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  subject_id  uuid        NOT NULL REFERENCES public.subjects(id) ON DELETE CASCADE,
  task_type   text        NOT NULL
    CHECK (task_type IN ('homework','assignment','project','group_work','quiz','exam','other')),
  title       text,
  due_date    date,
  frequency   text
    CHECK (frequency IS NULL OR frequency IN ('daily','few_per_week','weekly','biweekly','monthly','once','ongoing')),
  priority    text        NOT NULL DEFAULT 'medium'
    CHECK (priority IN ('low','medium','high')),
  is_completed boolean   NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.subject_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own tasks"
  ON public.subject_tasks
  FOR ALL
  TO authenticated
  USING  (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));

CREATE INDEX IF NOT EXISTS subject_tasks_user_id_idx    ON public.subject_tasks (user_id);
CREATE INDEX IF NOT EXISTS subject_tasks_subject_id_idx ON public.subject_tasks (subject_id);

-- ─── Analytics events ──────────────────────────────────────────────────────────
-- General-purpose event log. More flexible than session_events (no CHECK on type)
-- so new event types can be added without a schema migration.

CREATE TABLE IF NOT EXISTS public.analytics_events (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at  timestamptz NOT NULL DEFAULT now(),
  user_id     uuid        REFERENCES public.profiles(id) ON DELETE CASCADE,
  event_type  text        NOT NULL,  -- e.g. 'onboarding_completed','upload_success','session_completed'
  metadata    jsonb       NOT NULL DEFAULT '{}'
);

ALTER TABLE public.analytics_events ENABLE ROW LEVEL SECURITY;

-- Users can read/write their own analytics events; service role can read all for admin.
CREATE POLICY "Users manage own analytics events"
  ON public.analytics_events
  FOR ALL
  TO authenticated
  USING  (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));

CREATE INDEX IF NOT EXISTS analytics_events_user_id_idx    ON public.analytics_events (user_id);
CREATE INDEX IF NOT EXISTS analytics_events_event_type_idx ON public.analytics_events (event_type);
CREATE INDEX IF NOT EXISTS analytics_events_created_at_idx ON public.analytics_events (created_at DESC);
