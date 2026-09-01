-- 0008_coach.sql
-- AI Coach conversation history.
-- Each row is one message in a user's coach conversation.

CREATE TABLE IF NOT EXISTS public.coach_messages (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at  timestamptz NOT NULL DEFAULT now(),
  user_id     uuid        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role        text        NOT NULL CHECK (role IN ('user', 'assistant')),
  content     text        NOT NULL,
  metadata    jsonb       NOT NULL DEFAULT '{}'
);

ALTER TABLE public.coach_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own coach messages"
  ON public.coach_messages
  FOR ALL TO authenticated
  USING  (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));

CREATE INDEX IF NOT EXISTS coach_messages_user_created_idx
  ON public.coach_messages (user_id, created_at DESC);
