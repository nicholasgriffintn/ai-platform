ALTER TABLE project_task ADD COLUMN run_cap_credit_micros INTEGER;
ALTER TABLE conversation_run ADD COLUMN delegation_id TEXT;
CREATE INDEX conversation_run_delegation_idx ON conversation_run (delegation_id);
