ALTER TABLE conversation_run ADD COLUMN spend_cap_credit_micros INTEGER;
ALTER TABLE conversation_run ADD COLUMN usage_refunded_at TEXT;
INSERT OR IGNORE INTO plans (id, name, description)
VALUES ('agent', 'Agent', 'Long-running agent work with per-run credit caps');
