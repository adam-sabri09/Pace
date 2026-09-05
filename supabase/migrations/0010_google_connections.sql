-- Google OAuth connection storage for Calendar and Drive integrations.
-- Stores refresh tokens server-side so background calendar fetches can refresh
-- access tokens without requiring the user to re-authorise each time.
--
-- Security:
--   - RLS enforces that each user can only read and write their own row.
--   - The service role is NOT used for these reads — only the authenticated user client.
--   - Tokens are stored at rest in Postgres (use Supabase Vault or encrypted columns
--     in a production hardening pass — see docs/google-oauth-setup.md).

CREATE TABLE google_connections (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  access_token    text NOT NULL,
  refresh_token   text,
  token_expiry    timestamptz,
  scopes          text[],
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now(),
  UNIQUE(user_id)
);

ALTER TABLE google_connections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users manage own google connections"
  ON google_connections
  FOR ALL
  USING  (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Automatically bump updated_at on every update.
CREATE OR REPLACE FUNCTION update_google_connections_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_google_connections_updated_at
  BEFORE UPDATE ON google_connections
  FOR EACH ROW EXECUTE FUNCTION update_google_connections_updated_at();
