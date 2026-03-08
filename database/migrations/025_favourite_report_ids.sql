-- Add favourite_report_ids column to user_preferences for persisting built-in report favourites
ALTER TABLE user_preferences ADD COLUMN IF NOT EXISTS favourite_report_ids TEXT[] DEFAULT '{}';
