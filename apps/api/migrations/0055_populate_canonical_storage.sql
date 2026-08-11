INSERT INTO `provider_connection` (
	`id`, `user_id`, `provider`, `kind`, `external_id`, `status`, `encrypted_data`, `metadata`,
	`created_at`, `updated_at`
)
SELECT
	`id`,
	`user_id`,
	COALESCE(NULLIF(`item_id`, ''), 'unknown'),
	'recipe_connector',
	'',
	'connected',
	CASE WHEN json_valid(`data`) THEN `data` ELSE json_object('legacyValue', `data`) END,
	json_object('migratedFrom', 'app_data'),
	`created_at`,
	`updated_at`
FROM `_canonical_stage_app_data`
WHERE `app_id` = 'recipe_connector_connection';
--> statement-breakpoint

INSERT INTO `provider_connection` (
	`id`, `user_id`, `provider`, `kind`, `external_id`, `status`, `encrypted_data`, `metadata`,
	`created_at`, `updated_at`
)
SELECT
	`id`,
	`user_id`,
	'github',
	'github_app',
	COALESCE(`item_id`, ''),
	'connected',
	CASE WHEN json_valid(`data`) THEN `data` ELSE json_object('legacyValue', `data`) END,
	json_object('migratedFrom', 'app_data'),
	`created_at`,
	`updated_at`
FROM `_canonical_stage_app_data`
WHERE `app_id` = 'github_app_connection';
--> statement-breakpoint

INSERT INTO `template` (
	`id`, `created_by_user_id`, `workspace_id`, `kind`, `capability_id`, `name`, `description`,
	`configuration`, `status`, `created_at`, `updated_at`
)
SELECT
	`id`,
	`user_id`,
	NULL,
	'recipe',
	COALESCE(
		NULLIF(`item_id`, ''),
		CASE WHEN json_valid(`data`) THEN json_extract(`data`, '$.recipeId') ELSE NULL END
	),
	COALESCE(
		CASE WHEN json_valid(`data`) THEN NULLIF(json_extract(`data`, '$.title'), '') ELSE NULL END,
		CASE WHEN json_valid(`data`) THEN NULLIF(json_extract(`data`, '$.name'), '') ELSE NULL END,
		NULLIF(`item_id`, ''),
		'Recipe'
	),
	'',
	CASE WHEN json_valid(`data`) THEN `data` ELSE '{}' END,
	CASE WHEN json_valid(`data`) AND json_extract(`data`, '$.status') = 'paused' THEN 'paused' ELSE 'active' END,
	`created_at`,
	`updated_at`
FROM `_canonical_stage_app_data`
WHERE `app_id` = 'assistant_recipe_installation'
	AND COALESCE(
		NULLIF(`item_id`, ''),
		CASE WHEN json_valid(`data`) THEN json_extract(`data`, '$.recipeId') ELSE NULL END
	) IS NOT NULL;
--> statement-breakpoint

INSERT INTO `activity_record` (
	`id`, `created_by_user_id`, `project_id`, `conversation_id`, `capability_id`, `group_id`,
	`kind`, `status`, `summary`, `data`, `created_at`, `updated_at`
)
SELECT
	`id`,
	`user_id`,
	`project_id`,
	CASE WHEN json_valid(`data`) THEN json_extract(`data`, '$.conversationId') ELSE NULL END,
	'sandbox_runs',
	COALESCE(NULLIF(`item_id`, ''), `id`),
	COALESCE(NULLIF(`item_type`, ''), 'sandbox_run'),
	CASE CASE WHEN json_valid(`data`) THEN json_extract(`data`, '$.status') ELSE NULL END
		WHEN 'queued' THEN 'queued'
		WHEN 'running' THEN 'running'
		WHEN 'paused' THEN 'waiting'
		WHEN 'completed' THEN 'succeeded'
		WHEN 'failed' THEN 'failed'
		WHEN 'cancelled' THEN 'cancelled'
		ELSE 'failed'
	END,
	COALESCE(
		CASE WHEN json_valid(`data`) THEN NULLIF(json_extract(`data`, '$.summary'), '') ELSE NULL END,
		CASE WHEN json_valid(`data`) THEN NULLIF(json_extract(`data`, '$.prompt'), '') ELSE NULL END,
		'Sandbox run'
	),
	CASE WHEN json_valid(`data`) THEN `data` ELSE json_object('legacyValue', `data`) END,
	`created_at`,
	`updated_at`
FROM `_canonical_stage_app_data`
WHERE `app_id` = 'sandbox_runs';
--> statement-breakpoint

INSERT INTO `output` (
	`id`, `created_by_user_id`, `project_id`, `conversation_id`, `parent_output_id`,
	`capability_id`, `group_id`, `kind`, `title`, `status`, `sensitivity`, `content`,
	`storage_key`, `mime_type`, `filename`, `byte_size`, `revision`, `created_at`, `updated_at`
)
SELECT
	`id`,
	`user_id`,
	`project_id`,
	CASE WHEN json_valid(`data`) THEN json_extract(`data`, '$.conversationId') ELSE NULL END,
	NULL,
	`app_id`,
	COALESCE(NULLIF(`item_id`, ''), `id`),
	COALESCE(NULLIF(`item_type`, ''), 'result'),
	CASE WHEN json_valid(`data`) THEN COALESCE(
		NULLIF(json_extract(`data`, '$.title'), ''),
		NULLIF(json_extract(`data`, '$.name'), ''),
		NULLIF(json_extract(`data`, '$.description'), ''),
		`app_id`
	) ELSE `app_id` END,
	'ready',
	CASE WHEN `project_id` IS NULL THEN 'personal' ELSE 'internal' END,
	CASE WHEN json_valid(`data`) THEN `data` ELSE json_object('legacyValue', `data`) END,
	NULL,
	NULL,
	NULL,
	NULL,
	1,
	`created_at`,
	`updated_at`
FROM `_canonical_stage_app_data`
WHERE `app_id` NOT IN (
	'recipe_connector_connection',
	'github_app_connection',
	'assistant_recipe_installation',
	'sandbox_runs'
);
--> statement-breakpoint

INSERT OR IGNORE INTO `source` (
	`id`, `created_by_user_id`, `project_id`, `conversation_id`, `connection_id`, `kind`, `title`,
	`status`, `content`, `provider`, `external_uri`, `vector_id`, `metadata`, `storage_key`,
	`mime_type`, `filename`, `byte_size`, `created_at`, `updated_at`
)
SELECT
	`id`,
	`owner_user_id`,
	NULL,
	`conversation_id`,
	NULL,
	'file',
	COALESCE(NULLIF(`filename`, ''), 'Uploaded file'),
	'available',
	NULL,
	NULL,
	NULL,
	NULL,
	json_object('messageId', `message_id`, 'migratedFrom', 'stored_asset'),
	`key`,
	`mime_type`,
	`filename`,
	`byte_size`,
	`created_at`,
	`updated_at`
FROM `_canonical_stage_stored_asset`
WHERE `purpose` = 'chat_upload';
--> statement-breakpoint

INSERT OR IGNORE INTO `output_source` (`output_id`, `source_id`)
SELECT `asset`.`app_data_id`, `asset`.`id`
FROM `_canonical_stage_stored_asset` AS `asset`
WHERE `asset`.`purpose` = 'chat_upload'
	AND `asset`.`app_data_id` IS NOT NULL
	AND EXISTS (SELECT 1 FROM `output` WHERE `output`.`id` = `asset`.`app_data_id`);
--> statement-breakpoint

INSERT OR IGNORE INTO `output` (
	`id`, `created_by_user_id`, `project_id`, `conversation_id`, `parent_output_id`,
	`capability_id`, `group_id`, `kind`, `title`, `status`, `sensitivity`, `content`,
	`storage_key`, `mime_type`, `filename`, `byte_size`, `revision`, `created_at`, `updated_at`
)
SELECT
	`id`,
	`owner_user_id`,
	(
		SELECT `parent`.`project_id` FROM `output` AS `parent`
		WHERE `parent`.`id` = `_canonical_stage_stored_asset`.`app_data_id`
	),
	`conversation_id`,
	CASE WHEN EXISTS (
		SELECT 1 FROM `output` AS `parent` WHERE `parent`.`id` = `_canonical_stage_stored_asset`.`app_data_id`
	) THEN `app_data_id` ELSE NULL END,
	CASE `purpose`
		WHEN 'sandbox_artifact' THEN 'sandbox_runs'
		WHEN 'ocr_output' THEN 'ocr'
		WHEN 'speech' THEN 'speech'
		ELSE 'generated_media'
	END,
	COALESCE(NULLIF(`app_data_id`, ''), `id`),
	`purpose`,
	COALESCE(NULLIF(`filename`, ''), replace(`purpose`, '_', ' ')),
	'ready',
	CASE WHEN EXISTS (
		SELECT 1 FROM `output` AS `parent`
		WHERE `parent`.`id` = `_canonical_stage_stored_asset`.`app_data_id`
			AND `parent`.`project_id` IS NOT NULL
	) THEN 'internal' ELSE 'personal' END,
	json_object('migratedFrom', 'stored_asset', 'messageId', `message_id`),
	`key`,
	`mime_type`,
	`filename`,
	`byte_size`,
	1,
	`created_at`,
	`updated_at`
FROM `_canonical_stage_stored_asset`
WHERE `purpose` <> 'chat_upload';
--> statement-breakpoint

INSERT INTO `source` (
	`id`, `created_by_user_id`, `project_id`, `conversation_id`, `connection_id`, `kind`, `title`,
	`status`, `content`, `provider`, `external_uri`, `vector_id`, `metadata`, `storage_key`,
	`mime_type`, `filename`, `byte_size`, `created_at`, `updated_at`
)
SELECT
	`id`,
	`user_id`,
	NULL,
	CASE WHEN EXISTS (
		SELECT 1 FROM `conversation`
		WHERE `conversation`.`id` = `_canonical_stage_memories`.`conversation_id`
	) THEN `conversation_id` ELSE NULL END,
	NULL,
	'memory',
	CASE WHEN length(trim(`text`)) > 80 THEN substr(trim(`text`), 1, 77) || '...' ELSE trim(`text`) END,
	CASE WHEN `is_active` = 0 THEN 'archived' ELSE 'available' END,
	`text`,
	NULL,
	NULL,
	`vector_id`,
	json_patch(
		CASE WHEN json_valid(`metadata`) AND json_type(`metadata`) = 'object' THEN `metadata` ELSE '{}' END,
		json_object(
			'category', `category`,
			'namespace', `namespace`,
			'importanceScore', `importance_score`,
			'lastAccessed', `last_accessed`,
			'migratedFrom', 'memories'
		)
	),
	NULL,
	NULL,
	NULL,
	NULL,
	`created_at`,
	`updated_at`
FROM `_canonical_stage_memories`;
--> statement-breakpoint

INSERT INTO `source_collection` (
	`id`, `created_by_user_id`, `project_id`, `title`, `description`, `kind`, `created_at`, `updated_at`
)
SELECT
	`id`, `user_id`, NULL, `title`, `description`, 'memory', `created_at`, `updated_at`
FROM `_canonical_stage_memory_groups`;
--> statement-breakpoint

INSERT OR IGNORE INTO `source_collection_member` (`collection_id`, `source_id`, `created_at`)
SELECT `group_id`, `memory_id`, `created_at`
FROM `_canonical_stage_memory_group_members`
WHERE EXISTS (SELECT 1 FROM `source_collection` WHERE `id` = `group_id`)
	AND EXISTS (SELECT 1 FROM `source` WHERE `id` = `memory_id`);
--> statement-breakpoint

DROP TABLE `_canonical_stage_app_data`;
--> statement-breakpoint
DROP TABLE `_canonical_stage_stored_asset`;
--> statement-breakpoint
DROP TABLE `_canonical_stage_memories`;
--> statement-breakpoint
DROP TABLE `_canonical_stage_memory_groups`;
--> statement-breakpoint
DROP TABLE `_canonical_stage_memory_group_members`;
