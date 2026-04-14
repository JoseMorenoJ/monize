-- Adds the currency associated with the input/output token cost rates on each
-- AI provider configuration. Defaults to USD because most major AI providers
-- (Anthropic, OpenAI, etc.) bill in USD. The Usage dashboard uses this to
-- optionally convert estimated costs into the user's home currency.

ALTER TABLE ai_provider_configs
    ADD COLUMN IF NOT EXISTS cost_currency VARCHAR(3) NOT NULL DEFAULT 'USD';
