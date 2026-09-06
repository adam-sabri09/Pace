-- 0013_google_connections_rls_hardening.sql
-- Aligns the google_connections RLS policy with the pattern used by every
-- other user table in this project:
--   * TO authenticated  — policy only evaluates for the authenticated role;
--                         anon never reaches the expression.
--   * (SELECT auth.uid()) — Postgres caches the result once per statement
--                           instead of calling the function for every row.
-- The intended authorization behaviour is unchanged: each user can only
-- read, write, and delete their own connection row.

ALTER POLICY "users manage own google connections"
  ON public.google_connections
  TO authenticated
  USING  ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);
