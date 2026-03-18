-- Add remember_me column to refresh_tokens to preserve session preference during rotation.
-- Wrapped in IF EXISTS guard: refresh_tokens table was dropped in migration 025 (simplify-to-profiles).
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'refresh_tokens') THEN
    ALTER TABLE refresh_tokens ADD COLUMN IF NOT EXISTS remember_me BOOLEAN NOT NULL DEFAULT false;
  END IF;
END $$;
