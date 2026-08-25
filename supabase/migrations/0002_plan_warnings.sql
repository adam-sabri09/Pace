ALTER TABLE plans ADD COLUMN warnings jsonb NOT NULL DEFAULT '[]'::jsonb;
