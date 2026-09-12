ALTER TABLE `connector_operation_approval` ADD `run_attempt` integer NOT NULL DEFAULT 1;
--> statement-breakpoint
UPDATE `connector_operation_approval`
SET `run_attempt` = COALESCE(
  (SELECT `attempt` FROM `conversation_run` WHERE `id` = `connector_operation_approval`.`run_id`),
  1
);
