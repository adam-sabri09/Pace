-- 0016_session_feedback.sql
-- Adds an optional post-session confidence rating (1–5) to each session row.
-- Stored here (not in session_events) so it's directly queryable alongside
-- session data without a join and can inform future ML features.

alter table public.sessions
  add column if not exists feedback_confidence smallint
  check (feedback_confidence is null or (feedback_confidence between 1 and 5));
