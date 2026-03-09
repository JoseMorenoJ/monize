-- Migration 025: Simplify authentication to profile-based system
-- Removes all authentication tables and columns. Users become simple profiles.
-- Drops: personal_access_tokens, trusted_devices, refresh_tokens
-- Simplifies: users table (removes all auth columns, adds avatar_color)
-- Cleans up: user_preferences (removes auth-related flags)

-- Drop auth-only tables (cascade removes dependent indexes/triggers)
DROP TABLE IF EXISTS personal_access_tokens CASCADE;
DROP TABLE IF EXISTS trusted_devices CASCADE;
DROP TABLE IF EXISTS refresh_tokens CASCADE;

-- Drop auth-related indexes on users
DROP INDEX IF EXISTS idx_users_reset_token;
DROP INDEX IF EXISTS idx_users_oidc_link_token;

-- Remove auth columns from users table
ALTER TABLE users DROP COLUMN IF EXISTS email CASCADE;
ALTER TABLE users DROP COLUMN IF EXISTS password_hash;
ALTER TABLE users DROP COLUMN IF EXISTS auth_provider;
ALTER TABLE users DROP COLUMN IF EXISTS oidc_subject;
ALTER TABLE users DROP COLUMN IF EXISTS is_active;
ALTER TABLE users DROP COLUMN IF EXISTS role;
ALTER TABLE users DROP COLUMN IF EXISTS last_login;
ALTER TABLE users DROP COLUMN IF EXISTS reset_token;
ALTER TABLE users DROP COLUMN IF EXISTS reset_token_expiry;
ALTER TABLE users DROP COLUMN IF EXISTS two_factor_secret;
ALTER TABLE users DROP COLUMN IF EXISTS pending_two_factor_secret;
ALTER TABLE users DROP COLUMN IF EXISTS backup_codes;
ALTER TABLE users DROP COLUMN IF EXISTS failed_login_attempts;
ALTER TABLE users DROP COLUMN IF EXISTS locked_until;
ALTER TABLE users DROP COLUMN IF EXISTS must_change_password;
ALTER TABLE users DROP COLUMN IF EXISTS oidc_link_pending;
ALTER TABLE users DROP COLUMN IF EXISTS oidc_link_token;
ALTER TABLE users DROP COLUMN IF EXISTS oidc_link_expires_at;
ALTER TABLE users DROP COLUMN IF EXISTS pending_oidc_subject;

-- Add profile-specific column
ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_color VARCHAR(7) NOT NULL DEFAULT '#6366f1';

-- Remove auth-related columns from user_preferences
ALTER TABLE user_preferences DROP COLUMN IF EXISTS two_factor_enabled;
ALTER TABLE user_preferences DROP COLUMN IF EXISTS notification_email;
ALTER TABLE user_preferences DROP COLUMN IF EXISTS notification_browser;
