-- Add time_format preference column (24h or 12h display)
ALTER TABLE user_preferences ADD COLUMN IF NOT EXISTS time_format VARCHAR(10) DEFAULT '24h';
