-- Seed free plan
INSERT OR IGNORE INTO plans(id, name, description, price, stripe_price_id)
VALUES ('free', 'Free Plan', 'Default free plan', 0, 'free');

-- Seed pro plan
INSERT OR IGNORE INTO plans(id, name, description, price, stripe_price_id)
VALUES ('pro', 'Pro Plan', 'Default pro plan', 8, 'pro');

-- Seed a test user with ID=1
INSERT OR IGNORE INTO "user"(id, name, email, plan_id)
VALUES (1, 'Seed User', 'seed@polychat.app', 'pro');