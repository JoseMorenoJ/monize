-- Add is_active column to payees table for deactivating unused payees
ALTER TABLE payees ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;

-- Index to efficiently filter active/inactive payees
CREATE INDEX IF NOT EXISTS idx_payees_user_active ON payees(user_id, is_active);
