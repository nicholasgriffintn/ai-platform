ALTER TABLE `connector_operation_approval` ADD `execution_state` text;
--> statement-breakpoint
ALTER TABLE `connector_operation_approval` ADD `execution_token` text;
--> statement-breakpoint
ALTER TABLE `connector_operation_approval` ADD `execution_lease_expires_at` text;
--> statement-breakpoint
ALTER TABLE `connector_operation_approval` ADD `execution_result_json` text;
--> statement-breakpoint
UPDATE `connector_operation_approval`
SET `execution_state` = 'indeterminate'
WHERE `state` = 'consumed';
