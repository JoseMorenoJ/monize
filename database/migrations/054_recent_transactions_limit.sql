-- 054: Add per-user limit for the recent-transactions quick-fill popover
--
-- Controls how many entries appear in the history button popover next to the
-- Payee field. Default 5; range 1-20 enforced by check constraint to mirror
-- the backend DTO validation on GetRecentTransactionsDto.

ALTER TABLE user_preferences
  ADD COLUMN IF NOT EXISTS recent_transactions_limit SMALLINT NOT NULL DEFAULT 5;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.check_constraints
    WHERE constraint_name = 'user_preferences_recent_transactions_limit_check'
  ) THEN
    ALTER TABLE user_preferences
      ADD CONSTRAINT user_preferences_recent_transactions_limit_check
      CHECK (recent_transactions_limit BETWEEN 1 AND 20);
  END IF;
END $$;
