-- 053: Add per-security and per-user quote provider configuration
--
-- Introduces support for a second quote provider (MSN Money) alongside Yahoo Finance.
-- A NULL quote_provider on a security means "use the user's default".
-- security_prices.source already tolerates arbitrary strings; MSN-sourced rows
-- will use 'msn_finance' as their source value.

ALTER TABLE securities
  ADD COLUMN IF NOT EXISTS quote_provider VARCHAR(20) NULL,
  ADD COLUMN IF NOT EXISTS msn_instrument_id VARCHAR(50) NULL;

ALTER TABLE user_preferences
  ADD COLUMN IF NOT EXISTS default_quote_provider VARCHAR(20) NOT NULL DEFAULT 'yahoo';

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.check_constraints
    WHERE constraint_name = 'securities_quote_provider_check'
  ) THEN
    ALTER TABLE securities
      ADD CONSTRAINT securities_quote_provider_check
      CHECK (quote_provider IS NULL OR quote_provider IN ('yahoo','msn'));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.check_constraints
    WHERE constraint_name = 'user_preferences_default_quote_provider_check'
  ) THEN
    ALTER TABLE user_preferences
      ADD CONSTRAINT user_preferences_default_quote_provider_check
      CHECK (default_quote_provider IN ('yahoo','msn'));
  END IF;
END $$;
