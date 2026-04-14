-- Add user-defined cost rates to AI provider configurations.
-- Rates are per 1,000,000 tokens, in the user's chosen currency (typically USD).
-- Used to calculate estimated costs for the AI Settings Usage dashboard.
-- Nullable: when null, the UI will display "-" and no cost estimate will be computed.

ALTER TABLE ai_provider_configs
    ADD COLUMN IF NOT EXISTS input_cost_per_1m NUMERIC(12, 4),
    ADD COLUMN IF NOT EXISTS output_cost_per_1m NUMERIC(12, 4);
