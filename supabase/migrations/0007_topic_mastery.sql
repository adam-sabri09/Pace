-- 0007_topic_mastery.sql
-- Per-topic mastery derived from session completion history.
-- Separate from subjects.confidence_pct (which is student-set) so that
-- ML-derived confidence does not silently overwrite the student's own judgement.

CREATE TABLE IF NOT EXISTS public.topic_mastery (
  id                 uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id            uuid        NOT NULL REFERENCES public.profiles(id)  ON DELETE CASCADE,
  topic_id           uuid        NOT NULL REFERENCES public.topics(id)    ON DELETE CASCADE,
  sessions_completed int         NOT NULL DEFAULT 0,
  sessions_total     int         NOT NULL DEFAULT 0,
  -- Exponentially-smoothed mastery score 0-100 updated after every session.
  mastery_pct        smallint    NOT NULL DEFAULT 0 CHECK (mastery_pct BETWEEN 0 AND 100),
  last_session_at    timestamptz,
  updated_at         timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, topic_id)
);

ALTER TABLE public.topic_mastery ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own mastery"
  ON public.topic_mastery
  FOR ALL TO authenticated
  USING  (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));

CREATE INDEX IF NOT EXISTS topic_mastery_user_idx  ON public.topic_mastery (user_id);
CREATE INDEX IF NOT EXISTS topic_mastery_topic_idx ON public.topic_mastery (topic_id);
