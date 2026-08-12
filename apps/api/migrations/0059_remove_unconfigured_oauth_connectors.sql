-- Custom SQL migration file, put your code below! --
-- Remove credentials owned by retired manual OAuth implementations that are not
-- enabled in the configured Composio catalogue.
DELETE FROM `provider_connection`
WHERE `kind` = 'recipe_connector'
  AND `provider` IN ('oura', 'fitbit', 'withings', 'ramp');
--> statement-breakpoint

DELETE FROM `template`
WHERE `kind` = 'recipe'
  AND `capability_id` IN ('oura-recovery-check', 'fitbit', 'withings');
--> statement-breakpoint

DELETE FROM `project_capability`
WHERE `kind` = 'recipe'
  AND `capability_id` IN ('oura-recovery-check', 'fitbit', 'withings');
