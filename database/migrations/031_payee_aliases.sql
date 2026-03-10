-- Add payee aliases table for mapping imported payee names to canonical payees.
-- Aliases support wildcards (*) and are case-insensitive.

CREATE TABLE IF NOT EXISTS payee_aliases (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    payee_id UUID NOT NULL REFERENCES payees(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    alias VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_payee_aliases_payee ON payee_aliases(payee_id);
CREATE INDEX IF NOT EXISTS idx_payee_aliases_user ON payee_aliases(user_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_payee_aliases_user_alias ON payee_aliases(user_id, LOWER(alias));
