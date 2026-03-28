-- Add preferred exchanges for security lookups (up to 3, in priority order)
ALTER TABLE user_preferences
    ADD COLUMN IF NOT EXISTS preferred_exchanges TEXT[] DEFAULT '{}';
