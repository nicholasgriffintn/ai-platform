-- Custom SQL migration file, put your code below! --
-- The `dynamic-apps` platform never meant an app: it marks a message produced by running a
-- tool outside a conversation. Dynamic apps no longer exist, so the value is renamed to match.
UPDATE `message`
SET `platform` = 'tool-run'
WHERE `platform` = 'dynamic-apps';
