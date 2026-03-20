-- Allow budget_alerts without a linked budget (e.g. BILL_DUE, MORTGAGE_REMINDER alerts)
ALTER TABLE budget_alerts ALTER COLUMN budget_id DROP NOT NULL;
ALTER TABLE budget_alerts ALTER COLUMN budget_category_id DROP NOT NULL;
