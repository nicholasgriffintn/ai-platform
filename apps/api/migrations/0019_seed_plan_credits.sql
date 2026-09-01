INSERT INTO plans (id, name, description, price, included_credits, grace_credits)
VALUES ('anonymous', 'Signed out', 'Demo allowance for visitors who have not signed in', 0, 20, 0)
ON CONFLICT (id) DO UPDATE SET
	included_credits = COALESCE(plans.included_credits, excluded.included_credits),
	grace_credits = COALESCE(plans.grace_credits, excluded.grace_credits);

INSERT INTO plans (id, name, description, price, included_credits, grace_credits)
VALUES ('free', 'Free', 'Default plan for signed in accounts', 0, 100, 0)
ON CONFLICT (id) DO UPDATE SET
	included_credits = COALESCE(plans.included_credits, excluded.included_credits),
	grace_credits = COALESCE(plans.grace_credits, excluded.grace_credits);

INSERT INTO plans (id, name, description, price, included_credits, grace_credits)
VALUES ('pro', 'Pro', 'Frontier models, generation, live voice, sandboxed runs and Work', 8, 500, 50)
ON CONFLICT (id) DO UPDATE SET
	included_credits = COALESCE(plans.included_credits, excluded.included_credits),
	grace_credits = COALESCE(plans.grace_credits, excluded.grace_credits);
