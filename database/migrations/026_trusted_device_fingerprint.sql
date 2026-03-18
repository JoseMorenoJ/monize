-- Add user-agent fingerprint to trusted devices for context binding.
-- When validating a device token, the current user-agent hash must match
-- the one recorded at creation time to prevent stolen token reuse.
-- Wrapped in IF EXISTS guard: trusted_devices table was dropped in migration 025 (simplify-to-profiles).
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'trusted_devices') THEN
    ALTER TABLE trusted_devices ADD COLUMN IF NOT EXISTS user_agent_hash VARCHAR(64);
  END IF;
END $$;
