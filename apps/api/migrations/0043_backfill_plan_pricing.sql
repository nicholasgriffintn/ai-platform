UPDATE plans
SET price = 8
WHERE id = 'pro' AND (price IS NULL OR price = 0);

UPDATE plans
SET
	name = 'Free',
	description = 'Default plan for signed in accounts'
WHERE id = 'free' AND name = 'Free Plan';

UPDATE plans
SET description = 'Frontier models, generation, live voice, sandboxed runs and Work'
WHERE
	id = 'pro'
	AND description = 'Access to all of our pro models, tools, audio/image/video generation and more.';
