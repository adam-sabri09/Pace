-- Add email column to google_connections so the connected Google account
-- can be identified in the UI without exposing access or refresh tokens.
-- Nullable so existing rows without an email remain valid.
ALTER TABLE google_connections ADD COLUMN IF NOT EXISTS email text;
