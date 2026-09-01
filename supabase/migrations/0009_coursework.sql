-- 0009_coursework.sql
-- AI Coursework Intelligence + Adaptive Practice.
-- Three new tables: coursework_items, practice_sessions, practice_attempts.
-- All RLS-protected to the owning user.

-- ---------------------------------------------------------------------------
-- coursework_items: uploaded study material with AI-extracted content
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.coursework_items (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at      timestamptz NOT NULL DEFAULT now(),
  user_id         uuid        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title           text        NOT NULL,
  subject_name    text,
  file_type       text        NOT NULL,
  status          text        NOT NULL DEFAULT 'processing'
                    CHECK (status IN ('processing', 'ready', 'failed')),
  -- extracted: { title, subjectName, difficulty, topics[], definitions[], keyFacts[], relationships[] }
  extracted       jsonb,
  error_message   text
);

ALTER TABLE public.coursework_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own coursework"
  ON public.coursework_items
  FOR ALL TO authenticated
  USING  (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));

CREATE INDEX IF NOT EXISTS coursework_items_user_idx
  ON public.coursework_items (user_id, created_at DESC);

-- ---------------------------------------------------------------------------
-- practice_sessions: one per focused practice block
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.practice_sessions (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at          timestamptz NOT NULL DEFAULT now(),
  completed_at        timestamptz,
  user_id             uuid        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  coursework_item_id  uuid        REFERENCES public.coursework_items(id) ON DELETE SET NULL,
  topic_id            uuid        REFERENCES public.topics(id) ON DELETE SET NULL,
  subject_name        text,
  topic_name          text,
  status              text        NOT NULL DEFAULT 'active'
                        CHECK (status IN ('active', 'completed')),
  current_difficulty  smallint    NOT NULL DEFAULT 2
                        CHECK (current_difficulty BETWEEN 1 AND 3),
  questions_answered  int         NOT NULL DEFAULT 0,
  correct_count       int         NOT NULL DEFAULT 0,
  -- current_question stored server-side: expectedAnswer never goes to the client
  current_question    jsonb
);

ALTER TABLE public.practice_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own practice sessions"
  ON public.practice_sessions
  FOR ALL TO authenticated
  USING  (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));

CREATE INDEX IF NOT EXISTS practice_sessions_user_idx
  ON public.practice_sessions (user_id, created_at DESC);

-- ---------------------------------------------------------------------------
-- practice_attempts: individual question + answer records
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.practice_attempts (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at          timestamptz NOT NULL DEFAULT now(),
  practice_session_id uuid        NOT NULL REFERENCES public.practice_sessions(id) ON DELETE CASCADE,
  user_id             uuid        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  question_text       text        NOT NULL,
  question_type       text        NOT NULL
                        CHECK (question_type IN (
                          'recall', 'understanding', 'application',
                          'comparison', 'problem_solving', 'find_mistake', 'changed_detail'
                        )),
  concept_tested      text,
  user_answer         text        NOT NULL,
  is_correct          boolean,
  response_time_ms    int,
  difficulty          smallint    NOT NULL DEFAULT 2,
  ai_feedback         text
);

ALTER TABLE public.practice_attempts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own practice attempts"
  ON public.practice_attempts
  FOR ALL TO authenticated
  USING  (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));

CREATE INDEX IF NOT EXISTS practice_attempts_session_idx
  ON public.practice_attempts (practice_session_id);
CREATE INDEX IF NOT EXISTS practice_attempts_user_idx
  ON public.practice_attempts (user_id, created_at DESC);
