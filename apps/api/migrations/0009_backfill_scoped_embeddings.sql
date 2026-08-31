-- Only migrate rows whose stored user and namespace independently agree. Rows without this
-- authoritative personal scope stay inaccessible instead of regaining the legacy fallback.
-- A legacy chunk belongs to a parent only when its metadata has a canonical non-negative
-- chunkIndex, its ID has the corresponding suffix, and that exact parent exists in the same scope.
WITH `scoped_embeddings` AS (
	SELECT
		e.*,
		CASE
			WHEN json_valid(e.`metadata`)
			THEN CAST(json_extract(e.`metadata`, '$.chunkIndex') AS TEXT)
		END AS `chunk_index_text`,
		CASE
			WHEN json_valid(e.`metadata`)
			THEN json_type(e.`metadata`, '$.chunkIndex')
		END AS `chunk_index_type`
	FROM `embedding` e
	WHERE e.`user_id` IS NOT NULL
		AND e.`namespace` = 'user_kb_' || CAST(e.`user_id` AS TEXT)
),
`chunk_candidates` AS (
	SELECT
		e.*,
		CASE
			WHEN e.`chunk_index_type` IN ('integer', 'text')
				AND CAST(e.`chunk_index_text` AS INTEGER) >= 0
				AND CAST(CAST(e.`chunk_index_text` AS INTEGER) AS TEXT) = e.`chunk_index_text`
				AND LENGTH(e.`id`) > LENGTH(e.`chunk_index_text`) + 1
				AND SUBSTR(e.`id`, -(LENGTH(e.`chunk_index_text`) + 1)) = '-' || e.`chunk_index_text`
			THEN CAST(e.`chunk_index_text` AS INTEGER)
		END AS `chunk_index`,
		CASE
			WHEN e.`chunk_index_type` IN ('integer', 'text')
				AND CAST(e.`chunk_index_text` AS INTEGER) >= 0
				AND CAST(CAST(e.`chunk_index_text` AS INTEGER) AS TEXT) = e.`chunk_index_text`
				AND LENGTH(e.`id`) > LENGTH(e.`chunk_index_text`) + 1
				AND SUBSTR(e.`id`, -(LENGTH(e.`chunk_index_text`) + 1)) = '-' || e.`chunk_index_text`
			THEN SUBSTR(e.`id`, 1, LENGTH(e.`id`) - LENGTH(e.`chunk_index_text`) - 1)
		END AS `candidate_parent_id`
	FROM `scoped_embeddings` e
),
`classified_embeddings` AS (
	SELECT
		e.*,
		CASE
			WHEN e.`candidate_parent_id` IS NOT NULL
				AND EXISTS (
					SELECT 1
					FROM `scoped_embeddings` parent
					WHERE parent.`id` = e.`candidate_parent_id`
						AND parent.`user_id` = e.`user_id`
						AND parent.`namespace` = e.`namespace`
				)
			THEN e.`candidate_parent_id`
		END AS `grouped_parent_id`
	FROM `chunk_candidates` e
)
INSERT INTO `embedding_document` (
	`id`,
	`scope_type`,
	`user_id`,
	`logical_id`,
	`type`,
	`title`,
	`metadata`,
	`lifecycle_status`,
	`provider`,
	`vector_space`,
	`created_at`,
	`updated_at`
)
SELECT
	'legacy_doc_' || e.`id`,
	'personal',
	e.`user_id`,
	e.`id`,
	COALESCE(NULLIF(e.`type`, ''), 'text'),
	COALESCE(e.`title`, ''),
	CASE
		WHEN json_valid(e.`metadata`) THEN json_remove(
			e.`metadata`,
			'$.chunkId', '$.chunkIndex', '$.content', '$.contentType', '$.documentId',
			'$.embeddingModel', '$.fileData', '$.id', '$.lifecycleStatus', '$.mimeType',
			'$.namespace', '$.provider', '$.providerTarget', '$.scopeTag', '$.title',
			'$.type', '$.userId', '$.vectorSpace', '$.vectorSpaceVersion'
		)
		ELSE '{}'
	END,
	'pending',
	'quarantined',
	'legacy-unresolved',
	e.`created_at`,
	COALESCE(e.`updated_at`, e.`created_at`)
FROM `classified_embeddings` e
WHERE e.`grouped_parent_id` IS NULL;
--> statement-breakpoint
WITH `scoped_embeddings` AS (
	SELECT
		e.*,
		CASE
			WHEN json_valid(e.`metadata`)
			THEN CAST(json_extract(e.`metadata`, '$.chunkIndex') AS TEXT)
		END AS `chunk_index_text`,
		CASE
			WHEN json_valid(e.`metadata`)
			THEN json_type(e.`metadata`, '$.chunkIndex')
		END AS `chunk_index_type`
	FROM `embedding` e
	WHERE e.`user_id` IS NOT NULL
		AND e.`namespace` = 'user_kb_' || CAST(e.`user_id` AS TEXT)
),
`chunk_candidates` AS (
	SELECT
		e.*,
		CASE
			WHEN e.`chunk_index_type` IN ('integer', 'text')
				AND CAST(e.`chunk_index_text` AS INTEGER) >= 0
				AND CAST(CAST(e.`chunk_index_text` AS INTEGER) AS TEXT) = e.`chunk_index_text`
				AND LENGTH(e.`id`) > LENGTH(e.`chunk_index_text`) + 1
				AND SUBSTR(e.`id`, -(LENGTH(e.`chunk_index_text`) + 1)) = '-' || e.`chunk_index_text`
			THEN CAST(e.`chunk_index_text` AS INTEGER)
		END AS `chunk_index`,
		CASE
			WHEN e.`chunk_index_type` IN ('integer', 'text')
				AND CAST(e.`chunk_index_text` AS INTEGER) >= 0
				AND CAST(CAST(e.`chunk_index_text` AS INTEGER) AS TEXT) = e.`chunk_index_text`
				AND LENGTH(e.`id`) > LENGTH(e.`chunk_index_text`) + 1
				AND SUBSTR(e.`id`, -(LENGTH(e.`chunk_index_text`) + 1)) = '-' || e.`chunk_index_text`
			THEN SUBSTR(e.`id`, 1, LENGTH(e.`id`) - LENGTH(e.`chunk_index_text`) - 1)
		END AS `candidate_parent_id`
	FROM `scoped_embeddings` e
),
`classified_embeddings` AS (
	SELECT
		e.*,
		CASE
			WHEN e.`candidate_parent_id` IS NOT NULL
				AND EXISTS (
					SELECT 1
					FROM `scoped_embeddings` parent
					WHERE parent.`id` = e.`candidate_parent_id`
						AND parent.`user_id` = e.`user_id`
						AND parent.`namespace` = e.`namespace`
				)
			THEN e.`candidate_parent_id`
		END AS `grouped_parent_id`
	FROM `chunk_candidates` e
)
INSERT INTO `embedding_chunk` (
	`id`,
	`document_id`,
	`vector_id`,
	`chunk_index`,
	`content`,
	`metadata`,
	`lifecycle_status`,
	`provider`,
	`vector_space`,
	`created_at`,
	`updated_at`
)
SELECT
	'legacy_chunk_' || e.`id`,
	d.`id`,
	e.`id`,
	CASE WHEN e.`grouped_parent_id` IS NOT NULL THEN e.`chunk_index` ELSE 0 END,
	COALESCE(e.`content`, ''),
	'{}',
	'pending',
	d.`provider`,
	d.`vector_space`,
	e.`created_at`,
	COALESCE(e.`updated_at`, e.`created_at`)
FROM `classified_embeddings` e
JOIN `embedding_document` d
	ON d.`id` = 'legacy_doc_' || COALESCE(e.`grouped_parent_id`, e.`id`)
	AND d.`user_id` = e.`user_id`
WHERE e.`grouped_parent_id` IS NOT NULL
	OR NOT EXISTS (
		SELECT 1
		FROM `classified_embeddings` child
		WHERE child.`grouped_parent_id` = e.`id`
			AND child.`user_id` = e.`user_id`
			AND child.`namespace` = e.`namespace`
	);
